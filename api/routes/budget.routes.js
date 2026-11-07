const { Router } = require('express');

const budgetController =
  require('../controllers/budget.controller');

const authMiddleware =
  require('../middleware/auth.middleware');

const redisMiddleware =
  require('../middleware/redis.middleware');


const router = Router();


router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  budgetController.getBudgets
);


router.post(
  '/',
  authMiddleware,
  redisMiddleware,
  budgetController.createBudget
);


router.delete(
  '/:id',
  authMiddleware,
  redisMiddleware,
  budgetController.deleteBudget
);


module.exports = router;