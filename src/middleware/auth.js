const jwt = require('jsonwebtoken');
const db = require('../db');

function requireAuth(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Chain after requireAuth. Checks the DB (not the JWT) so revoking admin takes effect immediately.
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (!rows.length || !rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not verify admin status.' });
  }
}

module.exports = { requireAuth, requireAdmin };
