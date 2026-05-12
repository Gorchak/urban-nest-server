const express = require('express');
const router = express.Router();
const clothesController = require('../controllers/clothesController');

router.get('/', clothesController.getClothes);
router.get('/:id', clothesController.getClothesById);
router.post('/', clothesController.createClothes);
router.put('/:id', clothesController.updateClothes);
router.delete('/:id', clothesController.deleteClothes);

module.exports = router;
