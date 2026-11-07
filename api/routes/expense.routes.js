const { Router } = require('express');

const expenseController = require('../controllers/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');
const redisMiddleware = require('../middleware/redis.middleware');

const router = Router();


router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  expenseController.getExpenses
);

router.get(
  '/distribution',
  authMiddleware,
  redisMiddleware,
  expenseController.getDistribution
);

router.post(
  '/',
  authMiddleware,
  redisMiddleware,
  expenseController.createExpense
);

router.put(
  '/:id',
  authMiddleware,
  redisMiddleware,
  expenseController.updateExpense
);

router.delete(
  '/:id',
  authMiddleware,
  redisMiddleware,
  expenseController.deleteExpense
);

module.exports = router;