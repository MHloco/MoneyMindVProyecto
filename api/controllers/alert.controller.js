const alertService = require('../services/alert.services');


async function getAlerts(req, res, next) {

  try {

    const userId = req.user.id;

    const alerts =
      await alertService.getAlerts(
        userId,
        req.redis
      );

    res.json({
      alerts
    });

  } catch (error) {

    next(error);

  }
}


async function markAsRead(req, res, next) {

  try {

    const userId = req.user.id;

    const { id } = req.params;

    const alert =
      await alertService.markAlertAsRead(
        userId,
        id,
        req.redis
      );

    res.json({
      alert
    });

  } catch (error) {

    next(error);

  }
}


module.exports = {
  getAlerts,
  markAsRead
};