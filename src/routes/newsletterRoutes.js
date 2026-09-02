const router = require('express').Router();
const controller = require('../controllers/newsletterController');
const rateLimit = require('../middleware/newsletterRateLimit');
router.post('/subscribe', rateLimit, controller.subscribe);
router.get('/unsubscribe', controller.unsubscribe);
module.exports = router;
