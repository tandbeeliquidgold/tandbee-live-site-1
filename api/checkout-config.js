const { getDeliveries, getPromos } = require("../lib/productCatalog");
const { normalizeOrderRegion } = require("../lib/stripeAccounts");
const { isPromoEligible } = require("../lib/promoRules");

module.exports = async function checkoutConfig(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const requestedRegion = normalizeOrderRegion(req.query?.region);
    const [deliveries, promos] = await Promise.all([
      getDeliveries(),
      getPromos(),
    ]);

    const eligiblePromos = requestedRegion
      ? promos.filter((promo) => isPromoEligible(promo, requestedRegion))
      : promos.filter(
          (promo) =>
            isPromoEligible(promo, "US") || isPromoEligible(promo, "Israel")
        );

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    return res.status(200).json({
      deliveries: deliveries.filter((delivery) => delivery.active),
      promos: eligiblePromos,
    });
  } catch (error) {
    console.error("Unable to load checkout configuration from Google Sheets", error);
    return res.status(502).json({ error: "Unable to load checkout configuration" });
  }
};
