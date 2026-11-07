const dashboardService = require('../services/dashboard.services');

async function getDashboard(req, res, next) {
  try {
    const userId = req.user.id;

    const { month, type, category, page } = req.query;
    const dashboard = await dashboardService.getDashboardData(userId, { month, type, category, page });

    return res.status(200).json(dashboard);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard
};
