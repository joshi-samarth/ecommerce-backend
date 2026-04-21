const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        name: {
          type: String,
          required: true
        },
        image: {
          type: String,
          default: ''
        },
        price: {
          type: Number,
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        }
      }
    ],
    shippingAddress: {
      fullName: {
        type: String,
        required: true
      },
      phone: {
        type: String,
        required: true
      },
      line1: {
        type: String,
        required: true
      },
      line2: {
        type: String,
        default: ''
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      pincode: {
        type: String,
        required: true
      },
      country: {
        type: String,
        default: 'India'
      }
    },
    subtotal: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    shippingCharge: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    couponCode: {
      type: String,
      default: ''
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'online'],
      default: 'cod'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'placed'
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true
        },
        note: {
          type: String,
          default: ''
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    estimatedDelivery: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancellationReason: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
)

// Pre-save hook: auto-generate orderNumber if not set
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase()
    this.orderNumber = `ORD-${dateStr}-${randomStr}`
  }
  next()
})

// Method: canBeCancelled
orderSchema.methods.canBeCancelled = function () {
  return ['placed', 'confirmed', 'processing'].includes(this.orderStatus)
}

module.exports = mongoose.model('Order', orderSchema)
