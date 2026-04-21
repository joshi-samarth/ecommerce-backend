const nodemailer = require('nodemailer')

let transporter

const getTransporter = async () => {
  if (transporter) return transporter

  if (process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  } else {
    // Auto-create Ethereal test account for development
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    })
    console.log('📧 Using Ethereal test account:', testAccount.user)
  }

  return transporter
}

const sendEmail = async ({ to, subject, html }) => {
  try {
    const t = await getTransporter()
    const info = await t.sendMail({
      from: '"ShopHub" <noreply@shophub.com>',
      to,
      subject,
      html
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Email preview URL:', nodemailer.getTestMessageUrl(info))
    }

    return { success: true, info }
  } catch (err) {
    console.error('❌ Email send failed (non-fatal):', err.message)
    return { success: false, error: err.message }
  }
}

module.exports = sendEmail
