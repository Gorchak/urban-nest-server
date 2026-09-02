const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 8;
const cleanup = setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  attempts.forEach((times, key) => {
    const recent = times.filter((time) => time >= cutoff);
    if (recent.length) attempts.set(key, recent); else attempts.delete(key);
  });
}, WINDOW_MS);
cleanup.unref();

module.exports = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const recent = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= LIMIT) {
    res.set('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
    return res.status(429).json({ success: false, message: 'Забагато спроб. Спробуйте пізніше.' });
  }
  recent.push(now);
  attempts.set(key, recent);
  next();
};
