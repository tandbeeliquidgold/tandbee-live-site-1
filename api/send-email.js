import { Resend } from 'resend';

const FROM = 'TandBee Liquid Gold <contact@tandbeeliquidgold.com>';
const SUPPORT_EMAIL = 'contact@tandbeeliquidgold.com';
const WEBSITE_URL = 'https://tandbeeliquidgold.com';

const asString = (value) => (typeof value === 'string' ? value.trim() : '');

const escapeHtml = (value) =>
  asString(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]
  );

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { name, email, number, message, website, shopRegion } = req.body || {};

    // Honeypot: real users never see or fill this field. Silently accept the
    // request so bots do not learn that they were detected, but send no email.
    if (asString(website) !== "") {
      return res.status(200).json({ success: true, message: "Email sent successfully" });
    }

    const contactName = asString(name).slice(0, 120);
    const contactEmail = asString(email).slice(0, 254);
    const phoneNumber = asString(number).slice(0, 40);
    const contactMessage = asString(message).slice(0, 5000);

    if (
      !contactName ||
      !contactEmail ||
      !contactMessage ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    ) {
      return res.status(400).json({ success: false, message: "Please provide valid contact details" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const sendEmail = async (payload) => {
      const response = await resend.emails.send(payload);

      if (response.error) {
        throw response.error;
      }

      return response.data;
    };
    const recipientEmail =
      shopRegion === "US"
        ? process.env.US_PERSONAL_EMAIL
        : process.env.PERSONAL_EMAIL;

    if (!recipientEmail) {
      console.error("No contact-form recipient email is configured");
      return res.status(500).json({ success: false, message: "Email service is not configured" });
    }

    const safeName = escapeHtml(contactName);
    const safeEmail = escapeHtml(contactEmail);
    const safeNumber = escapeHtml(phoneNumber);
    const safeMessage = escapeHtml(contactMessage).replace(/\r?\n/g, '<br />');
    const adminText = [
      'New website message for TandBee Liquid Gold',
      '',
      `Name: ${contactName}`,
      `Email: ${contactEmail}`,
      `Phone: ${phoneNumber || 'Not provided'}`,
      '',
      contactMessage,
    ].join('\n');
    const confirmationText = [
      `Hi ${contactName},`,
      '',
      'We received your message and will reply shortly.',
      '',
      'TandBee Liquid Gold',
      WEBSITE_URL,
      SUPPORT_EMAIL,
    ].join('\n');

    try {
      // Send email to admin
      await sendEmail({
        from: FROM,
        to: recipientEmail,
        replyTo: contactEmail,
        subject: "New website message | TandBee Liquid Gold",
        text: adminText,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #7c2234; border-bottom: 2px solid #ddd; padding-bottom: 10px;">New website message</h2>
            <p style="font-size: 16px;">A visitor sent a message through the TandBee Liquid Gold contact form.</p>
            <p style="font-size: 16px;"><strong>Name:</strong> ${safeName}</p>
            <p style="font-size: 16px;"><strong>Email:</strong> ${safeEmail}</p>
            <p style="font-size: 16px;"><strong>Phone Number:</strong> ${safeNumber || 'Not provided'}</p>
            <p style="font-size: 16px;"><strong>Message:</strong></p>
            <p style="font-size: 16px; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">${safeMessage}</p>
            <p style="font-size: 14px; color: #777; margin-top: 20px;">Reply to this email to respond directly to ${safeName}.</p>
          </div>
        `,
      });

      // Send confirmation email to sender
      await sendEmail({
        from: FROM,
        to: contactEmail,
        replyTo: SUPPORT_EMAIL,
        subject: "We received your message | TandBee Liquid Gold",
        text: confirmationText,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #7c2234; border-bottom: 2px solid #ddd; padding-bottom: 10px;">We received your message</h2>
            <p style="font-size: 16px;">Hi ${safeName},</p>
            <p style="font-size: 16px;">Thanks for contacting TandBee Liquid Gold. We received your message and will reply shortly.</p>
            <p style="font-size: 14px; color: #777; margin-top: 20px;">This is an automated confirmation for a message submitted at <a href="${WEBSITE_URL}">${WEBSITE_URL.replace('https://', '')}</a>.</p>
            <p style="font-size: 14px; color: #777;"><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
          </div>
        `,
      });

      res.status(200).json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error("Failed to send email:", error);
      res.status(500).json({ success: false, message: "Failed to send email" });
    }
  } else {
    res.status(405).json({ message: "Only POST requests are allowed" });
  }
}
