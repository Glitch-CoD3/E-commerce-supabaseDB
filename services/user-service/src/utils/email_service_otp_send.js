import nodemailer from "nodemailer";

const getRequiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required email configuration: ${name}`);
  }
  return value;
};

const createTransporter = () => {
  const port = Number.parseInt(process.env.SMTP_PORT || "465", 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive integer");
  }

  const user = getRequiredEnv("SMTP_USER");
  const appPassword = getRequiredEnv("SMTP_APP_PASSWORD").replace(/\s/g, "");

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE.toLowerCase() === "true"
      : port === 465,
    auth: {
      user,
      pass: appPassword,
    },
  });
};

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

const verifyEmailTransport = async () => {
  await getTransporter().verify();
  console.log("Email server is ready to send messages");
};

const sendEmail = async (to, subject, text, html) => {
  const sender = process.env.EMAIL_FROM?.trim() || getRequiredEnv("SMTP_USER");
  const info = await getTransporter().sendMail({
    from: `"TRENDLAMA" <${sender}>`,
    to,
    subject,
    text,
    html,
  });

  console.log(`Email sent: ${info.messageId}`);
  return info;
};

export {
  getTransporter,
  sendEmail,
  verifyEmailTransport,
};
