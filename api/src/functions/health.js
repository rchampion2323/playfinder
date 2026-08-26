// api/src/functions/health.js
//
// GET /api/health
//
// Free diagnostic. Tells you whether the API is deployed and whether the
// Anthropic key is configured — WITHOUT making any paid API call.
// Visit https://<your-site>.azurestaticapps.net/api/health in a browser.
//
// Deliberately reports only whether the key EXISTS and its length. It never
// returns the key itself.

import { app } from "@azure/functions";
import { jsonResponse } from "../lib/claude.js";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    const configured = Boolean(key && key.length > 20);

    return jsonResponse(200, {
      status: "ok",
      apiDeployed: true,
      anthropicKeyConfigured: configured,
      keyLooksValid: configured ? key.startsWith("sk-ant-") : false,
      keyLength: key ? key.length : 0,
      model: process.env.SCAN_MODEL || "claude-haiku-4-5-20251001",
      maxSearchesPerScan: Number(process.env.MAX_SEARCHES || 3),
      rateLimitPerHour: Number(process.env.RATE_LIMIT_PER_HOUR || 20),
      nextStep: configured
        ? "Key is configured. Try the Deep scan button in the app."
        : "Add ANTHROPIC_API_KEY in Azure Portal → your Static Web App → Settings → Environment variables.",
    });
  },
});
