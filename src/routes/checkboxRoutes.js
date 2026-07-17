const express = require('express');
const checkboxController = require('../controllers/checkboxController');
const { protectAuth0, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protectAuth0, requireAdmin);
router.get('/status', checkboxController.getStatus);
router.get('/goods', checkboxController.getGoods);
router.get('/goods/:goodId', checkboxController.getGood);
router.put('/goods/:goodId', checkboxController.updateGood);
router.get('/receipts', checkboxController.getReceipts);
router.get('/finance/totals', checkboxController.getFinanceTotals);
router.post('/sales/:saleId/fiscalize', checkboxController.fiscalizeSale);

module.exports = router;
