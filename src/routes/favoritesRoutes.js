const express = require('express');
const favoritesController = require('../controllers/favoritesController');
const { protectAuth0 } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectAuth0);
router.get('/', favoritesController.getFavorites);
router.post('/', favoritesController.addFavorite);
router.delete('/:merchandiseId', favoritesController.removeFavorite);

module.exports = router;
