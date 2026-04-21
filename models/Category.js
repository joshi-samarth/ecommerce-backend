const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide category name'],
        unique: true,
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
    image: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Pre-save hook to generate slug from name
categorySchema.pre('save', async function (next) {
    if (!this.isModified('name')) {
        return next();
    }

    // Generate slug from name
    let slug = this.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-'); // Replace spaces with hyphens

    // Handle duplicates
    let existingSlug = await mongoose.model('Category').findOne({ slug });
    let counter = 1;
    let originalSlug = slug;

    while (existingSlug && existingSlug._id.toString() !== this._id.toString()) {
        slug = `${originalSlug}-${counter}`;
        existingSlug = await mongoose.model('Category').findOne({ slug });
        counter++;
    }

    this.slug = slug;
    next();
});

module.exports = mongoose.model('Category', categorySchema);
