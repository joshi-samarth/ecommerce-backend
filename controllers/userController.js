const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
const getProfile = async (req, res, next) => {
    try {
        // Fetch fresh user data to ensure createdAt is included
        const user = await User.findById(req.user._id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user profile (name and email)
// @route   PUT /api/user/profile
// @access  Private
const updateProfile = async (req, res, next) => {
    try {
        const { name, email } = req.body;
        const userId = req.user._id;

        // Validate input
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name and email',
            });
        }

        // Check if new email is already taken by another user
        if (email !== req.user.email) {
            const emailExists = await User.findOne({ email: email.toLowerCase() });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use',
                });
            }
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            userId,
            { name, email: email.toLowerCase() },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({
            success: true,
            data: user,
            message: 'Profile updated successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Change user password
// @route   PUT /api/user/change-password
// @access  Private
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user._id;

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all fields',
            });
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match',
            });
        }

        // Validate password length
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        // Get user WITH password field
        const user = await User.findById(userId).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Verify current password
        const isPasswordValid = await user.matchPassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect',
            });
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all user addresses
// @route   GET /api/user/addresses
// @access  Private
const getAddresses = async (req, res, next) => {
    try {
        const user = req.user;

        res.status(200).json({
            success: true,
            data: user.addresses,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new address
// @route   POST /api/user/addresses
// @access  Private
const addAddress = async (req, res, next) => {
    try {
        const { fullName, phone, line1, line2, city, state, pincode, country, isDefault } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!fullName || !phone || !line1 || !city || !state || !pincode) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields',
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // If setting as default, remove default from others
        if (isDefault) {
            user.addresses.forEach((addr) => {
                addr.isDefault = false;
            });
        }

        // If this is the first address, make it default
        if (user.addresses.length === 0) {
            user.addresses.push({
                fullName,
                phone,
                line1,
                line2: line2 || '',
                city,
                state,
                pincode,
                country: country || 'India',
                isDefault: true,
            });
        } else {
            user.addresses.push({
                fullName,
                phone,
                line1,
                line2: line2 || '',
                city,
                state,
                pincode,
                country: country || 'India',
                isDefault: isDefault || false,
            });
        }

        await user.save();

        res.status(201).json({
            success: true,
            data: user.addresses,
            message: 'Address added successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update address
// @route   PUT /api/user/addresses/:addressId
// @access  Private
const updateAddress = async (req, res, next) => {
    try {
        const { addressId } = req.params;
        const { fullName, phone, line1, line2, city, state, pincode, country, isDefault } = req.body;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address ID',
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Find address
        const address = user.addresses.id(addressId);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found',
            });
        }

        // If setting as default, remove default from others
        if (isDefault) {
            user.addresses.forEach((addr) => {
                addr.isDefault = false;
            });
        }

        // Update fields
        if (fullName) address.fullName = fullName;
        if (phone) address.phone = phone;
        if (line1) address.line1 = line1;
        if (line2 !== undefined) address.line2 = line2;
        if (city) address.city = city;
        if (state) address.state = state;
        if (pincode) address.pincode = pincode;
        if (country) address.country = country;
        if (isDefault !== undefined) address.isDefault = isDefault;

        await user.save();

        res.status(200).json({
            success: true,
            data: user.addresses,
            message: 'Address updated successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete address
// @route   DELETE /api/user/addresses/:addressId
// @access  Private
const deleteAddress = async (req, res, next) => {
    try {
        const { addressId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address ID',
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check if address exists
        const address = user.addresses.id(addressId);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found',
            });
        }

        const wasDefault = address.isDefault;

        // Remove address
        user.addresses.id(addressId).deleteOne();

        // If deleted address was default and others exist, set first as default
        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }

        await user.save();

        res.status(200).json({
            success: true,
            data: user.addresses,
            message: 'Address deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Set default address
// @route   PUT /api/user/addresses/:addressId/default
// @access  Private
const setDefaultAddress = async (req, res, next) => {
    try {
        const { addressId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address ID',
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check if address exists
        const address = user.addresses.id(addressId);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found',
            });
        }

        // Set all to false
        user.addresses.forEach((addr) => {
            addr.isDefault = false;
        });

        // Set target to true
        address.isDefault = true;

        await user.save();

        res.status(200).json({
            success: true,
            data: user.addresses,
            message: 'Default address updated successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get user orders (placeholder)
// @route   GET /api/user/orders
// @access  Private
const getMyOrders = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: [],
            message: 'Orders feature coming in Module 7',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getMyOrders,
};
