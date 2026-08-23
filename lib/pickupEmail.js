function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPickupDetails(deliveryItem) {
  const product = deliveryItem?.price?.product;
  const deliveryId = String(
    (typeof product === "object" && product?.metadata?.deliveryId) || ""
  );
  const rawLabel =
    (typeof product === "object" && product?.name) ||
    deliveryItem?.description ||
    "";
  const pickupLabel = String(rawLabel)
    .replace(/^Delivery Charge\s*-\s*/i, "")
    .trim();

  return {
    isPickup: deliveryId.startsWith("israel_pickup_"),
    pickupLabel: pickupLabel || "your selected pickup location",
  };
}

function buildCustomerPickupNoticeHtml(deliveryItem) {
  const { isPickup, pickupLabel } = getPickupDetails(deliveryItem);
  if (!isPickup) return "";

  return `
    <div style="margin: 22px 0; padding: 18px 20px; background-color: #fff8e8; border: 2px solid #d2a23a; border-radius: 8px;">
      <p style="margin: 0 0 10px; color: #7c2234; font-size: 19px; font-weight: bold;">Your order is set for pickup</p>
      <p style="margin: 0 0 10px; color: #333; font-size: 16px; line-height: 1.5;">Thank you for choosing <strong>${escapeHtml(
        pickupLabel
      )}</strong>.</p>
      <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.5;">We&rsquo;ll be in touch using the contact details from your order with the final pickup instructions as Rosh Hashanah gets closer. No action is needed right now.</p>
    </div>
  `;
}

function buildAdminPickupNoticeHtml(deliveryItem) {
  const { isPickup, pickupLabel } = getPickupDetails(deliveryItem);
  if (!isPickup) return "";

  return `
    <div style="margin: 22px 0; padding: 16px 18px; background-color: #fff8e8; border-left: 5px solid #d2a23a; border-radius: 6px;">
      <p style="margin: 0 0 8px; color: #7c2234; font-size: 18px; font-weight: bold;">Fulfillment: Pickup</p>
      <p style="margin: 0 0 8px; color: #333; font-size: 16px;"><strong>Pickup location:</strong> ${escapeHtml(
        pickupLabel
      )}</p>
      <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">The customer was told that final pickup instructions will be shared closer to Rosh Hashanah.</p>
    </div>
  `;
}

module.exports = {
  buildAdminPickupNoticeHtml,
  buildCustomerPickupNoticeHtml,
  getPickupDetails,
};
