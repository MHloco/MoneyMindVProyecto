const { Router } = require('express');
const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/assistant.controller');
const router = Router();

router.use(auth);
router.get('/conversations', controller.list);
router.get('/conversations/:id', controller.detail);
router.post('/messages', controller.send);
router.post('/analysis', controller.analyze);

module.exports = router;
