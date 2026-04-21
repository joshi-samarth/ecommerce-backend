const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    rating: {
        type: Number,
        required: [true, 'Please provide rating'],
        min: 1,
        max: 5,
    },
    title: {
        type: String,
        trim: true,
    },
    comment: {
        type: String,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide product name'],
        trim: true,
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
    },
    description: {
        type: String,
        default: '',
    },
    price: {
        type: Number,
        required: [true, 'Please provide product price'],
        min: 0,
    },
    comparePrice: {
        type: Number,
        min: 0,
        default: null,
    },
    images: [
        {
            type: String,
            default: 'https://via.placeholder.com/300x400?text=No+Image',
        },
    ],
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Please provide product category'],
    },
    tags: [
        {
            type: String,
            trim: true,
        },
    ],
    stock: {
        type: Number,
        required: [true, 'Please provide product stock'],
        default: 0,
        min: 0,
    },
    sold: {
        type: Number,
        default: 0,
        min: 0,
    },
    ratings: [reviewSchema],
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
    },
    numReviews: {
        type: Number,
        default: 0,
        min: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Pre-save hook to generate slug from name (only if not already provided)
productSchema.pre('save', async function (next) {
    // Only generate slug if not already set and name was provided
    if (this.slug) {
        return next(); // Slug already exists, use it
    }

    if (!this.name) {
        return next(); // No name provided
    }

    // Generate slug from name
    let slug = this.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-'); // Replace spaces with hyphens

    // Handle duplicates
    let existingSlug = await mongoose.model('Product').findOne({ slug });
    let counter = 1;
    let originalSlug = slug;

    while (existingSlug && existingSlug._id.toString() !== this._id.toString()) {
        slug = `${originalSlug}-${counter}`;
        existingSlug = await mongoose.model('Product').findOne({ slug });
        counter++;
    }

    this.slug = slug;
    next();
});

// Virtual for discount percentage
productSchema.virtual('discountPercent').get(function () {
    if (!this.comparePrice || this.comparePrice <= 0) {
        return 0;
    }
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
});

// Ensure virtuals are included in toJSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Method to update average rating after a review is added/removed
productSchema.post('save', async function (doc) {
    if (this.ratings && this.ratings.length > 0) {
        const totalRating = this.ratings.reduce((sum, review) => sum + review.rating, 0);
        const avgRating = totalRating / this.ratings.length;
        this.averageRating = parseFloat(avgRating.toFixed(1));
        this.numReviews = this.ratings.length;
    } else {
        this.averageRating = 0;
        this.numReviews = 0;
    }
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Product', productSchema);
