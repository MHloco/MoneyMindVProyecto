const { Router } = require('express');

const obligationController = require('../controllers/obligation.controller');
const authMiddleware = require('../middleware/auth.middleware');
const redisMiddleware = require('../middleware/redis.middleware');

const router = Router();

router.get(
  '/summary',
  authMiddleware,
  redisMiddleware,
  obligationController.getSummary
);

router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  obligationController.getObligations
);

router.get(
  '/:id',
  authMiddleware,
  redisMiddleware,
  obligationController.getObligation
);

router.post(
  '/',
  authMiddleware,
  redisMiddleware,
  obligationController.createObligation
);

router.post(
  '/installments/:installmentId/pay',
  authMiddleware,
  redisMiddleware,
  obligationController.payInstallment
);

module.exports = router;