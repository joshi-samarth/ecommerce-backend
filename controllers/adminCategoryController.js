const Category = require('../models/Category');
const Product = require('../models/Product');
const { deleteFromCloudinary, extractPublicId } = require('../utils/cloudinary');

// Helper: generate unique slug
const generateUniqueSlug = async (name, excludeId = null) => {
    let slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    let count = 0;
    let finalSlug = slug;

    while (true) {
        const query = { slug: finalSlug };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        const existing = await Category.findOne(query);
        if (!existing) break;

        count++;
        finalSlug = `${slug}-${count}`;
    }

    return finalSlug;
};

// @route   GET /api/admin/categories
// @desc    Get all categories (including inactive)
// @access  Private/Admin
exports.getAllCategoriesAdmin = async (req, res) => {
    try {
        const categories = await Category.aggregate([
            {
                $lookup: {
                    from: 'products',
                    let: { categoryId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$category', '$$categoryId'],
                                },
                            },
                        },
                    ],
                    as: 'products',
                },
            },
            {
                $addFields: {
                    productCount: { $size: '$products' },
                },
            },
            {
                $project: {
                    products: 0,
                },
            },
            {
                $sort: { name: 1 },
            },
        ]);

        res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   POST /api/admin/categories
// @desc    Create category
// @access  Private/Admin
exports.createCategory = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;

        if (!name) {
            // Clean up uploaded image
            if (req.file) {
                const publicId = extractPublicId(req.file.path);
                if (publicId) await deleteFromCloudinary(publicId);
            }

            return res.status(400).json({
                success: false,
                message: 'Category name is required',
            });
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(name);

        // Get image URL
        const image = req.file ? req.file.path : '';

        // Create category
        const category = await Category.create({
            name,
            slug,
            description: description || '',
            image,
            isActive: isActive === 'true' || isActive === true || true,
        });

        res.status(201).json({
            success: true,
            data: category,
        });
    } catch (error) {
        // Clean up uploaded image
        if (req.file) {
            const publicId = extractPublicId(req.file.path);
            if (publicId) await deleteFromCloudinary(publicId);
        }

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/admin/categories/:id
// @desc    Update category
// @access  Private/Admin
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

        const category = await Category.findById(id);
        if (!category) {
            // Clean up uploaded image
            if (req.file) {
                const publicId = extractPublicId(req.file.path);
                if (publicId) await deleteFromCloudinary(publicId);
            }

            return res.status(404).json({
                success: false,
                message: 'Category not found',
            });
        }

        // Update fields
        if (name && name !== category.name) {
            category.name = name;
            category.slug = await generateUniqueSlug(name, id);
        }
        if (description !== undefined) category.description = description;
        if (isActive !== undefined) category.isActive = isActive === 'true' || isActive === true;

        // Handle image
        if (req.file) {
            // Delete old image from Cloudinary
            if (category.image) {
                const oldPublicId = extractPublicId(category.image);
                if (oldPublicId) {
                    await deleteFromCloudinary(oldPublicId).catch((err) => console.error('Delete error:', err));
                }
            }
            category.image = req.file.path;
        }

        await category.save();

        res.status(200).json({
            success: true,
            data: category,
        });
    } catch (error) {
        // Clean up uploaded image
        if (req.file) {
            const publicId = extractPublicId(req.file.path);
            if (publicId) await deleteFromCloudinary(publicId);
        }

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/admin/categories/:id
// @desc    Delete category
// @access  Private/Admin
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Check for active products
        const activeProductCount = await Product.countDocuments({
            category: id,
            isActive: true,
        });

        if (activeProductCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category with ${activeProductCount} active product(s). Reassign them first.`,
            });
        }

        const category = await Category.findByIdAndDelete(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found',
            });
        }

        // Delete image from Cloudinary
        if (category.image) {
            const publicId = extractPublicId(category.image);
            if (publicId) {
                await deleteFromCloudinary(publicId).catch((err) => console.error('Delete error:', err));
            }
        }

        res.status(200).json({
            success: true,
            message: 'Category deleted',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
