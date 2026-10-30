require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const { worldTick } = require('./engine/tick');
const { seedWorld } = require('./engine/seed');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Make sure the world exists, then keep its clocks moving on API traffic.
let ready = null;
app.use('/api', async (req, res, next) => {
  try {
    ready = ready || seedWorld();
    await ready;
    await worldTick();
  } catch (err) {
    ready = null;
    console.error('World tick failed:', err);
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', gameRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));
// Vercel Cron keeps the world moving with zero traffic (the middleware above already ticked).
app.get('/api/cron/tick', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => console.log(`STATESMAN server running on port ${PORT}`));
  setInterval(() => worldTick().catch(err => console.error('Tick failed:', err)), 30 * 1000);
}

module.exports = app;
