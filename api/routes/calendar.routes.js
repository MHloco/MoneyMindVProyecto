const { Router } = require('express');

const calendarController = require('../controllers/calendar.controller');
const authMiddleware = require('../middleware/auth.middleware');
const redisMiddleware = require('../middleware/redis.middleware');

const router = Router();

router.get(
  '/',
  authMiddleware,
  redisMiddleware,
  calendarController.getEvents
);

router.post(
  '/',
  authMiddleware,
  redisMiddleware,
  calendarController.createEvent
);

router.delete(
  '/:id',
  authMiddleware,
  redisMiddleware,
  calendarController.deleteEvent
);

module.exports = router;