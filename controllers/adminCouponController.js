const Coupon = require('../models/Coupon');

// @route   GET /api/admin/coupons
// @desc    Get all coupons
// @access  Private/Admin
exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: coupons,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   GET /api/admin/coupons/stats
// @desc    Get coupon statistics
// @access  Private/Admin
exports.getCouponStats = async (req, res) => {
    try {
        const totalCoupons = await Coupon.countDocuments();
        const activeCoupons = await Coupon.countDocuments({
            isActive: true,
            expiresAt: { $gt: new Date() },
        });
        const expiredCoupons = await Coupon.countDocuments({
            expiresAt: { $lte: new Date() },
        });

        // Total discount given (0 for now since Order model not implemented yet)
        const totalDiscountGiven = 0;

        res.status(200).json({
            success: true,
            data: {
                totalCoupons,
                activeCoupons,
                expiredCoupons,
                totalDiscountGiven,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   POST /api/admin/coupons
// @desc    Create coupon
// @access  Private/Admin
exports.createCoupon = async (req, res) => {
    try {
        const { code, type, value, minOrderValue, maxDiscount, usageLimit, expiresAt, isActive } = req.body;

        // Validation
        if (!code || !type || value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Code, type, and value are required',
            });
        }

        if (value <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Value must be greater than 0',
            });
        }

        if (type === 'percent' && value > 100) {
            return res.status(400).json({
                success: false,
                message: 'Percentage value cannot exceed 100',
            });
        }

        if (expiresAt && new Date(expiresAt) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Expiration date must be in the future',
            });
        }

        // Check unique code (case-insensitive)
        const existingCoupon = await Coupon.findOne({
            code: code.toUpperCase(),
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists',
            });
        }

        // Create coupon
        const coupon = await Coupon.create({
            code: code.toUpperCase(),
            type,
            value: parseFloat(value),
            minOrderValue: minOrderValue ? parseFloat(minOrderValue) : 0,
            maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
            usageLimit: usageLimit ? parseInt(usageLimit) : 0, // 0 = unlimited
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            isActive: isActive === 'true' || isActive === true,
        });

        res.status(201).json({
            success: true,
            data: coupon,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/admin/coupons/:id
// @desc    Update coupon
// @access  Private/Admin
exports.updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, type, value, minOrderValue, maxDiscount, usageLimit, expiresAt, isActive } = req.body;

        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found',
            });
        }

        // Validation
        if (code && code !== coupon.code) {
            const existingCoupon = await Coupon.findOne({
                code: code.toUpperCase(),
                _id: { $ne: id },
            });
            if (existingCoupon) {
                return res.status(400).json({
                    success: false,
                    message: 'Coupon code already exists',
                });
            }
            coupon.code = code.toUpperCase();
        }

        if (value !== undefined) {
            if (value <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Value must be greater than 0',
                });
            }
            if (type === 'percent' && value > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Percentage value cannot exceed 100',
                });
            }
            coupon.value = parseFloat(value);
        }

        if (expiresAt && new Date(expiresAt) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Expiration date must be in the future',
            });
        }

        // Update fields
        if (type) coupon.type = type;
        if (minOrderValue !== undefined) coupon.minOrderValue = parseFloat(minOrderValue);
        if (maxDiscount !== undefined) coupon.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
        if (usageLimit !== undefined) coupon.usageLimit = parseInt(usageLimit);
        if (expiresAt) coupon.expiresAt = new Date(expiresAt);
        if (isActive !== undefined) coupon.isActive = isActive === 'true' || isActive === true;

        await coupon.save();

        res.status(200).json({
            success: true,
            data: coupon,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/admin/coupons/:id/status
// @desc    Toggle coupon status
// @access  Private/Admin
exports.toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found',
            });
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.status(200).json({
            success: true,
            data: coupon,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/admin/coupons/:id
// @desc    Delete coupon
// @access  Private/Admin
exports.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Coupon deleted',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
