const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Token de autenticación requerido.'
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    req.user = {
      id: decoded.sub,
      email: decoded.email
    };

    next();

  } catch (error) {
    return res.status(401).json({
      message: 'Token inválido o expirado.'
    });
  }
}

module.exports = authMiddleware;