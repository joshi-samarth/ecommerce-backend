const Category = require('../models/Category');
const Product = require('../models/Product');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).lean();

        // Get product count for each category
        const categoriesWithCount = await Promise.all(
            categories.map(async (category) => {
                const count = await Product.countDocuments({
                    category: category._id,
                    isActive: true,
                });
                return {
                    ...category,
                    productCount: count,
                };
            })
        );

        res.status(200).json({
            success: true,
            data: categoriesWithCount,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get category by slug
// @route   GET /api/categories/:slug
// @access  Public
exports.getCategoryBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const category = await Category.findOne({ slug, isActive: true });
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Get products in this category
        const products = await Product.find({
            category: category._id,
            isActive: true,
        })
            .populate('category', 'name slug')
            .lean();

        res.status(200).json({
            success: true,
            data: {
                category,
                products,
                productCount: products.length,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
