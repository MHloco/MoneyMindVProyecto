const incomeService = require('../services/income.services');

async function getIncomes(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await incomeService.getIncomes(
      userId,
      req.query,
      req.redis
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createIncome(req, res, next) {
  try {
    const userId = req.user.id;

    const {
      amount,
      transaction_date,
      category_id,
      source,
      payment_method,
      notes
    } = req.body;

    if (!amount || !transaction_date || !payment_method) {
      return res.status(400).json({
        message: 'Monto, fecha y método de cobro son obligatorios.'
      });
    }

    const income = await incomeService.createIncome(
      userId,
      {
        amount,
        transaction_date,
        category_id,
        source,
        payment_method,
        notes
      },
      req.redis
    );

    res.status(201).json(income);
  } catch (error) {
    next(error);
  }
}

async function updateIncome(req, res, next) {
  try {
    const userId = req.user.id;

    const income = await incomeService.updateIncome(
      userId,
      req.params.id,
      req.body,
      req.redis
    );

    res.json(income);
  } catch (error) {
    next(error);
  }
}

async function deleteIncome(req, res, next) {
  try {
    const userId = req.user.id;

    await incomeService.deleteIncome(
      userId,
      req.params.id,
      req.redis
    );

    res.json({
      message: 'Ingreso eliminado correctamente.'
    });
  } catch (error) {
    next(error);
  }
}

async function getMetrics(req, res, next) {
  try {
    const userId = req.user.id;

    const metrics = await incomeService.getIncomeMetrics(
      userId,
      req.redis
    );

    res.json(metrics);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getIncomes,
  createIncome,
  updateIncome,
  deleteIncome,
  getMetrics
};