const nodemailer = require('nodemailer');

const sendVerificationEmail = async (email, code) => {
  // Support aliases and sanitize app password (Google App Passwords often have spaces)
  const emailUser = (
    process.env.EMAIL_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER ||
    ''
  ).trim();

  const rawPass = (
    process.env.EMAIL_PASS ||
    process.env.GMAIL_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASS ||
    ''
  );
  const emailPass = rawPass.replace(/\s+/g, '');

  if (!emailUser || !emailPass) {
    // Local development without Gmail: print the code in the server console instead.
    // Never happens in production (NODE_ENV=production or on Vercel): there it is an error.
    const isDev = process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
    if (isDev) {
      console.log(`
📧 [DEV] Gmail is not configured. Verification code for ${email}: ${code}
`);
      return { dev: true };
    }
    const errorMsg = 'Email service is not configured: missing EMAIL_USER or EMAIL_PASS environment variables';
    console.error(`❌ [EmailService] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 10000, // 10s connection timeout for serverless
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const mailOptions = {
    from: `"Mars Space Education" <${emailUser}>`,
    to: email,
    subject: `Mars Space: Verification Code ${code}`,
    text: `Your Mars Space verification code is: ${code}\n\nThis code is valid for 5 minutes.\nIf you did not request this code, please ignore this email.`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B0E14; color: #F1F5F9; padding: 40px; border-radius: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #1F2937;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; font-size: 28px; margin-bottom: 10px;">Mars Space</h1>
          <p style="color: #94A3B8; font-size: 16px;">Educational IT Platform</p>
        </div>
        <div style="text-align: center; background-color: #151921; padding: 30px; border-radius: 15px; border: 1px solid #3B82F633;">
          <h2 style="font-size: 20px; margin-bottom: 20px;">Email Verification Code</h2>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3B82F6; margin-bottom: 20px;">
            ${code}
          </div>
          <p style="color: #94A3B8; font-size: 14px;">This code is valid for <b>5 minutes</b>.</p>
        </div>
        <div style="margin-top: 30px; text-align: center; color: #64748B; font-size: 12px;">
          <p>If you did not request this code, please ignore this email.</p>
          <p>&copy; ${new Date().getFullYear()} Mars Space Education. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`✅ [EmailService] Verification code successfully sent to ${email} (MessageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error(`❌ [EmailService] Failed to send email to ${email}:`, err.message);
    throw err;
  }
};

module.exports = { sendVerificationEmail };
