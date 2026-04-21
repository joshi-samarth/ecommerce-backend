const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const isAdmin = require('../middleware/isAdmin');
const {
    getAllProducts,
    getFeaturedProducts,
    getProductBySlug,
    getPriceRange,
    addReview,
    deleteReview,
    fixMissingProductData,
} = require('../controllers/productController');

// Public routes - specific routes must come before :slug
router.get('/featured', getFeaturedProducts);
router.get('/price-range', getPriceRange);

// Admin maintenance route (must come before /:slug route)
router.post('/admin-only/fix-missing-data', protect, isAdmin, fixMissingProductData);

// Protected review routes (must come before /:slug route)
router.post('/:slug/reviews', protect, addReview);
router.delete('/:slug/reviews/:reviewId', protect, deleteReview);

// Product by slug (must be after specific routes)
router.get('/:slug', getProductBySlug);

// Get all products (root route)
router.get('/', getAllProducts);

module.exports = router;
