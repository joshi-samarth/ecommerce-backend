const Order = require('../models/Order')
const Product = require('../models/Product')
const User = require('../models/User')
const sendEmail = require('../utils/sendEmail')
const { orderStatusUpdateEmail } = require('../utils/emailTemplates')

// Get All Orders (with filters)
const getAllOrders = async (req, res) => {
  try {
    const { status, payment, search, dateFrom, dateTo, page = 1, limit = 20 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const filter = {}

    // Status filter
    if (status) {
      filter.orderStatus = status
    }

    // Payment filter
    if (payment) {
      filter.paymentStatus = payment
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {}
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom)
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo)
      }
    }

    // Search by order number, email, or customer name
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i')
      // Get user IDs matching the search
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id')

      const userIds = matchingUsers.map(u => u._id)

      filter.$or = [
        { orderNumber: searchRegex },
        { user: { $in: userIds } }
      ]
    }

    // Get total count for pagination AFTER applying all filters
    const total = await Order.countDocuments(filter)

    let query = Order.find(filter)
      .populate('user', 'name email')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))

    const orders = await query

    // Get all orders for summary (without pagination)
    const allOrders = await Order.find(filter)
    const summary = {
      placed: allOrders.filter(o => o.orderStatus === 'placed').length,
      confirmed: allOrders.filter(o => o.orderStatus === 'confirmed').length,
      processing: allOrders.filter(o => o.orderStatus === 'processing').length,
      shipped: allOrders.filter(o => o.orderStatus === 'shipped').length,
      delivered: allOrders.filter(o => o.orderStatus === 'delivered').length,
      cancelled: allOrders.filter(o => o.orderStatus === 'cancelled').length,
      totalRevenue: allOrders
        .filter(o => o.paymentStatus === 'paid')
        .reduce((sum, o) => sum + o.total, 0)
    }

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      summary
    })
  } catch (error) {
    console.error('Get all orders error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders'
    })
  }
}

// Get Order By ID (Admin)
const getOrderByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params

    const order = await Order.findById(id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name slug images')
      .populate('statusHistory.updatedBy', 'name')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: order
    })
  } catch (error) {
    console.error('Get order admin error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order'
    })
  }
}

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, note = '' } = req.body

    // Validate status
    const validStatuses = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      })
    }

    const order = await Order.findById(id)
      .populate('items.product', 'stock')
      .populate('user', 'email name')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    // Validate status progression (no going backwards except cancel)
    const statusProgression = ['placed', 'confirmed', 'processing', 'shipped', 'delivered']
    const currentIndex = statusProgression.indexOf(order.orderStatus)
    const newIndex = statusProgression.indexOf(status)

    if (status !== 'cancelled' && status !== 'returned' && newIndex <= currentIndex && currentIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: `Cannot move from ${order.orderStatus} to ${status}. Status can only progress forward.`
      })
    }

    // Update order status
    order.orderStatus = status

    // Handle specific status changes
    if (status === 'shipped') {
      order.estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // +5 days
    }

    if (status === 'delivered') {
      order.deliveredAt = new Date()
      // For COD orders, mark as paid when delivered
      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'paid'
      }
    }

    if (status === 'cancelled') {
      order.cancelledAt = new Date()
      // Restore stock
      for (const item of order.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product._id, {
            $inc: { stock: item.quantity, sold: -item.quantity }
          })
        }
      }
      // Refund if paid
      if (order.paymentStatus === 'paid') {
        order.paymentStatus = 'refunded'
      }
    }

    // Add to status history
    order.statusHistory.push({
      status,
      note,
      updatedBy: req.user._id
    })

    await order.save()

    // Send status update email (non-blocking)
    sendEmail({
      to: order.user.email,
      subject: `Your order #${order.orderNumber} has been ${status}`,
      html: orderStatusUpdateEmail({ order, user: order.user, newStatus: status, note })
    }).catch(err => console.error('Email send failed:', err))

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    })
  } catch (error) {
    console.error('Update order status error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order status'
    })
  }
}

// Update Payment Status
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { paymentStatus } = req.body

    const validStatuses = ['pending', 'paid', 'failed', 'refunded']
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`
      })
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { paymentStatus },
      { new: true }
    )

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Payment status updated',
      data: order
    })
  } catch (error) {
    console.error('Update payment status error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update payment status'
    })
  }
}

// Add Order Note
const addOrderNote = async (req, res) => {
  try {
    const { id } = req.params
    const { note } = req.body

    if (!note || note.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Note cannot be empty'
      })
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { notes: note },
      { new: true }
    )

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Note added',
      data: order
    })
  } catch (error) {
    console.error('Add order note error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add note'
    })
  }
}

// Get Order Stats
const getOrderStats = async (req, res) => {
  try {
    const allOrders = await Order.find()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todaysOrders = allOrders.filter(o => {
      const orderDate = new Date(o.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() === today.getTime()
    })

    const totalRevenue = allOrders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.total, 0)

    const todaysRevenue = todaysOrders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.total, 0)

    const averageOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0

    const stats = {
      totalOrders: allOrders.length,
      totalRevenue,
      ordersToday: todaysOrders.length,
      revenueToday: todaysRevenue,
      averageOrderValue: Math.round(averageOrderValue),
      ordersByStatus: {
        placed: allOrders.filter(o => o.orderStatus === 'placed').length,
        confirmed: allOrders.filter(o => o.orderStatus === 'confirmed').length,
        processing: allOrders.filter(o => o.orderStatus === 'processing').length,
        shipped: allOrders.filter(o => o.orderStatus === 'shipped').length,
        delivered: allOrders.filter(o => o.orderStatus === 'delivered').length,
        cancelled: allOrders.filter(o => o.orderStatus === 'cancelled').length,
        returned: allOrders.filter(o => o.orderStatus === 'returned').length
      }
    }

    return res.status(200).json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Get order stats error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stats'
    })
  }
}

module.exports = {
  getAllOrders,
  getOrderByIdAdmin,
  updateOrderStatus,
  updatePaymentStatus,
  addOrderNote,
  getOrderStats
}
