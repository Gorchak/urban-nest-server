const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');

router.get('/', categoriesController.getCategories);
router.get('/:id', categoriesController.getCategoriesById);
router.post('/', categoriesController.createCategories);
router.put('/:id', categoriesController.updateCategories);
router.delete('/:id', categoriesController.deleteCategories);

module.exports = router;
