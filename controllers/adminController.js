const User = require('../models/User');
const OTP = require('../models/OTP');
const mongoose = require('mongoose');
const { generateOTP, sendOTPEmail, verifyOTP } = require('../utils/otpUtils');

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res, next) => {
    try {
        // Fetch all stats in parallel
        const [totalUsers, totalAdmins] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            User.countDocuments({ role: 'admin' }),
        ]);

        // Safe model imports for Product, Order (don't exist yet in Module 2)
        let totalProducts = 0;
        let totalOrders = 0;
        let totalRevenue = 0;

        try {
            const Product = mongoose.model('Product');
            totalProducts = await Product.countDocuments();
        } catch (e) {
            // Product model doesn't exist yet
        }

        try {
            const Order = mongoose.model('Order');
            const [orderCount, revenueData] = await Promise.all([
                Order.countDocuments(),
                Order.aggregate([
                    { $match: { paymentStatus: 'paid' } },
                    { $group: { _id: null, total: { $sum: '$total' } } },
                ]),
            ]);
            totalOrders = orderCount;
            totalRevenue = revenueData[0]?.total || 0;
        } catch (e) {
            // Order model doesn't exist yet
        }

        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                totalAdmins,
                totalProducts,
                totalOrders,
                totalRevenue,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().sort({ createdAt: -1 }).select('-password');

        res.status(200).json({
            success: true,
            data: users,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Validate role
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be either "user" or "admin"',
            });
        }

        // Prevent admin from changing their own role
        if (req.user._id.toString() === id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role',
            });
        }

        const user = await User.findByIdAndUpdate(
            id,
            { role },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            data: user,
            message: `User role updated to ${role}`,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent admin from deleting themselves
        if (req.user._id.toString() === id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account',
            });
        }

        const user = await User.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create admin - Step 1: Validate form & Send OTP
// @route   POST /api/admin/create-admin/send-otp
// @access  Private/Admin
const createAdminSendOTP = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password',
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address',
            });
        }

        // Validate password strength: min 8 chars, uppercase, lowercase, numbers, special chars
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be min 8 characters with uppercase, lowercase, numbers & special chars (@$!%*?&)',
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Delete previous OTPs for this email
        await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'admin_creation' });

        // Save OTP with temporary admin data
        await OTP.create({
            email: email.toLowerCase(),
            otp,
            purpose: 'admin_creation',
            tempData: {
                name,
                password,
            },
        });

        // Send OTP via email in background
        setImmediate(() => {
            sendOTPEmail(email, otp, 'admin_creation').catch((err) => {
                console.error('Background email send failed:', err);
            });
        });

        // Return response immediately
        res.status(200).json({
            success: true,
            message: 'OTP sent successfully to admin email. Check inbox!',
            data: {
                email,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create admin - Step 2: Verify OTP and create account
// @route   POST /api/admin/create-admin/verify-otp
// @access  Private/Admin
const createAdminVerifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        // Validation
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and OTP',
            });
        }

        // Verify OTP
        const otpVerification = await verifyOTP(OTP, email, otp, 'admin_creation');

        if (!otpVerification.success) {
            return res.status(400).json({
                success: false,
                message: otpVerification.message,
            });
        }

        // Get OTP record to retrieve temp data
        const otpRecord = await OTP.findOne({
            email: email.toLowerCase(),
            purpose: 'admin_creation',
            verified: true,
        }).sort({ createdAt: -1 });

        if (!otpRecord || !otpRecord.tempData) {
            return res.status(400).json({
                success: false,
                message: 'OTP data not found. Please try creating admin again.',
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
            });
        }

        // Create new admin with temp data from OTP
        const newAdmin = await User.create({
            name: otpRecord.tempData.name,
            email: email.toLowerCase(),
            password: otpRecord.tempData.password,
            role: 'admin',
        });

        // Delete used OTP
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(201).json({
            success: true,
            message: 'Admin created successfully!',
            data: {
                _id: newAdmin._id,
                name: newAdmin.name,
                email: newAdmin.email,
                role: newAdmin.role,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create admin - OLD (kept for backward compatibility)
// @route   POST /api/admin/create-admin
// @access  Private/Admin (with secret key)
const createAdmin = async (req, res, next) => {
    try {
        const { name, email, password, secretKey } = req.body;

        // Validate secret key
        if (secretKey !== process.env.ADMIN_SECRET_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin secret key',
            });
        }

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email, and password',
            });
        }

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already in use',
            });
        }

        // Create new admin
        const newAdmin = await User.create({
            name,
            email,
            password,
            role: 'admin',
        });

        res.status(201).json({
            success: true,
            data: {
                _id: newAdmin._id,
                name: newAdmin.name,
                email: newAdmin.email,
                role: newAdmin.role,
            },
            message: 'New admin created successfully',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboardStats,
    getAllUsers,
    updateUserRole,
    deleteUser,
    createAdmin,
    createAdminSendOTP,
    createAdminVerifyOTP,
};
