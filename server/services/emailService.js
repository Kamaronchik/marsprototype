const nodemailer = require('nodemailer');

// Sends one email through Gmail. "devNote" is printed instead when Gmail is not configured locally.
const deliver = async ({ email, subject, text, html, devNote }) => {
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
[DEV] Gmail is not configured. ${devNote} for ${email}
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

  try {
    const info = await transport.sendMail({
      from: `"Mars Space Education" <${emailUser}>`,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`✅ [EmailService] Email "${subject.replace(/\d{6}/, '******')}" sent to ${email} (MessageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error(`❌ [EmailService] Failed to send email to ${email}:`, err.message);
    throw err;
  }
};

// Product names are typed by an admin: never put them into HTML as-is.
const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Shared look of every code email.
const codeHtml = ({ title, code, details }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B0E14; color: #F1F5F9; padding: 40px; border-radius: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #1F2937;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #C9481F; font-size: 28px; margin-bottom: 10px;">Mars Space</h1>
          <p style="color: #94A3B8; font-size: 16px;">Educational IT Platform</p>
        </div>
        <div style="text-align: center; background-color: #151921; padding: 30px; border-radius: 15px; border: 1px solid #C9481F55;">
          <h2 style="font-size: 20px; margin-bottom: 20px;">${title}</h2>
          ${details ? `<p style="color: #94A3B8; font-size: 14px; margin-bottom: 20px;">${details}</p>` : ''}
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #C9481F; margin-bottom: 20px;">
            ${code}
          </div>
          <p style="color: #94A3B8; font-size: 14px;">This code is valid for <b>5 minutes</b>.</p>
        </div>
        <div style="margin-top: 30px; text-align: center; color: #64748B; font-size: 12px;">
          <p>If you did not request this code, please ignore this email and do not share the code with anyone.</p>
          <p>&copy; ${new Date().getFullYear()} Mars Space Education. All rights reserved.</p>
        </div>
      </div>
    `;

const sendVerificationEmail = (email, code) => deliver({
  email,
  subject: `Mars Space: Verification Code ${code}`,
  text: `Your Mars Space verification code is: ${code}\n\nThis code is valid for 5 minutes.\nIf you did not request this code, please ignore this email.`,
  html: codeHtml({ title: 'Email Verification Code', code }),
  devNote: `Verification code ${code}`,
});

const sendPurchaseCodeEmail = (email, code, summary) => deliver({
  email,
  subject: `Mars Space: Purchase Confirmation Code ${code}`,
  text: `You started a purchase in the Mars Space shop: ${summary}.\nYour confirmation code is: ${code}\n\nThis code is valid for 5 minutes.\nIf you did not make this purchase, do not share the code with anyone.`,
  html: codeHtml({ title: 'Purchase Confirmation', code, details: `Order: <b>${escapeHtml(summary)}</b>` }),
  devNote: `Purchase code ${code}`,
});

// The answer to a job application, in the language the candidate filled the form in.
const DECISION_TEXTS = {
  ru: {
    accepted: { subject: 'Mars Space: вы приняты', title: 'Вы приняты', body: 'Мы рассмотрели вашу заявку и рады пригласить вас в команду Mars Space. Скоро мы свяжемся с вами и расскажем о следующих шагах.' },
    rejected: { subject: 'Mars Space: ответ на вашу заявку', title: 'Ответ на вашу заявку', body: 'Спасибо, что откликнулись. К сожалению, сейчас мы не можем принять вашу заявку. Желаем удачи и будем рады увидеть вашу заявку снова.' },
    hello: 'Здравствуйте',
  },
  uz: {
    accepted: { subject: 'Mars Space: siz qabul qilindingiz', title: 'Siz qabul qilindingiz', body: "Arizangizni ko'rib chiqdik va sizni Mars Space jamoasiga taklif qilishdan xursandmiz. Tez orada siz bilan bog'lanib, keyingi qadamlar haqida aytamiz." },
    rejected: { subject: 'Mars Space: arizangizga javob', title: 'Arizangizga javob', body: "Ariza yuborganingiz uchun rahmat. Afsuski, hozir arizangizni qabul qila olmaymiz. Omad tilaymiz va arizangizni yana ko'rishdan xursand bo'lamiz." },
    hello: 'Assalomu alaykum',
  },
  en: {
    accepted: { subject: 'Mars Space: you are accepted', title: 'You are accepted', body: 'We have looked at your application and are glad to invite you to the Mars Space team. We will contact you soon about the next steps.' },
    rejected: { subject: 'Mars Space: an answer to your application', title: 'An answer to your application', body: 'Thank you for applying. Unfortunately, we cannot accept your application right now. We wish you luck and will be glad to see your application again.' },
    hello: 'Hello',
  },
};

// decision: 'accepted' or 'rejected'. The name is typed by the candidate: it is escaped before it goes into HTML.
const sendApplicationDecisionEmail = (email, { name, decision, language }) => {
  const texts = DECISION_TEXTS[language] ?? DECISION_TEXTS.ru;
  const letter = texts[decision];
  const greeting = `${texts.hello}, ${name}!`;
  return deliver({
    email,
    subject: letter.subject,
    text: `${greeting}\n\n${letter.body}\n\nMars Space`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5EFE6; color: #1F1A15; padding: 36px; border-radius: 16px; max-width: 560px; margin: 0 auto; border: 1px solid #E2D9CB;">
        <h1 style="color: #B8431F; font-size: 24px; margin: 0 0 24px;">Mars Space</h1>
        <h2 style="font-size: 20px; margin: 0 0 14px;">${letter.title}</h2>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">${escapeHtml(greeting)}</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0;">${letter.body}</p>
      </div>
    `,
    devNote: `Application decision "${decision}"`,
  });
};

module.exports = { sendVerificationEmail, sendPurchaseCodeEmail, sendApplicationDecisionEmail };
