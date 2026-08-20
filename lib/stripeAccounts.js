const Stripe = require("stripe");

// Keep the API version aligned with the existing checkout integration until a
// deliberate Stripe API-version migration is scheduled.
const STRIPE_API_VERSION = "2022-11-15";

const STRIPE_ACCOUNTS = Object.freeze({
  Israel: Object.freeze({
    secretKeyName: "STRIPE_SECRET_KEY",
    webhookSecretName: "STRIPE_WEBHOOK_SECRET",
  }),
  US: Object.freeze({
    secretKeyName: "CHANA_STRIPE_SECRET_KEY",
    webhookSecretName: "CHANA_STRIPE_WEBHOOK_SECRET",
  }),
});

const stripeClients = new Map();

function normalizeOrderRegion(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    ["us", "usa", "united states", "united states of america"].includes(
      normalized
    )
  ) {
    return "US";
  }

  if (["il", "israel"].includes(normalized)) {
    return "Israel";
  }

  return null;
}

function getStripeAccountConfig(region, { requireWebhookSecret = false } = {}) {
  const normalizedRegion = normalizeOrderRegion(region);
  if (!normalizedRegion) {
    throw new Error("Unsupported order region");
  }

  const account = STRIPE_ACCOUNTS[normalizedRegion];
  const secretKey = process.env[account.secretKeyName];
  if (!secretKey) {
    throw new Error(`${account.secretKeyName} is not configured`);
  }

  const webhookSecret = process.env[account.webhookSecretName];
  if (requireWebhookSecret && !webhookSecret) {
    throw new Error(`${account.webhookSecretName} is not configured`);
  }

  return {
    region: normalizedRegion,
    secretKey,
    webhookSecret,
    ...account,
  };
}

function getStripeClient(region) {
  const config = getStripeAccountConfig(region);

  if (!stripeClients.has(config.region)) {
    stripeClients.set(
      config.region,
      new Stripe(config.secretKey, { apiVersion: STRIPE_API_VERSION })
    );
  }

  return stripeClients.get(config.region);
}

function getConfiguredWebhookAccounts() {
  return Object.keys(STRIPE_ACCOUNTS)
    .map((region) => {
      try {
        const config = getStripeAccountConfig(region, {
          requireWebhookSecret: true,
        });

        return {
          ...config,
          stripeClient: getStripeClient(region),
        };
      } catch (_error) {
        // A missing second-account configuration must not prevent the other
        // configured Stripe account from receiving webhooks.
        return null;
      }
    })
    .filter(Boolean);
}

function verifyStripeWebhook(rawBody, signature) {
  const accounts = getConfiguredWebhookAccounts();
  if (accounts.length === 0) {
    throw new Error("No Stripe webhook configuration is available");
  }

  let lastError;
  for (const account of accounts) {
    try {
      const event = account.stripeClient.webhooks.constructEvent(
        rawBody,
        signature,
        account.webhookSecret
      );

      return {
        accountRegion: account.region,
        event,
        stripeClient: account.stripeClient,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Stripe webhook signature verification failed");
}

module.exports = {
  STRIPE_API_VERSION,
  getConfiguredWebhookAccounts,
  getStripeAccountConfig,
  getStripeClient,
  normalizeOrderRegion,
  verifyStripeWebhook,
};
