const express = require('express');
const cartsController = require('../controllers/cartsController');
const { optionalAuth0 } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(optionalAuth0);
router.get('/', cartsController.getCart);
router.post('/items', cartsController.addItem);
router.put('/items/:key', cartsController.updateItem);
router.delete('/items/:key', cartsController.removeItem);
router.delete('/items', cartsController.clearCart);
router.delete('/', cartsController.deleteCart);

module.exports = router;
