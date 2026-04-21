const baseStyles = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
`

const tableStyles = `
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  background-color: #f9f9f9;
`

const thStyles = `
  background-color: #7c3aed;
  color: white;
  padding: 12px;
  text-align: left;
  font-weight: 600;
`

const tdStyles = `
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
`

const rowAltStyle = `
  background-color: #f0f0f0;
`

const orderConfirmationEmail = ({ order, user }) => {
  const itemsRows = order.items
    .map(
      (item, idx) => `
      <tr ${idx % 2 === 0 ? `style="${rowAltStyle}"` : ''}>
        <td style="${tdStyles}; text-align: center;">
          <img src="${item.image || 'https://via.placeholder.com/80'}" 
               alt="${item.name}" 
               style="width: 60px; height: 60px; border-radius: 4px;" />
        </td>
        <td style="${tdStyles}">${item.name}</td>
        <td style="${tdStyles}; text-align: center;">${item.quantity}</td>
        <td style="${tdStyles}; text-align: right;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="${tdStyles}; text-align: right;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
      </tr>
    `
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { ${baseStyles} max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #fff; border-radius: 8px; padding: 30px; border: 1px solid #e0e0e0; }
        .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #7c3aed; margin: 0; font-size: 24px; }
        .order-number { font-size: 14px; color: #666; margin-top: 10px; }
        .section-title { color: #7c3aed; font-size: 16px; font-weight: 600; margin-top: 25px; margin-bottom: 15px; }
        .address-box { background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .price-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
        .price-row.total { border-bottom: 2px solid #7c3aed; font-weight: 600; font-size: 16px; padding: 12px 0; color: #7c3aed; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px; }
        table { ${tableStyles} }
        th { ${thStyles} }
        td { ${tdStyles} }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Order Confirmed!</h1>
          <div class="order-number">Order #${order.orderNumber}</div>
        </div>

        <p>Hi ${user.name},</p>
        <p>Thank you for your order! We're excited to help you. Your order has been confirmed and is being prepared for shipment.</p>

        <div class="section-title">Order Items</div>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Image</th>
              <th>Product</th>
              <th style="width: 60px; text-align: center;">Quantity</th>
              <th style="width: 100px; text-align: right;">Unit Price</th>
              <th style="width: 100px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="section-title">Price Breakdown</div>
        <div class="price-row">
          <span>Subtotal:</span>
          <span>₹${order.subtotal.toLocaleString('en-IN')}</span>
        </div>
        ${order.discount > 0 ? `<div class="price-row" style="color: green;">
          <span>Discount:</span>
          <span>−₹${order.discount.toLocaleString('en-IN')}</span>
        </div>` : ''}
        <div class="price-row">
          <span>Shipping:</span>
          <span>${order.shippingCharge === 0 ? 'FREE' : `₹${order.shippingCharge.toLocaleString('en-IN')}`}</span>
        </div>
        <div class="price-row total">
          <span>Total:</span>
          <span>₹${order.total.toLocaleString('en-IN')}</span>
        </div>

        <div class="section-title">Shipping Address</div>
        <div class="address-box">
          <strong>${order.shippingAddress.fullName}</strong><br>
          ${order.shippingAddress.line1}${order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}<br>
          ${order.shippingAddress.country}<br>
          <strong>Phone:</strong> ${order.shippingAddress.phone}
        </div>

        <div class="section-title">Payment Method</div>
        <div class="address-box">
          <strong>Cash on Delivery (COD)</strong><br>
          <small>You can pay when the package arrives at your doorstep.</small>
        </div>

        <div class="footer">
          <p>Thank you for shopping with <strong>ShopHub</strong>!</p>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>&copy; 2024 ShopHub. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

const orderStatusUpdateEmail = ({ order, user, newStatus, note }) => {
  const statusDescriptions = {
    confirmed: 'Your order has been confirmed and is being prepared',
    processing: 'Your order is being packed and prepared for shipment',
    shipped: 'Your order is on its way! 🚀',
    delivered: 'Your order has been delivered. Enjoy!',
    cancelled: 'Your order has been cancelled',
    returned: 'Your order return has been processed'
  }

  const statusColors = {
    confirmed: '#3b82f6',
    processing: '#f59e0b',
    shipped: '#8b5cf6',
    delivered: '#10b981',
    cancelled: '#ef4444',
    returned: '#6b7280'
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { ${baseStyles} max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #fff; border-radius: 8px; padding: 30px; border: 1px solid #e0e0e0; }
        .header { text-align: center; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 24px; color: #333; }
        .order-number { font-size: 14px; color: #666; margin-top: 10px; }
        .status-badge {
          display: inline-block;
          background-color: ${statusColors[newStatus] || '#7c3aed'};
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          font-weight: 600;
          margin: 15px 0;
        }
        .description { background-color: #f0f4ff; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid ${statusColors[newStatus] || '#7c3aed'}; }
        .info-box { background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px; }
        .cta-button { display: inline-block; background-color: #7c3aed; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="order-number">Order #${order.orderNumber}</div>
          <h1>Your Order Status Updated</h1>
        </div>

        <p>Hi ${user.name},</p>

        <div style="text-align: center;">
          <div class="status-badge">${newStatus.toUpperCase()}</div>
        </div>

        <div class="description">
          <strong>Latest Update:</strong><br>
          ${statusDescriptions[newStatus] || 'Your order has been updated'}
          ${note ? `<br><br><em>"${note}"</em>` : ''}
        </div>

        ${order.estimatedDelivery ? `
          <div class="info-box">
            <strong>Estimated Delivery:</strong><br>
            ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}
          </div>
        ` : ''}

        <div class="info-box">
          <strong>Order Summary:</strong><br>
          Items: ${order.items.length}<br>
          Total Amount: ₹${order.total.toLocaleString('en-IN')}<br>
          Payment Method: ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
        </div>

        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL}/account/orders/${order._id}" class="cta-button">View Order Details</a>
        </div>

        <div class="footer">
          <p>Thank you for shopping with <strong>ShopHub</strong>!</p>
          <p>&copy; 2024 ShopHub. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

const orderCancellationEmail = ({ order, user, reason }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { ${baseStyles} max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #fff; border-radius: 8px; padding: 30px; border: 1px solid #e0e0e0; }
        .header { text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #ef4444; margin: 0; font-size: 24px; }
        .order-number { font-size: 14px; color: #666; margin-top: 10px; }
        .alert-box { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .info-box { background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Cancelled</h1>
          <div class="order-number">Order #${order.orderNumber}</div>
        </div>

        <p>Hi ${user.name},</p>
        <p>Your order has been successfully cancelled.</p>

        <div class="alert-box">
          <strong>Cancellation Reason:</strong><br>
          ${reason || 'No specific reason provided'}
        </div>

        <div class="info-box">
          <strong>Refund Information:</strong><br>
          ${order.paymentStatus === 'paid'
      ? `
            Your payment of <strong>₹${order.total.toLocaleString('en-IN')}</strong> will be refunded to your original payment method within 5-7 business days.<br>
            <small>Please check your bank account or payment provider.</small>
          `
      : `
            Since the payment was pending (COD), there is no refund to process.
          `
    }
        </div>

        <div class="info-box">
          <strong>Order Summary:</strong><br>
          Items Cancelled: ${order.items.length}<br>
          Total Amount: ₹${order.total.toLocaleString('en-IN')}<br>
          Cancelled On: ${new Date(order.cancelledAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}
        </div>

        <p>If you have any questions about this cancellation, please don't hesitate to contact our support team.</p>

        <div class="footer">
          <p>We'd love to have you back! Feel free to browse our collection again.</p>
          <p>&copy; 2024 ShopHub. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

module.exports = {
  orderConfirmationEmail,
  orderStatusUpdateEmail,
  orderCancellationEmail
}
