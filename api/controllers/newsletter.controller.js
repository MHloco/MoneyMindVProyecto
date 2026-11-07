const emailService = require('../services/email.services');

async function subscribe(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        message: 'Por favor ingresa un correo válido.',
      });
    }

    await emailService.sendWelcomeEmail(email);

    return res.status(200).json({
      message: '¡Te has unido con éxito! Revisa tu bandeja de entrada.',
    });
  } catch (error) {
    next(error); // Pasa el error al middleware global de server.js
  }
}

module.exports = {
  subscribe,
};