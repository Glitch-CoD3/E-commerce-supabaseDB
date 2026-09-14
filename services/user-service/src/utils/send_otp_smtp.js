import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("📨 Primary Email server is ready to send messages");
  }
});

const send_smtp_Mail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"TRENDLAMA" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("📨 Email sent:", info.messageId);

    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

export {
  transporter,
  send_smtp_Mail 
};

