const { Router } = require('express');
const incomeController = require('../controllers/income.controller');
const authMiddleware = require('../middleware/auth.middleware');
const redisMiddleware = require('../middleware/redis.middleware');

const router = Router();

router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  incomeController.getIncomes
);

router.get(
  '/metrics',
  authMiddleware,
  redisMiddleware,
  incomeController.getMetrics
);

router.post(
  '/',
  authMiddleware,
  redisMiddleware,
  incomeController.createIncome
);

router.put(
  '/:id',
  authMiddleware,
  redisMiddleware,
  incomeController.updateIncome
);

router.delete(
  '/:id',
  authMiddleware,
  redisMiddleware,
  incomeController.deleteIncome
);

module.exports = router;