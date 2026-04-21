const crypto = require('crypto')
const sendEmail = require('./sendEmail')

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Send OTP via email
const sendOTPEmail = async (email, otp, purpose) => {
  try {
    let subject, message

    if (purpose === 'user_registration') {
      subject = 'Email Verification - Register on ShopHub'
      message = `
        <h2>Verify Your Email</h2>
        <p>Welcome to ShopHub! Please verify your email to complete your registration.</p>
        <h3 style="color: #0066cc; font-size: 32px; letter-spacing: 4px; margin: 20px 0;">${otp}</h3>
        <p><strong>This OTP is valid for 10 minutes only.</strong></p>
        <p>If you did not create this account, please ignore this email.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">Never share your OTP with anyone. ShopHub support will never ask for your OTP.</p>
        `
    } else if (purpose === 'admin_creation') {
      subject = 'Admin Account Creation Verification - ShopHub'
      message = `
        <h2>Admin Account Creation Verification</h2>
        <p>A new admin account is being created. Please verify this action using the OTP below.</p>
        <h3 style="color: #0066cc; font-size: 32px; letter-spacing: 4px; margin: 20px 0;">${otp}</h3>
        <p><strong>This OTP is valid for 10 minutes only.</strong></p>
        <p>If you did not request this, please contact your administrator immediately.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">Never share your OTP with anyone.</p>
        `
    } else {
      subject = 'Admin Login Verification - ShopHub'
      message = `
        <h2>Admin Login Verification</h2>
        <p>You've initiated an admin login. Please verify this action using the OTP below.</p>
        <h3 style="color: #0066cc; font-size: 32px; letter-spacing: 4px; margin: 20px 0;">${otp}</h3>
        <p><strong>This OTP is valid for 10 minutes only.</strong></p>
        <p>If this wasn't you, please contact your administrator immediately.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">Never share your OTP with anyone.</p>
        `
    }

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #0066cc; margin: 0;">ShopHub</h1>
        </div>
        ${message}
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; 2026 ShopHub. All rights reserved.</p>
      </div>
    </div>
    `

    await sendEmail({
      to: email,
      subject,
      html
    })

    return { success: true }
  } catch (err) {
    console.error('Failed to send OTP email:', err.message)
    return { success: false, error: err.message }
  }
}

// Verify OTP (max 3 attempts)
const verifyOTP = async (OTP, email, providedOTP, purpose) => {
  try {
    // Check if OTP exists and matches
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      purpose,
      verified: false
    })
      .sort({ createdAt: -1 })

    if (!otpRecord) {
      return {
        success: false,
        message: 'OTP expired or not found. Please request a new OTP.'
      }
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return {
        success: false,
        message: 'Maximum OTP attempts exceeded. Please request a new OTP.'
      }
    }

    // Check if OTP matches
    if (otpRecord.otp !== providedOTP.toString()) {
      otpRecord.attempts += 1
      await otpRecord.save()

      const remainingAttempts = 3 - otpRecord.attempts
      return {
        success: false,
        message:
          remainingAttempts > 0
            ? `Invalid OTP. ${remainingAttempts} attempts remaining.`
            : 'Maximum OTP attempts exceeded. Please request a new OTP.'
      }
    }

    // Mark as verified
    otpRecord.verified = true
    await otpRecord.save()

    return {
      success: true,
      message: 'OTP verified successfully'
    }
  } catch (err) {
    console.error('OTP verification error:', err)
    return {
      success: false,
      message: 'OTP verification failed'
    }
  }
}

module.exports = {
  generateOTP,
  sendOTPEmail,
  verifyOTP
}
