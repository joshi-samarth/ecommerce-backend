const User = require('../models/User');

// @desc    Seed default admin and user (for demo/testing only)
// @route   POST /api/auth/seed
// @access  Public (for demo purposes only - remove in production)
const seedUsers = async (req, res) => {
    try {
        // Check if users already exist
        const adminExists = await User.findOne({ email: 'admin@example.com' });
        const userExists = await User.findOne({ email: 'user@example.com' });

        if (adminExists && userExists) {
            return res.status(200).json({
                success: true,
                message: 'Demo users already exist',
                data: {
                    admin: {
                        email: 'admin@example.com',
                        password: 'admin123',
                    },
                    user: {
                        email: 'user@example.com',
                        password: 'password123',
                    },
                },
            });
        }

        // Create admin user
        if (!adminExists) {
            await User.create({
                name: 'Admin User',
                email: 'admin@example.com',
                password: 'admin123',
                role: 'admin',
            });
        }

        // Create regular user
        if (!userExists) {
            await User.create({
                name: 'Demo User',
                email: 'user@example.com',
                password: 'password123',
                role: 'user',
            });
        }

        res.status(201).json({
            success: true,
            message: 'Demo users created successfully',
            data: {
                admin: {
                    email: 'admin@example.com',
                    password: 'admin123',
                    role: 'admin',
                },
                user: {
                    email: 'user@example.com',
                    password: 'password123',
                    role: 'user',
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    seedUsers,
};
