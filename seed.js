require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Coupon = require('./models/Coupon');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce';

const seedData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Category.deleteMany({});
        await Product.deleteMany({});
        await Coupon.deleteMany({});
        console.log('Cleared existing data');

        // Create categories one by one to trigger pre-save hooks
        const categoriesData = [
            {
                name: 'Electronics',
                description: 'Latest electronic devices and gadgets',
                image: 'https://via.placeholder.com/300x200?text=Electronics',
            },
            {
                name: 'Fashion',
                description: 'Trendy clothing and accessories',
                image: 'https://via.placeholder.com/300x200?text=Fashion',
            },
            {
                name: 'Home & Garden',
                description: 'Everything for your home and garden',
                image: 'https://via.placeholder.com/300x200?text=Home+Garden',
            },
            {
                name: 'Sports & Outdoors',
                description: 'Sports equipment and outdoor gear',
                image: 'https://via.placeholder.com/300x200?text=Sports',
            },
        ];

        const categories = [];
        for (const categoryData of categoriesData) {
            const category = new Category(categoryData);
            await category.save();
            categories.push(category);
        }
        console.log('Categories created:', categories.length);

        // Create products one by one to trigger pre-save hooks
        const productsData = [
            // Electronics
            {
                name: 'Wireless Headphones',
                description: 'Premium wireless headphones with noise cancellation',
                price: 4999,
                comparePrice: 7999,
                category: categories[0]._id,
                tags: ['electronics', 'audio', 'wireless'],
                stock: 50,
                images: [
                    'https://via.placeholder.com/400x400?text=Headphones+1',
                    'https://via.placeholder.com/400x400?text=Headphones+2',
                ],
                isFeatured: true,
            },
            {
                name: '4K Webcam',
                description: '4K Ultra HD webcam for streaming and video calls',
                price: 3499,
                comparePrice: 5499,
                category: categories[0]._id,
                tags: ['electronics', 'webcam', 'video'],
                stock: 35,
                images: ['https://via.placeholder.com/400x400?text=Webcam'],
            },
            {
                name: 'USB-C Hub',
                description: 'Multi-port USB-C hub with HDMI, USB 3.0, and SD card reader',
                price: 1999,
                comparePrice: 3499,
                category: categories[0]._id,
                tags: ['electronics', 'usb', 'hub'],
                stock: 100,
                images: ['https://via.placeholder.com/400x400?text=USB+Hub'],
                isFeatured: true,
            },
            {
                name: 'Portable Charger',
                description: '20000mAh fast charging portable power bank',
                price: 1499,
                comparePrice: 2499,
                category: categories[0]._id,
                tags: ['electronics', 'charger', 'power'],
                stock: 80,
                images: ['https://via.placeholder.com/400x400?text=Charger'],
            },

            // Fashion
            {
                name: 'Premium Cotton T-Shirt',
                description: 'Comfortable 100% cotton t-shirt available in multiple colors',
                price: 599,
                comparePrice: 999,
                category: categories[1]._id,
                tags: ['fashion', 'tshirt', 'casual'],
                stock: 200,
                images: ['https://via.placeholder.com/400x400?text=TShirt'],
                isFeatured: true,
            },
            {
                name: 'Casual Sneakers',
                description: 'Comfortable casual sneakers for everyday wear',
                price: 2499,
                comparePrice: 4999,
                category: categories[1]._id,
                tags: ['fashion', 'shoes', 'sneakers'],
                stock: 60,
                images: [
                    'https://via.placeholder.com/400x400?text=Sneakers+1',
                    'https://via.placeholder.com/400x400?text=Sneakers+2',
                ],
            },
            {
                name: 'Denim Jeans',
                description: 'Classic blue denim jeans with perfect fit',
                price: 1899,
                comparePrice: 3499,
                category: categories[1]._id,
                tags: ['fashion', 'jeans', 'casual'],
                stock: 90,
                images: ['https://via.placeholder.com/400x400?text=Jeans'],
            },

            // Home & Garden
            {
                name: 'LED Desk Lamp',
                description: 'Adjustable LED desk lamp with USB charging port',
                price: 899,
                comparePrice: 1499,
                category: categories[2]._id,
                tags: ['home', 'lamp', 'led'],
                stock: 75,
                images: ['https://via.placeholder.com/400x400?text=Desk+Lamp'],
                isFeatured: true,
            },
            {
                name: 'Bamboo Cutting Board Set',
                description: 'Set of 3 eco-friendly bamboo cutting boards',
                price: 799,
                comparePrice: 1399,
                category: categories[2]._id,
                tags: ['home', 'kitchen', 'bamboo'],
                stock: 120,
                images: ['https://via.placeholder.com/400x400?text=Cutting+Boards'],
            },
            {
                name: 'Stainless Steel Water Bottle',
                description: 'Insulated water bottle keeps drinks cold for 24 hours',
                price: 599,
                comparePrice: 1099,
                category: categories[2]._id,
                tags: ['home', 'bottle', 'stainless'],
                stock: 150,
                images: ['https://via.placeholder.com/400x400?text=Water+Bottle'],
            },

            // Sports & Outdoors
            {
                name: 'Yoga Mat',
                description: 'Non-slip TPE yoga mat with carrying strap',
                price: 799,
                comparePrice: 1499,
                category: categories[3]._id,
                tags: ['sports', 'yoga', 'fitness'],
                stock: 140,
                images: ['https://via.placeholder.com/400x400?text=Yoga+Mat'],
            },
            {
                name: 'Dumbbells Set',
                description: 'Adjustable dumbbells set 5-25kg',
                price: 3999,
                comparePrice: 6999,
                category: categories[3]._id,
                tags: ['sports', 'fitness', 'weights'],
                stock: 45,
                images: ['https://via.placeholder.com/400x400?text=Dumbbells'],
                isFeatured: true,
            },
            {
                name: 'Running Shoes',
                description: 'Professional running shoes with cushioned sole',
                price: 2999,
                comparePrice: 5999,
                category: categories[3]._id,
                tags: ['sports', 'shoes', 'running'],
                stock: 70,
                images: ['https://via.placeholder.com/400x400?text=Running+Shoes'],
            },
        ];

        // Save products one by one to trigger pre-save hooks
        const products = [];
        for (const productData of productsData) {
            const product = new Product(productData);
            await product.save();
            products.push(product);
        }
        console.log('Products created:', products.length);

        // Create sample coupons
        const couponsData = [
            {
                code: 'WELCOME10',
                type: 'percent',
                value: 10,
                minOrderValue: 500,
                maxDiscount: 200,
                usageLimit: 0,
                isActive: true,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            },
            {
                code: 'FLAT100',
                type: 'flat',
                value: 100,
                minOrderValue: 1000,
                maxDiscount: 0,
                usageLimit: 0,
                isActive: true,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            },
            {
                code: 'SAVE20',
                type: 'percent',
                value: 20,
                minOrderValue: 2000,
                maxDiscount: 500,
                usageLimit: 0,
                isActive: true,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            },
        ];

        const coupons = [];
        for (const couponData of couponsData) {
            const coupon = new Coupon(couponData);
            await coupon.save();
            coupons.push(coupon);
        }
        console.log('Coupons created:', coupons.length);

        console.log('\n✅ Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedData();
