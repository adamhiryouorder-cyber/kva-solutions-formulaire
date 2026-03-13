const Stripe = require("stripe");
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY
);

const PRICE_IDS = {
  urbanisme: "price_URBANISME",
  raccordement: "price_RACCORDEMENT",
  consuel: "price_CONSUEL",
  pack: "price_1TAUW77tptk3qWWotDPNJ1vu",
};

exports.handler = async (event) => {
  let stripeEvent;

  try {
    const sig =
      event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

    const rawBody = event.rawBody || event.body;

    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Signature invalide :", err.message);
    return {
      statusCode: 400,
      body: `Signature invalide: ${err.message}`,
    };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "ignored" };
  }

  const session = stripeEvent.data.object;

  console.log("Webhook reçu :", stripeEvent.id);
  console.log("Session :", session.id);

  const installateur = session.metadata?.installateur || "";

  const nomEntreprise =
    session.custom_fields?.find((f) => f.key === "nom_entreprise")?.text?.value || "";

  let lineItems;
  try {
    lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price"],
    });
  } catch (err) {
    console.error("Erreur Stripe listLineItems :", err.message);
    return {
      statusCode: 500,
      body: `Erreur Stripe listLineItems: ${err.message}`,
    };
  }

  const credits = { urbanisme: 0, raccordement: 0, consuel: 0 };

  for (const item of lineItems.data) {
    const priceId = item.price?.id;
    const qty = item.quantity || 0;

    console.log("Line item :", {
      description: item.description,
      priceId,
      qty,
    });

    if (priceId === PRICE_IDS.urbanisme) {
      credits.urbanisme += qty;
    } else if (priceId === PRICE_IDS.raccordement) {
      credits.raccordement += qty;
    } else if (priceId === PRICE_IDS.consuel) {
      credits.consuel += qty;
    } else if (priceId === PRICE_IDS.pack) {
      credits.urbanisme += qty;
      credits.raccordement += qty;
      credits.consuel += qty;
    } else {
      console.warn("Price ID non reconnu :", priceId);
    }
  }

  console.log("Crédits calculés :", credits);

  try {
    const gasRes = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addCredits",
        installateur,
        nomEntreprise,
        credits,
        stripeEventId: stripeEvent.id,
        stripeSessionId: session.id,
      }),
    });

    const gasText = await gasRes.text();
    console.log("Réponse GAS :", gasRes.status, gasText);

    if (!gasRes.ok) {
      return {
        statusCode: 500,
        body: `Erreur GAS: ${gasText}`,
      };
    }
  } catch (err) {
    console.error("Erreur fetch GAS :", err.message);
    return {
      statusCode: 500,
      body: `Erreur réseau GAS: ${err.message}`,
    };
  }

  return { statusCode: 200, body: "ok" };
};
