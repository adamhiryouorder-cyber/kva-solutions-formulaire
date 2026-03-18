const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  urb: "price_1T9Qvz6YXq3YLz85GnRCLMGD",
  con: "price_1T9QeO6YXq3YLz85TJqymxtK",
  rac: "price_1T97Gi6YXq3YLz85AwActkK1",
  ful: "price_1T2b0E6YXq3YLz85MnLR9zhM"
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Méthode non autorisée" })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const installateur = String(body.installateur || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!installateur) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Installateur manquant" })
      };
    }

    if (!items.length) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Panier vide" })
      };
    }

    const line_items = items.map((item) => {
      const code = String(item.code || "").trim();
      const quantity = Math.max(1, Number(item.quantity || 1));
      const price = PRICE_MAP[code];
      if (!price) throw new Error("Produit inconnu : " + code);
      return {
        price,
        quantity,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 50 }
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      custom_fields: [
        {
          key: "nom_entreprise",
          label: { type: "custom", custom: "Nom de l'entreprise" },
          type: "text",
          optional: false
        }
      ],
      line_items,
      success_url: "https://kva-be.com/suivi?stripe=success",
      cancel_url:  "https://kva-be.com/shop?stripe=cancel",
      metadata: { installateur }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: session.id })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Erreur serveur Stripe" })
    };
  }
};
