const crypto = require("crypto");

const ORDER_EMAIL_FROM = "TandBee Liquid Gold <contact@tandbeeliquidgold.com>";
const ORDER_EMAIL_IDEMPOTENCY_VERSION = "v1";

function normalizeEmail(email) {
  return String(email || "").trim();
}

function getOrderAdminRecipients({
  shopRegion,
  personalEmail = process.env.PERSONAL_EMAIL,
  usPersonalEmail = process.env.US_PERSONAL_EMAIL,
}) {
  const candidates = [personalEmail];

  if (String(shopRegion || "").toUpperCase() === "US") {
    candidates.push(usPersonalEmail);
  }

  const seen = new Set();
  return candidates.reduce((recipients, candidate) => {
    const recipient = normalizeEmail(candidate);
    const deduplicationKey = recipient.toLowerCase();

    if (recipient && !seen.has(deduplicationKey)) {
      seen.add(deduplicationKey);
      recipients.push(recipient);
    }

    return recipients;
  }, []);
}

function getStableOrderNumber({ sessionId, sessionCreated }) {
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedSessionId) {
    throw new Error("A Stripe checkout-session id is required");
  }

  const digest = crypto
    .createHash("sha256")
    .update(normalizedSessionId)
    .digest("hex");
  const created = Number(sessionCreated);
  const timePart =
    Number.isFinite(created) && created > 0
      ? Math.trunc(created).toString(36)
      : digest.slice(0, 8);

  return `ORD-${timePart}-${digest.slice(8, 16)}`;
}

function getOrderEmailIdempotencyKey({ sessionId, recipientType, recipient }) {
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedSessionId) {
    throw new Error("A Stripe checkout-session id is required");
  }

  const recipientDigest = crypto
    .createHash("sha256")
    .update(`${recipientType}:${normalizeEmail(recipient).toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);

  return `order-email-${ORDER_EMAIL_IDEMPOTENCY_VERSION}/${normalizedSessionId}/${recipientType}/${recipientDigest}`;
}

function getOrderEmailBatchIdempotencyKey(sessionId) {
  const normalizedSessionId = String(sessionId || "").trim();
  if (!normalizedSessionId) {
    throw new Error("A Stripe checkout-session id is required");
  }

  return `order-emails-${ORDER_EMAIL_IDEMPOTENCY_VERSION}/${normalizedSessionId}`;
}

function getResendErrorMessage(error) {
  if (!error) return "Unknown email delivery error";
  if (typeof error === "string") return error;

  const name = error.name || error.code;
  const message = error.message || JSON.stringify(error);
  return name ? `${name}: ${message}` : message;
}

async function sendResendEmail(resend, payload, { idempotencyKey } = {}) {
  let result;

  try {
    result = await resend.emails.send(
      payload,
      idempotencyKey ? { idempotencyKey } : undefined
    );
  } catch (error) {
    throw new Error(`Resend request failed: ${getResendErrorMessage(error)}`);
  }

  if (result?.error) {
    throw new Error(
      `Resend rejected email: ${getResendErrorMessage(result.error)}`
    );
  }

  if (!result?.data?.id) {
    throw new Error("Resend did not return an email id");
  }

  return result.data.id;
}

async function sendResendBatch(resend, payloads, { idempotencyKey }) {
  let result;

  try {
    result = await resend.batch.send(payloads, { idempotencyKey });
  } catch (error) {
    throw new Error(
      `Resend batch request failed: ${getResendErrorMessage(error)}`
    );
  }

  if (result?.error) {
    throw new Error(
      `Resend rejected order-email batch: ${getResendErrorMessage(
        result.error
      )}`
    );
  }

  const emailIds = result?.data?.data?.map(({ id }) => id);
  if (
    !Array.isArray(emailIds) ||
    emailIds.length !== payloads.length ||
    emailIds.some((id) => !id)
  ) {
    throw new Error("Resend did not return an id for every batched email");
  }

  return emailIds;
}

function buildOrderEmailRequests({
  shopRegion,
  customerEmail,
  orderNumber,
  customerEmailHtml,
  adminEmailHtml,
  attachments,
  personalEmail,
  usPersonalEmail,
}) {
  const normalizedCustomerEmail = normalizeEmail(customerEmail);
  if (!normalizedCustomerEmail) {
    throw new Error("A customer email is required");
  }

  const adminRecipients = getOrderAdminRecipients({
    shopRegion,
    personalEmail,
    usPersonalEmail,
  });

  if (adminRecipients.length === 0) {
    throw new Error(
      "No order-admin recipient is configured (PERSONAL_EMAIL is missing)"
    );
  }

  const attachmentPayload =
    Array.isArray(attachments) && attachments.length > 0
      ? { attachments }
      : {};

  return [
    {
      recipientType: "customer",
      recipientLabel: "customer confirmation",
      recipient: normalizedCustomerEmail,
      payload: {
        from: ORDER_EMAIL_FROM,
        to: normalizedCustomerEmail,
        subject: `Order Confirmation - ${orderNumber}`,
        html: customerEmailHtml,
        ...attachmentPayload,
      },
    },
    ...adminRecipients.map((recipient, index) => ({
      recipientType: index === 0 ? "primary-admin" : "us-admin",
      recipientLabel: "order notification",
      recipient,
      payload: {
        from: ORDER_EMAIL_FROM,
        to: recipient,
        subject: `New Order from ${normalizedCustomerEmail} - ${orderNumber}`,
        html: adminEmailHtml,
        ...attachmentPayload,
      },
    })),
  ];
}

async function sendOrderEmails({
  resend,
  sessionId,
  shopRegion,
  customerEmail,
  orderNumber,
  customerEmailHtml,
  adminEmailHtml,
  attachments = [],
  hasOrderAttachments = attachments.length > 0,
  personalEmail,
  usPersonalEmail,
}) {
  const emailRequests = buildOrderEmailRequests({
    shopRegion,
    customerEmail,
    orderNumber,
    customerEmailHtml,
    adminEmailHtml,
    attachments,
    personalEmail,
    usPersonalEmail,
  });

  if (!hasOrderAttachments) {
    return sendResendBatch(
      resend,
      emailRequests.map(({ payload }) => payload),
      { idempotencyKey: getOrderEmailBatchIdempotencyKey(sessionId) }
    );
  }

  const results = await Promise.allSettled(
    emailRequests.map(({ recipientType, recipient, payload }) =>
      sendResendEmail(resend, payload, {
        idempotencyKey: getOrderEmailIdempotencyKey({
          sessionId,
          recipientType,
          recipient,
        }),
      })
    )
  );
  const failures = results
    .map((result, index) => ({ result, request: emailRequests[index] }))
    .filter(({ result }) => result.status === "rejected");

  if (failures.length > 0) {
    const emailFailures = failures.map(({ result, request }) => ({
      recipientType: request.recipientType,
      message: getResendErrorMessage(result.reason),
    }));
    const details = emailFailures
      .map(({ recipientType, message }) => `${recipientType}: ${message}`)
      .join("; ");
    const error = new Error(
      `${failures.length} of ${emailRequests.length} order emails failed: ${details}`
    );
    error.emailFailures = emailFailures;
    throw error;
  }

  return results.map((result) => result.value);
}

module.exports = {
  ORDER_EMAIL_FROM,
  buildOrderEmailRequests,
  getOrderAdminRecipients,
  getOrderEmailBatchIdempotencyKey,
  getOrderEmailIdempotencyKey,
  getStableOrderNumber,
  sendOrderEmails,
  sendResendBatch,
  sendResendEmail,
};
