const authService = require('../services/auth.services');


// ============================================================
// REGISTER
// ============================================================

async function register(req, res, next) {

  try {

    if (req.body && Object.hasOwn(req.body, 'role')) {
      return res.status(400).json({ message: 'El registro público solo permite crear usuarios normales.' });
    }

    const {
      email,
      password
    } = req.body;


    if (!email || !password) {

      return res.status(400).json({
        message:
          'Correo y contraseña son obligatorios.',
      });
    }


    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {

      return res.status(400).json({
        message:
          'Los datos enviados no son válidos.',
      });
    }


    if (password.length < 8) {

      return res.status(400).json({
        message:
          'La contraseña debe tener como mínimo 8 caracteres.',
      });
    }


    const result =
      await authService.registerUser(
        email,
        password
      );


    return res.status(201).json(result);

  } catch (error) {

    next(error);

  }
}


// ============================================================
// LOGIN
// ============================================================

async function login(req, res, next) {

  try {

    const {
      email,
      password
    } = req.body;


    if (!email || !password) {

      return res.status(400).json({
        message:
          'Correo y contraseña son obligatorios.',
      });
    }


    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {

      return res.status(400).json({
        message:
          'Los datos enviados no son válidos.',
      });
    }


    const result =
      await authService.loginUser(
        email,
        password,
        req.adminLogin === true
      );


    return res.status(200).json(result);

  } catch (error) {

    next(error);

  }
}

async function logout(req, res, next) {
  try {
    const result = await authService.logoutUser();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  logout
};
