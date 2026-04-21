const User = require('../models/User');
const Product = require('../models/Product');

// @route   GET /api/wishlist
// @desc    Get user's wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate(
            'wishlistItems',
            'name slug images price comparePrice stock averageRating'
        );

        res.status(200).json({
            success: true,
            data: user.wishlistItems || [],
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   POST /api/wishlist/toggle
// @desc    Toggle product in wishlist
// @access  Private
exports.toggleWishlist = async (req, res) => {
    try {
        const { productId } = req.body;

        // Validate productId is provided
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required',
            });
        }

        // Validate product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found. Please refresh and try again.',
            });
        }

        const user = await User.findById(req.user._id);

        // Check if product is already in wishlist
        const index = user.wishlistItems.indexOf(productId);

        if (index > -1) {
            // Remove from wishlist
            user.wishlistItems.splice(index, 1);
        } else {
            // Add to wishlist
            user.wishlistItems.push(productId);
        }

        await user.save();

        // Populate and return
        await user.populate('wishlistItems', 'name slug images price comparePrice stock averageRating');

        res.status(200).json({
            success: true,
            data: {
                wishlist: user.wishlistItems,
                isWishlisted: index < 0, // true if was added, false if removed
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/wishlist/clear
// @desc    Clear entire wishlist
// @access  Private
exports.clearWishlist = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { wishlistItems: [] },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Wishlist cleared',
            data: user.wishlistItems,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
