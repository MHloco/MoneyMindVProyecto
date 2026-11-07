const { Router } = require('express');
const auth = require('../middleware/auth.middleware');
const requireAdmin = require('../middleware/admin.middleware');
const service = require('../services/admin.services');
const router = Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(auth, requireAdmin);
router.post('/superusers', async (req, res) => {
  try { res.status(201).json(await service.createSuperuser(req.admin.id, req.body)); }
  catch (error) {
    const status = [400, 403, 409].includes(error.status) ? error.status : 500;
    res.status(status).json({ message: status === 500 ? 'No se pudo crear el superusuario. Inténtalo de nuevo.' : error.message });
  }
});
router.get('/session', (req, res) => res.json({ user: { id: req.admin.id,
  email: req.admin.email, fullName: req.admin.full_name, role: 'SUPERUSER' } }));
for (const [path, action] of [['/summary', () => service.summary()], ['/users', req => service.users(req.query)]]) {
  router.get(path, async (req, res) => {
    try { res.json(await action(req)); }
    catch (error) { res.status(error.status === 400 ? 400 : 500).json({
      message: error.status === 400 ? error.message : 'No se pudo cargar la información de administración.' }); }
  });
}
module.exports = router;
