const express = require('express');
const protect = require('../middleware/protect');
const isAdmin = require('../middleware/isAdmin');
const {
    getAllProductsAdmin,
    getProductStats,
    createProduct,
    updateProduct,
    deleteProductImage,
    toggleProductStatus,
    toggleFeatured,
    updateStock,
    deleteProduct,
    hardDeleteProduct,
} = require('../controllers/adminProductController');
const {
    getAllCategoriesAdmin,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../controllers/adminCategoryController');
const {
    getAllCoupons,
    getCouponStats,
    createCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
} = require('../controllers/adminCouponController');
const { uploadProductImages, uploadCategoryImage, handleUploadErrors } = require('../utils/multer');

const router = express.Router();

// Apply protect & isAdmin to all routes
router.use(protect);
router.use(isAdmin);

// ========= PRODUCTS =========
router.get('/products', getAllProductsAdmin);
router.get('/products/stats', getProductStats);
router.post('/products', uploadProductImages, handleUploadErrors, createProduct);
router.put('/products/:id', uploadProductImages, handleUploadErrors, updateProduct);
router.delete('/products/:id/images', deleteProductImage);
router.put('/products/:id/status', toggleProductStatus);
router.put('/products/:id/featured', toggleFeatured);
router.put('/products/:id/stock', updateStock);
router.delete('/products/:id', deleteProduct);
router.delete('/products/:id/hard', hardDeleteProduct);

// ========= CATEGORIES =========
router.get('/categories', getAllCategoriesAdmin);
router.post('/categories', uploadCategoryImage, handleUploadErrors, createCategory);
router.put('/categories/:id', uploadCategoryImage, handleUploadErrors, updateCategory);
router.delete('/categories/:id', deleteCategory);

// ========= COUPONS =========
router.get('/coupons', getAllCoupons);
router.get('/coupons/stats', getCouponStats);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.put('/coupons/:id/status', toggleCouponStatus);
router.delete('/coupons/:id', deleteCoupon);

module.exports = router;
