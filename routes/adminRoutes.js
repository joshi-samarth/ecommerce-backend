const express = require('express');
const {
    getDashboardStats,
    getAllUsers,
    updateUserRole,
    deleteUser,
    createAdmin,
    createAdminSendOTP,
    createAdminVerifyOTP,
} = require('../controllers/adminController');
const protect = require('../middleware/protect');
const isAdmin = require('../middleware/isAdmin');

const router = express.Router();

// All routes protected with protect + isAdmin middleware
router.use(protect, isAdmin);

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Admin creation with OTP verification (2-step process)
router.post('/create-admin/send-otp', createAdminSendOTP);
router.post('/create-admin/verify-otp', createAdminVerifyOTP);

// Old admin creation endpoint (kept for backward compatibility)
router.post('/create-admin', createAdmin);

module.exports = router;
