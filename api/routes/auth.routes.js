const { Router } = require('express');

const authController = require('../controllers/auth.controller');


const router = Router();

// Bound the in-memory login throttle; a single Node instance serves local development.
const adminAttempts = new Map();
router.post(['/login', '/admin/login'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const now = Date.now();
  for (const [key, entry] of adminAttempts) if (entry.until <= now) adminAttempts.delete(key);
  const key = req.ip;
  let entry = adminAttempts.get(key);
  if (!entry) {
    if (adminAttempts.size >= 10000) return res.status(429).json({ message: 'Inténtalo más tarde.' });
    entry = { count: 0, until: now + 15 * 60 * 1000 };
    adminAttempts.set(key, entry);
  }
  if (++entry.count > 10) {
    res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
    return res.status(429).json({ message: 'Demasiados intentos. Inténtalo en 15 minutos.' });
  }
  req.adminLogin = req.path === '/admin/login';
  next();
}, authController.login);


// POST /api/auth/register
router.post(
  '/register',
  authController.register
);


// POST /api/auth/logout
router.post(
  '/logout',
  authController.logout
);


module.exports = router;
