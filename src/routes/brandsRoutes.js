const router = require('express').Router();
const controller = require('../controllers/brandsController');

router.get('/', controller.getAll);
router.get('/slug/:slug', controller.getBySlug);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
