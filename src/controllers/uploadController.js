const imageService = require('../services/imageService');

/**
 * POST /api/upload
 * Expects: multipart/form-data with field "image"
 * Returns: { url, publicId, width, height }
 */
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image required' });
    }

    const image = await imageService.uploadImage(req.file);
    res.json(image);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/upload/:publicId
 * Deletes the image from Cloudinary.
 * The publicId must be URL-encoded (encodeURIComponent) by the client
 * since it can contain slashes (e.g. "urban-nest/abc123").
 */
exports.remove = async (req, res, next) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    const result = await imageService.deleteImage(publicId);
    res.json({ result });
  } catch (error) {
    next(error);
  }
};
