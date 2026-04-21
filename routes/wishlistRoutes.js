const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const {
    getWishlist,
    toggleWishlist,
    clearWishlist,
} = require('../controllers/wishlistController');

// All wishlist routes are protected
router.use(protect);

router.get('/', getWishlist);
router.post('/toggle', toggleWishlist);
router.delete('/clear', clearWishlist);

module.exports = router;
