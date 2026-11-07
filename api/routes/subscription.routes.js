const { Router } = require('express');
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middleware/auth.middleware');
const redisMiddleware = require('../middleware/redis.middleware');

const router = Router();

router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  subscriptionController.getSubscription
);

router.get(
  '/plans',
  redisMiddleware,
  subscriptionController.getPlans
);

router.patch(
  '/plan',
  authMiddleware,
  redisMiddleware,
  subscriptionController.changePlan
);

router.patch(
  '/cancel',
  authMiddleware,
  redisMiddleware,
  subscriptionController.cancelSubscription
);

router.patch(
  '/reactivate',
  authMiddleware,
  redisMiddleware,
  subscriptionController.reactivateSubscription
);

module.exports = router;
