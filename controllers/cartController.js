const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
exports.getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product', 'name slug images price stock isActive')
            .populate('coupon', 'code type value');

        // If no cart exists, return empty structure
        if (!cart) {
            return res.status(200).json({
                success: true,
                data: {
                    items: [],
                    subtotal: 0,
                    discount: 0,
                    total: 0,
                    itemCount: 0,
                    coupon: null,
                },
            });
        }

        // Auto-clean: remove items where product is inactive or doesn't exist
        cart.items = cart.items.filter((item) => item.product && item.product.isActive);

        // Auto-fix: reduce quantity if exceeds stock
        for (let item of cart.items) {
            if (item.quantity > item.product.stock) {
                item.quantity = item.product.stock;
            }
        }

        // Remove coupon if no items left
        if (cart.items.length === 0) {
            cart.coupon = null;
            cart.discount = 0;
        }

        await cart.save();

        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;

        // Validate product exists and is active
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Product not found or is no longer available',
            });
        }

        // Validate quantity
        if (quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be at least 1',
            });
        }

        // Check stock
        if (quantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stock} left in stock`,
            });
        }

        // Find or create cart
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
        }

        // Check if product already in cart
        const existingItem = cart.items.find(
            (item) => item.product.toString() === productId
        );

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.stock - existingItem.quantity} more can be added`,
                });
            }
            existingItem.quantity = newQuantity;
        } else {
            cart.items.push({
                product: productId,
                quantity,
                price: product.price,
            });
        }

        // Check if coupon still valid with new cart
        if (cart.coupon) {
            const coupon = await Coupon.findById(cart.coupon);
            if (!coupon || !coupon.isActive || coupon.expiresAt < new Date()) {
                cart.coupon = null;
                cart.discount = 0;
            } else if (cart.subtotal < coupon.minOrderValue) {
                cart.coupon = null;
                cart.discount = 0;
            }
        }

        await cart.save();
        await cart.populate('items.product', 'name slug images price stock isActive');
        await cart.populate('coupon', 'code type value');

        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/cart/update
// @desc    Update cart item quantity
// @access  Private
exports.updateCartItem = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // Validate quantity
        if (quantity < 1) {
            return exports.removeFromCart(req, res);
        }

        // Get product to check stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        if (quantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stock} available in stock`,
            });
        }

        // Find cart and update
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found',
            });
        }

        const item = cart.items.find((item) => item.product.toString() === productId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not in cart',
            });
        }

        item.quantity = quantity;

        // Recalculate discount if coupon applied
        if (cart.coupon && cart.subtotal < (await Coupon.findById(cart.coupon)).minOrderValue) {
            cart.coupon = null;
            cart.discount = 0;
        }

        await cart.save();
        await cart.populate('items.product', 'name slug images price stock isActive');
        await cart.populate('coupon', 'code type value');

        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/cart/remove/:productId
// @desc    Remove item from cart
// @access  Private
exports.removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found',
            });
        }

        cart.items = cart.items.filter((item) => item.product.toString() !== productId);

        // Check if coupon still applies
        if (cart.coupon && cart.items.length > 0) {
            const coupon = await Coupon.findById(cart.coupon);
            if (coupon && cart.subtotal < coupon.minOrderValue) {
                cart.coupon = null;
                cart.discount = 0;
            }
        } else if (cart.items.length === 0) {
            cart.coupon = null;
            cart.discount = 0;
        }

        await cart.save();
        await cart.populate('items.product', 'name slug images price stock isActive');
        await cart.populate('coupon', 'code type value');

        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/cart/clear
// @desc    Clear entire cart
// @access  Private
exports.clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOneAndUpdate(
            { user: req.user._id },
            { items: [], coupon: null, discount: 0 },
            { new: true }
        );

        res.status(200).json({
            success: true,
            data: cart || { items: [], subtotal: 0, discount: 0, total: 0, itemCount: 0 },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   POST /api/cart/coupon
// @desc    Apply coupon to cart
// @access  Private
exports.applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code is required',
            });
        }

        // Find coupon (case-insensitive)
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coupon code',
            });
        }

        if (!coupon.isActive) {
            return res.status(400).json({
                success: false,
                message: 'This coupon is no longer active',
            });
        }

        if (coupon.expiresAt < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has expired',
            });
        }

        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: 'Coupon usage limit reached',
            });
        }

        // Get cart
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found',
            });
        }

        if (cart.subtotal < coupon.minOrderValue) {
            return res.status(400).json({
                success: false,
                message: `Minimum order value of ₹${coupon.minOrderValue} required`,
            });
        }

        // Calculate discount
        let discount;
        if (coupon.type === 'percent') {
            discount = (cart.subtotal * coupon.value) / 100;
            if (coupon.maxDiscount > 0) {
                discount = Math.min(discount, coupon.maxDiscount);
            }
        } else {
            discount = Math.min(coupon.value, cart.subtotal);
        }

        cart.coupon = coupon._id;
        cart.discount = discount;
        await cart.save();
        await cart.populate('items.product', 'name slug images price stock isActive');
        await cart.populate('coupon', 'code type value');

        res.status(200).json({
            success: true,
            data: {
                cart,
                discount,
                couponCode: coupon.code,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/cart/coupon
// @desc    Remove coupon from cart
// @access  Private
exports.removeCoupon = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found',
            });
        }

        cart.coupon = null;
        cart.discount = 0;
        await cart.save();
        await cart.populate('items.product', 'name slug images price stock isActive');

        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   GET /api/coupons/available
// @desc    Get available coupons for users (excluding used up coupons)
// @access  Public
exports.getAvailableCoupons = async (req, res) => {
    try {
        const availableCoupons = await Coupon.find({
            isActive: true,
            expiresAt: { $gt: new Date() },
            $or: [
                { usageLimit: 0 }, // Unlimited usage
                { $expr: { $lt: ['$usedCount', '$usageLimit'] } } // Haven't reached limit
            ]
        }).select('code type value minOrderValue maxDiscount usageLimit usedCount').sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: availableCoupons,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
