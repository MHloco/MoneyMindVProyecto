const { Router } = require('express');

const categoryController = require('../controllers/category.controller');
const authMiddleware = require('../middleware/auth.middleware');
const redisMiddleware = require('../middleware/redis.middleware');

const router = Router();

router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  categoryController.getCategories
);

router.get(
  '/user',
  authMiddleware,
  redisMiddleware,
  categoryController.getUserCategories
);

router.post(
  '/',
  authMiddleware,
  redisMiddleware,
  categoryController.createCategory
);

router.put(
  '/:id',
  authMiddleware,
  redisMiddleware,
  categoryController.updateCategory
);

router.delete(
  '/:id',
  authMiddleware,
  redisMiddleware,
  categoryController.deleteCategory
);

module.exports = router;