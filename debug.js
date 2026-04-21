const productController = require('./controllers/productController');

console.log('All exports:', Object.keys(productController));
console.log('addReview type:', typeof productController.addReview);
console.log('deleteReview type:', typeof productController.deleteReview);

// Try creating routes
const express = require('express');
const { protect } = require('./middleware/protect');

const router = express.Router();

try {
    // Try adding protected routes
    router.post('/:productId/reviews', protect, productController.addReview);
    console.log('POST route added successfully');
} catch (error) {
    console.error('Error adding POST route:', error.message);
}

try {
    router.delete('/:productId/reviews/:reviewId', protect, productController.deleteReview);
    console.log('DELETE route added successfully');
} catch (error) {
    console.error('Error adding DELETE route:', error.message);
}
