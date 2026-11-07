const subscriptionService = require('../services/subscription.services');

async function getSubscription(req, res, next) {
  try {
    const userId = req.user.id;

    const subscription = await subscriptionService.getSubscription(
      userId,
      req.redis
    );

    res.json(subscription);
  } catch (error) {
    next(error);
  }
}

async function getPlans(req, res, next) {
  try {
    const plans = await subscriptionService.getPlans(req.redis);

    res.json(plans);
  } catch (error) {
    next(error);
  }
}

async function changePlan(req, res, next) {
  try {
    const userId = req.user.id;
    const { planCode } = req.body;

    if (!planCode) {
      return res.status(400).json({
        message: 'El plan es obligatorio.'
      });
    }

    const subscription = await subscriptionService.changePlan(
      userId,
      planCode,
      req.redis
    );

    res.json(subscription);
  } catch (error) {
    next(error);
  }
}

async function cancelSubscription(req, res, next) {
  try {
    const userId = req.user.id;

    const subscription =
      await subscriptionService.cancelSubscription(
        userId,
        req.redis
      );

    res.json(subscription);
  } catch (error) {
    next(error);
  }
}

async function reactivateSubscription(req, res, next) {
  try {
    const userId = req.user.id;

    const subscription =
      await subscriptionService.reactivateSubscription(
        userId,
        req.redis
      );

    res.json(subscription);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSubscription,
  getPlans,
  changePlan,
  cancelSubscription,
  reactivateSubscription
};