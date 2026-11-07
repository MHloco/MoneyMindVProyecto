const expenseService = require('../services/expense.services');


async function getExpenses(req, res, next) {
  try {
    const userId = req.user.id;

    const {
      startDate,
      endDate,
      categoryId,
      paymentMethod,
      search,
      page,
      limit
    } = req.query;

    const result = await expenseService.getExpenses(
      userId,
      {
        startDate,
        endDate,
        categoryId,
        paymentMethod,
        search,
        page: Number(page) || 1,
        limit: Number(limit) || 10
      },
      req.redis
    );

    res.json(result);

  } catch (error) {
    next(error);
  }
}


async function createExpense(req, res, next) {
  try {
    const userId = req.user.id;

    const {
      amount,
      transaction_date,
      category_id,
      payment_method,
      description,
      notes,
      tags
    } = req.body;

    if (
      !amount ||
      !transaction_date ||
      !category_id ||
      !payment_method ||
      !description
    ) {
      return res.status(400).json({
        message: 'Completa todos los campos obligatorios.'
      });
    }

    const expense = await expenseService.createExpense(
      userId,
      {
        amount,
        transaction_date,
        category_id,
        payment_method,
        description,
        notes,
        tags
      },
      req.redis
    );

    res.status(201).json({ expense });

  } catch (error) {
    next(error);
  }
}


async function updateExpense(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const expense = await expenseService.updateExpense(
      userId,
      id,
      req.body,
      req.redis
    );

    res.json({ expense });

  } catch (error) {
    next(error);
  }
}


async function deleteExpense(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const expense = await expenseService.deleteExpense(
      userId,
      id,
      req.redis
    );

    res.json({ expense });

  } catch (error) {
    next(error);
  }
}

async function getDistribution(req, res, next) {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
      return res.status(400).json({
        message: 'El mes debe tener formato YYYY-MM-DD.'
      });
    }

    const data = await expenseService.getExpenseDistribution(
      userId,
      month,
      req.redis
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getDistribution
};