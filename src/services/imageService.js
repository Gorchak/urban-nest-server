const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

/**
 * Uploads a file buffer to Cloudinary via a streaming upload.
 * Applies automatic quality and format optimisations at upload time.
 *
 * @param {Express.Multer.File} file   - multer file object (requires .buffer)
 * @param {string}              folder - Cloudinary folder name (default: 'urban-nest')
 * @returns {Promise<{url, publicId, width, height}>}
 */
async function uploadImage(file, folder = 'urban-nest') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        overwrite: false,
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

/**
 * Deletes an image from Cloudinary by its public_id.
 *
 * @param {string} publicId - Cloudinary public_id (may contain slashes, e.g. 'urban-nest/abc123')
 * @returns {Promise<{result: string}>}
 */
async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadImage, deleteImage };
