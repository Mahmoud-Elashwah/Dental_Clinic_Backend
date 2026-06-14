const { Resend } = require('resend');

const sendEmail = async (options) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  // Fallback for local development if no API key is provided
  if (!apiKey) {
    console.log("\n=========================================");
    console.log("📧 MOCK EMAIL SENT (No RESEND_API_KEY found in .env)");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    console.log("--- Email Content Below ---");
    console.log(options.html || options.message);
    console.log("=========================================\n");
    return { id: "mock-id-123" };
  }

  const resend = new Resend(apiKey);

  const mailContent = {
    from: 'Odonto <onboarding@resend.dev>',
    to: options.to,
    subject: options.subject,
  };

  if (options.html) {
    mailContent.html = options.html;
  } else if (options.message) {
    mailContent.text = options.message;
  }

  const { data, error } = await resend.emails.send(mailContent);

  if (error) {
    throw error;
  }

  return data;
};

module.exports = sendEmail;