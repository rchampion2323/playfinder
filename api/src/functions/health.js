// api/src/functions/health.js
//
// GET /api/health — free diagnostic that the API is deployed.
//
// Tournament data no longer comes from the API: the daily GitHub Action
// (scanner/pull.js) writes public/data/tournaments.json and the site serves
// it as a static file. The old /api/scan and /api/discover endpoints, which
// spent money on every public request, have been removed.

import { app } from "@azure/functions";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async () => ({
    status: 200,
    headers: { "Content-Type": "application/json" },
    jsonBody: { status: "ok", apiDeployed: true, data: "/data/tournaments.json" },
  }),
});
