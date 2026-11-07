const { Router } = require('express');

const dashboardController =
  require('../controllers/dashboard.controller');

const authMiddleware =
  require('../middleware/auth.middleware');

const router = Router();

router.get(
  '/',
  authMiddleware,
  dashboardController.getDashboard
);

module.exports = router;