const Order = require('../models/Order')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const Coupon = require('../models/Coupon')
const User = require('../models/User')
const sendEmail = require('../utils/sendEmail')
const {
  orderConfirmationEmail,
  orderCancellationEmail,
  orderStatusUpdateEmail
} = require('../utils/emailTemplates')

// Create Order
const createOrder = async (req, res) => {
  try {
    const userId = req.user._id
    const { shippingAddress, paymentMethod = 'cod' } = req.body

    // a) Fetch user's cart
    let cart = await Cart.findOne({ user: userId }).populate('items.product')
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Add items before checkout.'
      })
    }

    // b) Validate all cart items
    const invalidItems = []
    for (const item of cart.items) {
      if (!item.product) {
        invalidItems.push(`Product not found for item`)
      } else if (!item.product.isActive) {
        invalidItems.push(`${item.product.name} is no longer available`)
      } else if (item.product.stock < item.quantity) {
        invalidItems.push(
          `${item.product.name} has only ${item.product.stock} in stock (requested ${item.quantity})`
        )
      }
    }

    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to checkout. Please fix these items:',
        invalidItems
      })
    }

    // c) Validate and prepare shipping address
    let address = shippingAddress

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      })
    }

    const requiredFields = ['fullName', 'phone', 'line1', 'city', 'state', 'pincode']
    const missingFields = requiredFields.filter(field => !address[field])
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required address fields: ${missingFields.join(', ')}`
      })
    }

    // d) Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + item.price * item.quantity
    }, 0)

    const discount = cart.discount || 0
    const shippingCharge = subtotal > 500 ? 0 : 50
    const total = subtotal - discount + shippingCharge

    // e) Build order items array (snapshots)
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      name: item.product.name,
      image: item.product.images[0] || '',
      price: item.price,
      quantity: item.quantity
    }))

    // f) Create Order document
    const order = new Order({
      user: userId,
      items: orderItems,
      shippingAddress: address,
      subtotal,
      discount,
      shippingCharge,
      total,
      couponCode: cart.coupon ? cart.coupon.code : '',
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'placed'
    })

    // Add initial status history entry
    order.statusHistory.push({
      status: 'placed',
      note: 'Order placed successfully',
      updatedBy: userId
    })

    await order.save()

    // g) Reduce stock for each product
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        {
          $inc: { stock: -item.quantity, sold: item.quantity }
        },
        { new: true }
      )
    }

    // h) Increment coupon usedCount if applied
    if (cart.coupon) {
      await Coupon.findByIdAndUpdate(
        cart.coupon._id,
        { $inc: { usedCount: 1 } }
      )
    }

    // i) Clear the user's cart
    cart.items = []
    cart.coupon = null
    cart.discount = 0
    await cart.save()

    // j) Send confirmation email (non-blocking)
    const user = await User.findById(userId)
    sendEmail({
      to: user.email,
      subject: `Order Confirmed! #${order.orderNumber} — ShopHub`,
      html: orderConfirmationEmail({ order, user })
    }).catch(err => console.error('Email send failed:', err))

    // k) Return response
    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        order: order._id,
        orderNumber: order.orderNumber,
        total: order.total
      }
    })
  } catch (error) {
    console.error('Create order error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    })
  }
}

// Get My Orders
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id
    const { status, page = 1, limit = 10 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(limit)

    // Build filter
    const filter = { user: userId }
    if (status) {
      filter.orderStatus = status
    }

    const orders = await Order.find(filter)
      .populate('items.product', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await Order.countDocuments(filter)

    // Add canBeCancelled flag to each order
    const ordersWithFlags = orders.map(order => {
      const orderObj = order.toObject()
      orderObj.canBeCancelled = order.canBeCancelled()
      return orderObj
    })

    return res.status(200).json({
      success: true,
      data: ordersWithFlags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get my orders error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders'
    })
  }
}

// Get Order By ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id

    const order = await Order.findById(id)
      .populate('items.product', 'name slug images')
      .populate('statusHistory.updatedBy', 'name')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    // Check if order belongs to user
    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this order'
      })
    }

    // Add canBeCancelled flag to response
    const orderResponse = order.toObject()
    orderResponse.canBeCancelled = order.canBeCancelled()

    return res.status(200).json({
      success: true,
      data: orderResponse
    })
  } catch (error) {
    console.error('Get order by ID error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order'
    })
  }
}

// Cancel Order
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id
    const { reason = '' } = req.body

    const order = await Order.findById(id)
      .populate('items.product', 'stock')
      .populate('user', 'email name')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    // Check if order belongs to user
    if (order.user._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel this order'
      })
    }

    // Check if order can be cancelled
    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled at this stage (status: ${order.orderStatus})`
      })
    }

    // Update order status
    order.orderStatus = 'cancelled'
    order.cancelledAt = new Date()
    order.cancellationReason = reason

    // Add to status history
    order.statusHistory.push({
      status: 'cancelled',
      note: reason || 'Cancelled by customer',
      updatedBy: userId
    })

    // Restore stock
    for (const item of order.items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { stock: item.quantity, sold: -item.quantity }
        })
      }
    }

    // Update payment status if paid
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded'
    }

    await order.save()

    // Send cancellation email (non-blocking)
    sendEmail({
      to: order.user.email,
      subject: `Order #${order.orderNumber} Cancelled`,
      html: orderCancellationEmail({ order, user: order.user, reason })
    }).catch(err => console.error('Email send failed:', err))

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    })
  } catch (error) {
    console.error('Cancel order error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order'
    })
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder
}
