const express = require('express')
const protect = require('../middleware/protect')
const isAdmin = require('../middleware/isAdmin')
const {
  getAllOrders,
  getOrderByIdAdmin,
  updateOrderStatus,
  updatePaymentStatus,
  addOrderNote,
  getOrderStats
} = require('../controllers/adminOrderController')

const router = express.Router()

// All routes protected with authentication + admin role
router.use(protect, isAdmin)

// Get order stats
router.get('/stats', getOrderStats)

// Get all orders
router.get('/', getAllOrders)

// Get specific order
router.get('/:id', getOrderByIdAdmin)

// Update order status
router.put('/:id/status', updateOrderStatus)

// Update payment status
router.put('/:id/payment', updatePaymentStatus)

// Add order note
router.put('/:id/note', addOrderNote)

module.exports = router
