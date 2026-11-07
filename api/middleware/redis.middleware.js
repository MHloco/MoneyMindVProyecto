const { redisClient } = require('../config/redis');

async function redisMiddleware(req, res, next) {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    req.redis = redisClient;

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = redisMiddleware;