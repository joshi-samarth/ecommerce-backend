const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    getAvailableCoupons,
} = require('../controllers/cartController');

// Public route - get available coupons
router.get('/coupons/available', getAvailableCoupons);

// All other cart routes are protected
router.use(protect);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCartItem);
router.delete('/remove/:productId', removeFromCart);
router.delete('/clear', clearCart);
router.post('/coupon', applyCoupon);
router.delete('/coupon', removeCoupon);

module.exports = router;
