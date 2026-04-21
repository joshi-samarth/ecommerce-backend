const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');
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
        const existing = await Product.findOne(query);
        if (!existing) break;

        count++;
        finalSlug = `${slug}-${count}`;
    }

    return finalSlug;
};

// @route   GET /api/admin/products
// @desc    Get all products (admin view)
// @access  Private/Admin
exports.getAllProductsAdmin = async (req, res) => {
    try {
        const {
            search = '',
            category = '',
            status = 'all',
            lowStock = false,
            page = 1,
            limit = 20,
        } = req.query;

        // Build filter
        const filter = {};

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        if (category) {
            filter.category = category;
        }

        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        if (lowStock === 'true') {
            filter.$expr = { $lte: ['$stock', 10] };
        }

        // Query
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const products = await Product.find(filter)
            .populate('category', 'name slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .exec();

        const total = await Product.countDocuments(filter);
        const pages = Math.ceil(total / parseInt(limit));

        res.status(200).json({
            success: true,
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   GET /api/admin/products/stats
// @desc    Get product statistics
// @access  Private/Admin
exports.getProductStats = async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const activeProducts = await Product.countDocuments({ isActive: true });
        const inactiveProducts = await Product.countDocuments({ isActive: false });
        const outOfStock = await Product.countDocuments({ stock: 0 });
        const lowStock = await Product.countDocuments({
            stock: { $gt: 0, $lte: 10 },
        });
        const featuredProducts = await Product.countDocuments({ isFeatured: true });

        // Calculate total value
        const totalValueAgg = await Product.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: { $multiply: ['$price', '$stock'] },
                    },
                },
            },
        ]);

        const totalValue = totalValueAgg[0]?.total || 0;

        res.status(200).json({
            success: true,
            data: {
                totalProducts,
                activeProducts,
                inactiveProducts,
                outOfStock,
                lowStock,
                featuredProducts,
                totalValue,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   POST /api/admin/products
// @desc    Create product
// @access  Private/Admin
exports.createProduct = async (req, res) => {
    try {
        const { name, description, price, comparePrice, category, tags, stock, isFeatured, isActive } = req.body;

        // Validate required fields
        if (!name || !description || !price || !category || stock === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, description, price, category, and stock',
            });
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(name);

        // Process images from multer
        const images = req.files ? req.files.map((file) => file.path) : [];

        // Parse tags
        const tagsArray = tags
            ? tags
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag)
            : [];

        // Create product
        const product = await Product.create({
            name,
            slug,
            description,
            price: parseFloat(price),
            comparePrice: comparePrice ? parseFloat(comparePrice) : null,
            category,
            tags: tagsArray,
            stock: parseInt(stock),
            images: images.length > 0 ? images : ['https://via.placeholder.com/300x400?text=No+Image'],
            isFeatured: isFeatured === 'true' || isFeatured === true,
            isActive: isActive === 'false' ? false : true, // Default to true unless explicitly false
        });

        // Populate and return
        await product.populate('category', 'name slug');

        res.status(201).json({
            success: true,
            data: product,
        });
    } catch (error) {
        // Delete uploaded images if creation fails
        if (req.files) {
            for (const file of req.files) {
                const publicId = extractPublicId(file.path);
                if (publicId) await deleteFromCloudinary(publicId);
            }
        }

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/admin/products/:id
// @desc    Update product
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, comparePrice, category, tags, stock, isFeatured, isActive, existingImages } =
            req.body;

        // Find product
        const product = await Product.findById(id);
        if (!product) {
            // Clean up new uploads
            if (req.files) {
                for (const file of req.files) {
                    const publicId = extractPublicId(file.path);
                    if (publicId) await deleteFromCloudinary(publicId);
                }
            }

            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Update basic fields
        if (name) {
            product.name = name;
            product.slug = await generateUniqueSlug(name, id);
        }
        if (description) product.description = description;
        if (price) product.price = parseFloat(price);
        if (comparePrice !== undefined) product.comparePrice = comparePrice ? parseFloat(comparePrice) : null;
        if (category) product.category = category;
        if (stock !== undefined) product.stock = parseInt(stock);
        if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true' || isFeatured === true;
        if (isActive !== undefined) product.isActive = isActive === 'false' ? false : true; // Default to true unless explicitly false
        if (tags) {
            product.tags = tags
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag);
        }

        // Handle images - properly merge existing and new
        const hasExistingImages = existingImages !== undefined && existingImages !== null && existingImages !== '';
        const hasNewFiles = req.files && req.files.length > 0;

        if (hasNewFiles) {
            // New files are being uploaded
            const newImageUrls = req.files.map((file) => file.path);

            if (hasExistingImages) {
                // Merge existing images with new ones
                const existingImageList = JSON.parse(existingImages);
                // Filter out placeholder images when adding real images
                const filteredExisting = existingImageList.filter(
                    (img) => !img.includes('placeholder.com')
                );
                product.images = [...filteredExisting, ...newImageUrls];
            } else {
                // No existing images, just use new ones
                product.images = newImageUrls;
            }
        } else if (hasExistingImages) {
            // Only updating the existing images list (deletion case)
            const newImages = JSON.parse(existingImages);
            product.images = newImages.length > 0 ? newImages : product.images; // Keep old if clearing
        }
        // If neither, keep existing product.images as is

        // Save
        await product.save();
        await product.populate('category', 'name slug');

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        // Clean up new uploads
        if (req.files) {
            for (const file of req.files) {
                const publicId = extractPublicId(file.path);
                if (publicId) await deleteFromCloudinary(publicId);
            }
        }

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/admin/products/:id/images
// @desc    Delete specific product image
// @access  Private/Admin
exports.deleteProductImage = async (req, res) => {
    try {
        const { id } = req.params;
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Image URL is required',
            });
        }

        // Find product
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Remove from images array
        product.images = product.images.filter((img) => img !== imageUrl);

        // Delete from Cloudinary
        const publicId = extractPublicId(imageUrl);
        if (publicId) {
            await deleteFromCloudinary(publicId);
        }

        // Save
        await product.save();

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/admin/products/:id/status
// @desc    Toggle product status
// @access  Private/Admin
exports.toggleProductStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        product.isActive = !product.isActive;
        await product.save();

        // Populate category and return full product
        await product.populate('category', 'name slug');

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/admin/products/:id/featured
// @desc    Toggle featured status
// @access  Private/Admin
exports.toggleFeatured = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        product.isFeatured = !product.isFeatured;
        await product.save();

        // Populate category and return full product
        await product.populate('category', 'name slug');

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   PUT /api/admin/products/:id/stock
// @desc    Update stock
// @access  Private/Admin
exports.updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;

        if (stock === undefined || stock < 0) {
            return res.status(400).json({
                success: false,
                message: 'Stock must be a non-negative number',
            });
        }

        const product = await Product.findByIdAndUpdate(id, { stock: parseInt(stock) }, { new: true }).populate(
            'category',
            'name slug'
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/admin/products/:id
// @desc    Soft delete product
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        // Soft delete
        const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true }).populate(
            'category',
            'name slug'
        );
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Remove from all wishlists
        await User.updateMany({}, { $pull: { wishlistItems: id } });

        // Remove from all active carts - remove items where product matches
        await Cart.updateMany({}, { $pull: { items: { product: id } } });

        res.status(200).json({
            success: true,
            message: 'Product deleted',
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @route   DELETE /api/admin/products/:id/hard
// @desc    Permanently delete product
// @access  Private/Admin
exports.hardDeleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Delete all images from Cloudinary
        if (product.images && product.images.length > 0) {
            for (const imageUrl of product.images) {
                const publicId = extractPublicId(imageUrl);
                if (publicId) {
                    await deleteFromCloudinary(publicId).catch((err) => console.error('Delete image error:', err));
                }
            }
        }

        // Remove from wishlists
        await User.updateMany({}, { $pull: { wishlistItems: id } });

        // Remove from carts - remove items where product matches
        await Cart.updateMany({}, { $pull: { items: { product: id } } });

        // Delete product
        await Product.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Product permanently deleted',
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
