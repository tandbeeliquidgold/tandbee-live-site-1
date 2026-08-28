function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const ROSH_HASHANAH_PICKUP_MESSAGE_CUTOFF = "2026-09-13";
const ROSH_HASHANAH_TIME_ZONE = "Asia/Jerusalem";

const ROSH_HASHANAH_PICKUP_MESSAGES = Object.freeze({
  israel_pickup_ramat_eshkol: [
    "Thank you for your order.",
    "Your order will arrive at the Ramat Eshkol pickup location the week of September 7th. The address is Sderot Eshkol 14.",
    "Exact details of pickup days and times will be sent to you as it gets closer.",
    "Thank you so much,",
    "The T&Bee Team",
  ],
  israel_pickup_beit_shemesh: [
    "Thank you for your order.",
    "Your order will arrive at the Bet Shemesh pickup location the week of September 7th. The pickup address is 5 Rabbi Yanai Street.",
    "Exact details of pickup days and times will be sent to you as it gets closer.",
    "Thank you so much,",
    "The T&Bee Team",
  ],
  israel_pickup_ramat_beit_shemesh: [
    "Thank you for your order.",
    "Your order will arrive at the RBS Gimmel pickup location the week of September 7th. The pickup address is Chavakuk Hanavi 33.",
    "Exact details of pickup days and times will be sent to you as it gets closer.",
    "Thank you so much,",
    "The T&Bee Team",
  ],
  israel_pickup_rechavia: [
    "Thank you for your order.",
    "Your order will arrive at the Rechavia pickup location the week of September 7th. The pickup address is 25 Abarbanel street.",
    "Exact details of pickup days and times will be sent to you as it gets closer.",
    "Thank you so much,",
    "The T&Bee Team",
  ],
  israel_pickup_french_hill: [
    "Thank you for your order.",
    "Your order will be ready for pickup at the French Hill pickup location in 1-2 business days. The pickup address is 31 Mevo Palyam Street.",
    "Exact details of pickup days and times will be sent to you as soon as your order is ready.",
    "Thank you so much,",
    "The T&Bee Team",
  ],
  israel_pickup_efrat: [
    "Thank you for your order.",
    "Your order will arrive at the Efrat pickup location the week of September 7th. The pickup address is 28 Matityahu Hacohain.",
    "Exact details of pickup days and times will be sent to you as it gets closer.",
    "Thank you so much,",
    "The T&Bee Team",
  ],
});

function getDateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isRoshHashanahPickupMessageActive(date = new Date()) {
  return (
    getDateInTimeZone(date, ROSH_HASHANAH_TIME_ZONE) <=
    ROSH_HASHANAH_PICKUP_MESSAGE_CUTOFF
  );
}

function getPickupDetails(deliveryItem) {
  const product = deliveryItem?.price?.product;
  const deliveryId = String(
    (typeof product === "object" && product?.metadata?.deliveryId) || ""
  ).toLowerCase();
  const rawLabel =
    (typeof product === "object" && product?.name) ||
    deliveryItem?.description ||
    "";
  const pickupLabel = String(rawLabel)
    .replace(/^Delivery Charge\s*-\s*/i, "")
    .trim();

  return {
    deliveryId,
    isPickup: deliveryId.startsWith("israel_pickup_"),
    pickupLabel: pickupLabel || "your selected pickup location",
    pickupMessage: ROSH_HASHANAH_PICKUP_MESSAGES[deliveryId] || null,
  };
}

function buildCustomerPickupNoticeHtml(deliveryItem, date = new Date()) {
  const { isPickup, pickupLabel, pickupMessage } = getPickupDetails(deliveryItem);
  if (!isPickup) return "";

  if (pickupMessage && isRoshHashanahPickupMessageActive(date)) {
    const messageHtml = pickupMessage
      .map(
        (line) =>
          '<p style="margin: 0 0 10px; color: #333; font-size: 16px; line-height: 1.5;">' +
          escapeHtml(line) +
          "</p>"
      )
      .join("");

    return [
      '<div style="margin: 22px 0; padding: 18px 20px; background-color: #fff8e8; border: 2px solid #d2a23a; border-radius: 8px;">',
      messageHtml,
      "</div>",
    ].join("\n");
  }

  return [
    '<div style="margin: 22px 0; padding: 18px 20px; background-color: #fff8e8; border: 2px solid #d2a23a; border-radius: 8px;">',
    '<p style="margin: 0 0 10px; color: #7c2234; font-size: 19px; font-weight: bold;">Your order is set for pickup</p>',
    '<p style="margin: 0 0 10px; color: #333; font-size: 16px; line-height: 1.5;">Thank you for choosing <strong>' +
      escapeHtml(pickupLabel) +
      "</strong>.</p>",
    '<p style="margin: 0; color: #333; font-size: 16px; line-height: 1.5;">We&rsquo;ll be in touch using the contact details from your order with the final pickup instructions.</p>',
    "</div>",
  ].join("\n");
}

function buildAdminPickupNoticeHtml(deliveryItem, date = new Date()) {
  const { isPickup, pickupLabel, pickupMessage } = getPickupDetails(deliveryItem);
  if (!isPickup) return "";

  const adminMessage =
    pickupMessage && isRoshHashanahPickupMessageActive(date)
      ? "The customer was sent the location-specific pickup instructions."
      : "The customer was told that final pickup instructions will be shared separately.";

  return [
    '<div style="margin: 22px 0; padding: 16px 18px; background-color: #fff8e8; border-left: 5px solid #d2a23a; border-radius: 6px;">',
    '<p style="margin: 0 0 8px; color: #7c2234; font-size: 18px; font-weight: bold;">Fulfillment: Pickup</p>',
    '<p style="margin: 0 0 8px; color: #333; font-size: 16px;"><strong>Pickup location:</strong> ' +
      escapeHtml(pickupLabel) +
      "</p>",
    '<p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">' +
      adminMessage +
      "</p>",
    "</div>",
  ].join("\n");
}

module.exports = {
  buildAdminPickupNoticeHtml,
  buildCustomerPickupNoticeHtml,
  getPickupDetails,
  isRoshHashanahPickupMessageActive,
};
