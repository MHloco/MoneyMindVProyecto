const categoryService = require('../services/category.services');

async function getCategories(req, res, next) {
  try {

    console.log('USER AUTH:', req.user);
    console.log('USER ID:', req.user.id);

    const userId = req.user.id;
    const { type } = req.query;

    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({
        message: 'El tipo debe ser INCOME o EXPENSE.'
      });
    }

    const categories = await categoryService.getCategories(
      userId,
      type,
      req.redis
    );

    res.json({ categories });
  } catch (error) {
    next(error);
  }
}

async function getUserCategories(req, res, next) {

  try {

    console.log('USER AUTH:', req.user);
    console.log('USER ID:', req.user.id);
    console.log('BODY:', req.body);

    const userId = req.user.id;

    const { type } = req.query;

    if (!['INCOME', 'EXPENSE'].includes(type)) {

      return res.status(400).json({
        message: 'El tipo debe ser INCOME o EXPENSE.'
      });

    }

    const categories =
      await categoryService.getUserCategories(
        userId,
        type,
        req.redis
      );

    res.json({
      categories
    });

  } catch (error) {

    next(error);

  }
}

async function createCategory(req, res, next) {
  try {
    const userId = req.user.id;

    const {
      name,
      type,
      color,
      icon,
      parent_id
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        message: 'El nombre y el tipo son obligatorios.'
      });
    }

    const category = await categoryService.createCategory(
      userId,
      {
        name,
        type,
        color,
        icon,
        parent_id
      },
      req.redis
    );

    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const category = await categoryService.updateCategory(
      userId,
      id,
      req.body,
      req.redis
    );

    res.json({ category });
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const category = await categoryService.deleteCategory(
      userId,
      id,
      req.redis
    );

    res.json({ category });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getUserCategories
};