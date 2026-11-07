const { Router } = require('express');

const alertController =
  require('../controllers/alert.controller');

const authMiddleware =
  require('../middleware/auth.middleware');

const redisMiddleware =
  require('../middleware/redis.middleware');


const router = Router();


router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  alertController.getAlerts
);


router.patch(
  '/:id/read',
  authMiddleware,
  redisMiddleware,
  alertController.markAsRead
);


module.exports = router;