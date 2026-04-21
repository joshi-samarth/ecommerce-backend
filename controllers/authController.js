const User = require('../models/User');
const OTP = require('../models/OTP');
const generateToken = require('../utils/generateToken');
const { generateOTP, sendOTPEmail, verifyOTP } = require('../utils/otpUtils');

// @desc    Register user - Step 1: Validate form & Send OTP
// @route   POST /api/auth/register/send-otp
// @access  Public
const sendRegistrationOTP = async (req, res) => {
    try {
        const { email, name, password } = req.body;

        // Validation
        if (!email || !name || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, name and password'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Validate password strength: min 8 chars, uppercase, lowercase, numbers, special chars
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be min 8 characters with uppercase, lowercase, numbers & special chars (@$!%*?&)'
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Delete previous OTPs for this email
        await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'user_registration' });

        // Save OTP with temporary user data
        await OTP.create({
            email: email.toLowerCase(),
            otp,
            purpose: 'user_registration',
            tempData: {
                name,
                password,
            }
        });

        // Send OTP via email in background (DON'T WAIT - faster response)
        setImmediate(() => {
            sendOTPEmail(email, otp, 'user_registration').catch(err => {
                console.error('Background email send failed:', err);
            });
        });

        // Return response immediately
        res.status(200).json({
            success: true,
            message: 'OTP sent successfully to your email. Check your inbox!',
            data: {
                email
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Register user - Step 2: Verify OTP and create account
// @route   POST /api/auth/register/verify-otp
// @access  Public
const verifyRegistrationOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Validation
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and OTP'
            });
        }

        // Verify OTP
        const otpVerification = await verifyOTP(OTP, email, otp, 'user_registration');

        if (!otpVerification.success) {
            return res.status(400).json({
                success: false,
                message: otpVerification.message
            });
        }

        // Get OTP record to retrieve temp data
        const otpRecord = await OTP.findOne({
            email: email.toLowerCase(),
            purpose: 'user_registration',
            verified: true
        }).sort({ createdAt: -1 });

        if (!otpRecord || !otpRecord.tempData) {
            return res.status(400).json({
                success: false,
                message: 'OTP data not found. Please try registering again.'
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create user with temp data from OTP
        const user = await User.create({
            name: otpRecord.tempData.name,
            email: email.toLowerCase(),
            password: otpRecord.tempData.password
        });

        // Delete used OTP
        await OTP.deleteOne({ _id: otpRecord._id });

        // Generate token
        generateToken(res, user._id);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Register user (OLD - without OTP) - KEPT FOR BACKWARD COMPATIBILITY
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    // Redirect to new OTP flow
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please use the new registration flow. Step 1: POST /api/auth/register/send-otp'
            });
        }

        // Call sendRegistrationOTP
        await sendRegistrationOTP(req, res);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Login user (regular user login - NO OTP for users, only for admin)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // If user is admin, reject with generic message (security: don't reveal role)
        if (user.role === 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token for regular users
        generateToken(res, user._id);

        // Remove password from response
        user.password = undefined;

        // Return success response
        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = (req, res) => {
    res.clearCookie('jwt');

    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = (req, res) => {
    try {
        const user = req.user;

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============ ADMIN OTP LOGIN (2FA) ============

// @desc    Admin Login - Step 1: Verify password and send OTP
// @route   POST /api/auth/admin/login
// @access  Public
const adminLoginSendOTP = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check for admin user
        const admin = await User.findOne({ email }).select('+password');

        if (!admin || admin.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        // Check if password matches
        const isMatch = await admin.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Delete previous OTPs for this admin
        await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'admin_login' });

        // Save OTP
        await OTP.create({
            email: email.toLowerCase(),
            otp,
            purpose: 'admin_login'
        });

        // Send OTP via email in background (DON'T WAIT - faster response)
        setImmediate(() => {
            sendOTPEmail(email, otp, 'admin_login').catch(err => {
                console.error('Background email send failed:', err);
            });
        });

        // Return response immediately with OTP expiry hint
        res.status(200).json({
            success: true,
            message: 'OTP sent to your email! Check your inbox (expires in 10 minutes)',
            data: {
                email,
                tempSessionId: admin._id.toString(),
                otpExpiry: 10 // minutes
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Admin Login - Step 2: Verify OTP and grant access
// @route   POST /api/auth/admin/verify-otp
// @access  Public
const adminLoginVerifyOTP = async (req, res) => {
    try {
        const { email, otp, tempSessionId } = req.body;

        // Validation
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and OTP'
            });
        }

        // Verify OTP
        const otpVerification = await verifyOTP(OTP, email, otp, 'admin_login');

        if (!otpVerification.success) {
            return res.status(400).json({
                success: false,
                message: otpVerification.message
            });
        }

        // Get admin user
        const admin = await User.findOne({ email: email.toLowerCase() });

        if (!admin || admin.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Delete used OTP
        await OTP.deleteOne({ email: email.toLowerCase(), purpose: 'admin_login', verified: true });

        // Generate token
        generateToken(res, admin._id);

        res.status(200).json({
            success: true,
            message: 'Admin login verified successfully',
            data: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Resend OTP (for both registration and admin login)
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
    try {
        let { email, type } = req.body; // type: 'user_registration', 'admin_login', 'admin_creation'

        if (!email || !type) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and type'
            });
        }

        // Map various formats from frontend to snake_case for backend
        const purposeMap = {
            // User registration
            'registration': 'user_registration',
            'user-registration': 'user_registration',
            'user_registration': 'user_registration',
            // Admin login
            'admin-login': 'admin_login',
            'admin_login': 'admin_login',
            // Admin creation
            'admin': 'admin_creation',
            'admin-creation': 'admin_creation',
            'admin_creation': 'admin_creation'
        };

        const purpose = purposeMap[type];
        if (!purpose) {
            return res.status(400).json({
                success: false,
                message: 'Invalid purpose'
            });
        }

        // Check if OTP exists
        const otpRecord = await OTP.findOne({
            email: email.toLowerCase(),
            purpose,
            verified: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'No pending OTP found. Please start fresh.'
            });
        }

        // Generate new OTP
        const newOtp = generateOTP();
        otpRecord.otp = newOtp;
        otpRecord.attempts = 0;
        await otpRecord.save();

        // Send OTP via email
        const emailResult = await sendOTPEmail(email, newOtp, purpose);

        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to resend OTP. Please try again.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'OTP resent successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Change Password (Admin or User)
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user._id;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current password, new password and confirmation'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        // Validate password strength: min 8 chars, uppercase, lowercase, numbers, special chars
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be min 8 characters with uppercase, lowercase, numbers & special chars (@$!%*?&)'
            });
        }

        // Get user with password
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if current password matches
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Send Password Reset OTP
// @route   POST /api/auth/forget-password/send-otp
// @access  Public
const sendPasswordResetOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email address'
            });
        }

        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if email exists for security
            return res.status(200).json({
                success: true,
                message: 'If this email exists in our system, password reset link has been sent'
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Delete previous OTPs for this email
        await OTP.deleteMany({ email: email.toLowerCase(), purpose: 'password_reset' });

        // Save OTP
        await OTP.create({
            email: email.toLowerCase(),
            otp,
            purpose: 'password_reset'
        });

        // Send OTP via email
        setImmediate(() => {
            sendOTPEmail(email, otp, 'password_reset').catch(err => {
                console.error('Background email send failed:', err);
            });
        });

        res.status(200).json({
            success: true,
            message: 'Password reset OTP sent to your email. Check your inbox!',
            data: {
                email
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Verify Password Reset OTP and Reset Password
// @route   POST /api/auth/forget-password/reset
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        // Validation
        if (!email || !otp || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, OTP, new password and confirmation'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be min 8 characters with uppercase, lowercase, numbers & special chars (@$!%*?&)'
            });
        }

        // Verify OTP
        const otpVerification = await verifyOTP(OTP, email, otp, 'password_reset');

        if (!otpVerification.success) {
            return res.status(400).json({
                success: false,
                message: otpVerification.message
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Delete used OTP
        await OTP.deleteOne({ email: email.toLowerCase(), purpose: 'password_reset', verified: true });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Verify Admin Secret Key (for forgot password)
// @route   POST /api/auth/verify-admin-secret
// @access  Public
const verifyAdminSecret = async (req, res) => {
    try {
        const { secretKey } = req.body;

        if (!secretKey) {
            return res.status(400).json({
                success: false,
                message: 'Secret key is required'
            });
        }

        // Compare with backend secret key
        if (secretKey !== process.env.ADMIN_SECRET_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin secret key'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Secret key verified successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    registerUser,
    sendRegistrationOTP,
    verifyRegistrationOTP,
    loginUser,
    adminLoginSendOTP,
    adminLoginVerifyOTP,
    resendOTP,
    logoutUser,
    getMe,
    changePassword,
    sendPasswordResetOTP,
    resetPassword,
    verifyAdminSecret
};
