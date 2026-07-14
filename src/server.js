require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const politicianRoutes = require('./routes/politicians');
const actionRoutes = require('./routes/actions');
const electionRoutes = require('./routes/elections');
const congressRoutes = require('./routes/congress');
const feedRoutes = require('./routes/feed');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/politicians', politicianRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/races', electionRoutes);
app.use('/api/congress', congressRoutes);
app.use('/api/feed', feedRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => console.log(`STATESMAN server running on port ${PORT}`));

  // Background sweep: close out any races whose closes_at has passed, even with no traffic.
  // Only meaningful for a long-running process (local dev / a real server), not serverless.
  setInterval(() => {
    electionRoutes.sweepExpiredRaces().catch(err => console.error('Sweep failed:', err));
  }, 30 * 1000);
}

module.exports = app;
