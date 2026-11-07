const budgetService =
  require('../services/budget.services.js');


// ============================================================
// GET
// ============================================================

async function getBudgets(req, res, next) {

  try {

    const userId =
      req.user.id;

    const budgets =
      await budgetService.getBudgets(
        userId,
        req.redis
      );


    res.json({
      budgets
    });

  } catch (error) {

    next(error);

  }
}


// ============================================================
// POST
// ============================================================

async function createBudget(req, res, next) {

  try {

    const userId =
      req.user.id;


    const {
      categoryId,
      name,
      amount,
      currency,
      periodType,
      periodStart,
      periodEnd,
      alertThreshold,
      rollover
    } = req.body;


    if (
      !categoryId ||
      !name ||
      !amount ||
      !periodStart ||
      !periodEnd
    ) {

      return res.status(400).json({
        message:
          'Completa los campos obligatorios.'
      });
    }


    const budget =
      await budgetService.createBudget(
        userId,
        {
          categoryId,
          name,
          amount,
          currency,
          periodType,
          periodStart,
          periodEnd,
          alertThreshold,
          rollover
        },
        req.redis
      );


    res.status(201).json({
      budget
    });

  } catch (error) {

    next(error);

  }
}


// ============================================================
// DELETE
// ============================================================

async function deleteBudget(
  req,
  res,
  next
) {

  try {

    const userId =
      req.user.id;

    const { id } =
      req.params;


    const result =
      await budgetService.deleteBudget(
        userId,
        id,
        req.redis
      );


    res.json(result);

  } catch (error) {

    next(error);

  }
}


module.exports = {
  getBudgets,
  createBudget,
  deleteBudget
};