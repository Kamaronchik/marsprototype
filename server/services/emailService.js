const nodemailer = require('nodemailer');

const sendVerificationEmail = async (email, code) => {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Mars Space Education" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your Email - Mars Space',
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

  await transport.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
