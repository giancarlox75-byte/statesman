// Creates the schema and seeds the world (every seat filled by an NPC). Safe to re-run.
//   node scripts/init-db.js
require('dotenv').config();
const db = require('../src/db');
const { seedWorld } = require('../src/engine/seed');

seedWorld()
  .then(created => { console.log(created ? 'World created.' : 'World already exists — schema checked.'); return db.pool.end(); })
  .catch(err => { console.error(err); process.exit(1); });
