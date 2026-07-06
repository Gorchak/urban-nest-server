const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { optionalAuth0, protectAuth0 } = require('../middleware/authMiddleware');

router.get('/', salesController.getSales);
router.get('/finance/totals', salesController.getFinanceTotals);
router.post('/checkout', optionalAuth0, salesController.checkout);
router.get('/my', protectAuth0, salesController.getMySales);
router.get('/:id', salesController.getSaleById);
router.post('/', salesController.createSale);
router.put('/:id', salesController.updateSale);
router.delete('/:id', salesController.deleteSale);

module.exports = router;
