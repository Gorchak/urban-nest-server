const express = require('express');
const router = express.Router();
const referencesController = require('../controllers/referencesController');

router.get('/', referencesController.getReferences);
router.get('/:id', referencesController.getReferenceById);
router.post('/', referencesController.createReference);
router.put('/:id', referencesController.updateReference);
router.delete('/:id', referencesController.deleteReference);

module.exports = router;
