// Vercel auto-detects any file under /api as a serverless function.
// src/server.js already exports the Express app (and only calls app.listen()
// when run directly, e.g. `node src/server.js` locally) — so we just re-export it here.
module.exports = require('../src/server');
