const express = require('express');
const router = express.Router();
const merchandiseController = require('../controllers/merchandiseController');

// GET /api/merchandise          → list with filtering, sorting, pagination
// GET /api/merchandise/:id      → single item by _id
// POST /api/merchandise         → create
// PUT /api/merchandise/:id      → update
// DELETE /api/merchandise/:id   → soft delete

router.get('/', merchandiseController.getMerchandise);
router.get('/finance/prices', merchandiseController.getFinancePrices);
router.get('/slug/:slug', merchandiseController.getMerchandiseBySlug);
router.get('/:id', merchandiseController.getMerchandiseById);
router.post('/', merchandiseController.createMerchandise);
router.put('/:id', merchandiseController.updateMerchandise);
router.delete('/:id', merchandiseController.deleteMerchandise);

module.exports = router;
