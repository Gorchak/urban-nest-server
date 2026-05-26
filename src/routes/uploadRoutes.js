const router = require('express').Router();
const controller = require('../controllers/uploadController');
const upload = require('../middleware/uploadMiddleware');

// POST /api/upload — upload a single image, returns { url, publicId, width, height }
router.post('/', upload.single('image'), controller.upload);

// DELETE /api/upload/:publicId — delete image from Cloudinary by publicId
// Client must URL-encode the publicId (encodeURIComponent) before sending
router.delete('/:publicId', controller.remove);

module.exports = router;
