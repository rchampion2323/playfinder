// scanner/extract.js
//
// Asks Claude to read ONE tour's schedule and report every upcoming junior
// tournament it can verify, via a strict `report_tournaments` tool. Claude
// fetches the tour's own schedule page (web_fetch) and can search the web
// (web_search) for event pages the schedule links to.
//
// Runs only in Node (GitHub Actions or a laptop) — never in the browser.
// Credentials: ANTHROPIC_API_KEY (repo secret in CI).

import Anthropic from "@anthropic-ai/sdk";

// Haiku 5.5 by default: a small fraction of Opus's cost. Override with the SCAN_MODEL
// repo variable or the workflow's "model" input to compare.
export const MODEL = process.env.SCAN_MODEL || "claude-haiku-5-5";
const MAX_FETCHES = Number(process.env.MAX_FETCHES || 6);
const MAX_SEARCHES = Number(process.env.MAX_SEARCHES || 3);

// Dynamic-filtering web tools need a current Opus/Sonnet; Haiku uses the basic ones.
const isHaiku = MODEL.startsWith("claude-haiku");
const SERVER_TOOLS = [
  { type: isHaiku ? "web_fetch_20250910" : "web_fetch_20260209", name: "web_fetch", max_uses: MAX_FETCHES },
  { type: isHaiku ? "web_search_20250305" : "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
];

const REPORT_TOOL = {
  name: "report_tournaments",
  description:
    "Report every upcoming junior golf tournament you verified on this organization's pages. " +
    "Call exactly once, at the end, with all tournaments (or an empty list if none could be verified).",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["tournaments", "notes"],
    properties: {
      notes: { type: "string", description: "One or two sentences: which pages you read, anything that blocked you." },
      tournaments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "tour", "startDate", "endDate", "venue", "city", "state", "ageMin", "ageMax",
            "gender", "type", "divisions", "holes", "feeAmount", "registrationCloses", "status", "entryUrl", "sourceUrl"],
          properties: {
            name: { type: "string", description: "Official tournament name as published" },
            tour: { type: "string", description: "Short tour/organizer name, e.g. HJGT, SJGT, US Kids Golf, AJGA, FSGA" },
            startDate: { type: "string", description: "YYYY-MM-DD, exactly as published" },
            endDate: { type: "string", description: "YYYY-MM-DD; same as startDate for one-day events" },
            venue: { type: "string", description: "Golf course name, or empty string" },
            city: { type: "string", description: "City only, e.g. Mobile" },
            state: { type: "string", description: "Two-letter state code" },
            ageMin: { type: "integer" },
            ageMax: { type: "integer" },
            gender: { type: "string", enum: ["boys", "girls", "coed"] },
            type: {
              type: "string",
              enum: ["entry", "ranked", "championship", "national", "qualifier"],
              description:
                "entry = local/beginner tours & 9-hole events; ranked = ranked regional tour events; " +
                "championship = state association junior championships; national = AJGA, elite invitationals, national finals; " +
                "qualifier = qualifying for a bigger championship",
            },
            divisions: { type: "array", items: { type: "string" }, description: "e.g. 'Boys 15-18'; empty if not listed" },
            holes: { type: ["integer", "null"], description: "Total holes, e.g. 36; null if not listed" },
            feeAmount: { type: ["number", "null"], description: "Entry fee in USD; null if not listed" },
            registrationCloses: { type: ["string", "null"], description: "YYYY-MM-DD entry deadline; null if not listed" },
            status: { type: "string", enum: ["open", "closed", "full", "not_open", "unknown"] },
            entryUrl: { type: "string", description: "Direct URL of the tournament's own page or entry form" },
            sourceUrl: { type: "string", description: "URL of the page where you read these details" },
          },
        },
      },
    },
  },
};

const SYSTEM = `You extract junior golf tournament schedules for PlayFinder, a search tool parents use to plan travel.
Accuracy matters more than coverage: a wrong date sends a family on a long drive to nothing.
Only report tournaments whose date you actually read on a page during this task. Never infer, estimate, or fill in from memory.
Use empty strings or null for anything not published. When you are done reading, call report_tournaments once.`;

function prompt(source, { states, today, horizonDays }) {
  return `Today is ${today}.

Organization: ${source.name}
Schedule page: ${source.url}
${source.notes ? `Notes: ${source.notes}\n` : ""}
Read the schedule page (fetch it; follow links to individual event pages only when the schedule lacks dates, ages, or location).
Report every upcoming tournament for juniors (ages 18 and under) that:
- is located in one of these states: ${states.join(", ")}
- starts between ${today} and ${horizonDays} days from today.

Then call report_tournaments.`;
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

/** Returns { tournaments, notes, usage }. Throws on API errors or refusals. */
export async function extractSource(source, opts) {
  const messages = [{ role: "user", content: prompt(source, opts) }];
  const usage = { inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0 };

  for (let turn = 0; turn < 6; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Server-side refusal fallback exists for Opus/Sonnet/Fable, not Haiku.
      ...(isHaiku ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
      output_config: { effort: process.env.SCAN_EFFORT || "medium" },
      system: SYSTEM,
      tools: [...SERVER_TOOLS, REPORT_TOOL],
      messages,
    });

    usage.inputTokens += res.usage?.input_tokens ?? 0;
    usage.outputTokens += res.usage?.output_tokens ?? 0;
    usage.searches += res.usage?.server_tool_use?.web_search_requests ?? 0;
    usage.fetches += res.usage?.server_tool_use?.web_fetch_requests ?? 0;

    if (res.stop_reason === "refusal") {
      throw new Error(`declined (${res.stop_details?.category ?? "no category"})`);
    }

    const call = res.content.find((b) => b.type === "tool_use" && b.name === "report_tournaments");
    if (call) return { tournaments: call.input.tournaments ?? [], notes: call.input.notes ?? "", usage };

    if (res.stop_reason === "pause_turn") {
      // Server-side tool loop paused; send the assistant turn back and it resumes.
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "max_tokens") throw new Error("ran out of output tokens before reporting");

    // Finished without calling the tool: ask once, explicitly.
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: "Please call report_tournaments now with what you verified (an empty list is fine)." });
  }
  throw new Error("never called report_tournaments");
}
