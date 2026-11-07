const obligationService = require('../services/obligation.services');

async function getSummary(req, res, next) {
  try {
    const data = await obligationService.getSummary(
      req.user.id,
      req.redis
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getObligations(req, res, next) {
  try {
    const data = await obligationService.getObligations(
      req.user.id
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getObligation(req, res, next) {
  try {
    const data = await obligationService.getObligation(
      req.user.id,
      req.params.id
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createObligation(req, res, next) {
  try {
    const {
      name,
      total_amount,
      installments_count,
      start_date
    } = req.body;

    if (
      !name ||
      !total_amount ||
      !installments_count ||
      !start_date
    ) {
      return res.status(400).json({
        message:
          'Nombre, monto total, número de cuotas y fecha de inicio son obligatorios.'
      });
    }

    const data = await obligationService.createObligation(
      req.user.id,
      req.body
    );

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

async function payInstallment(req, res, next) {
  try {
    const data = await obligationService.payInstallment(
      req.user.id,
      req.params.installmentId,
      req.body,
      req.redis
    );

    res.json({
      message: 'Cuota pagada correctamente.',
      ...data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSummary,
  getObligations,
  getObligation,
  createObligation,
  payInstallment
};
