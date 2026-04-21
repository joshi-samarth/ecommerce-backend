const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// For verification
const verifyCloudinaryConfig = () => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('⚠️  Cloudinary credentials not configured');
        return false;
    }
    return true;
};

// Extract public_id from Cloudinary URL
const extractPublicId = (url) => {
    if (!url) return null;
    const match = url.match(/\/([^/]+)\.(jpg|jpeg|png|gif|webp)$/i);
    return match ? `ecommerce/${match[1]}` : null;
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw error;
    }
};

module.exports = {
    cloudinary,
    verifyCloudinaryConfig,
    extractPublicId,
    deleteFromCloudinary,
};
