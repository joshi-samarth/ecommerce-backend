const express = require('express')
const protect = require('../middleware/protect')
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder
} = require('../controllers/orderController')

const router = express.Router()

// All routes protected with authentication
router.use(protect)

// Create order
router.post('/', createOrder)

// Get user's orders
router.get('/my-orders', getMyOrders)

// Get specific order
router.get('/:id', getOrderById)

// Cancel order
router.put('/:id/cancel', cancelOrder)

module.exports = router
