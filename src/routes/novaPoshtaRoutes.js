const express = require('express');
const router = express.Router();
const novaPoshtaController = require('../controllers/novaPoshtaController');

router.get('/areas', novaPoshtaController.getAreas);
router.get('/cities', novaPoshtaController.getCities);
router.get('/warehouses', novaPoshtaController.getWarehouses);

module.exports = router;
