const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRODUCTS = {
  "prod_U7gIGmVomEZGc9": {
    name: "Urbanisme",
    amount: 10000
  },
  "prod_U7LytKQi8G3deM": {
    name: "Raccordement",
    amount: 10000
  },
  "prod_U7g0igbQ0OeQse": {
    name: "Consuel",
    amount: 7000
  },
  "prod_U0cEtMlFkfZpEj": {
    name: "Dossier complet",
    amount: 25000
  }
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
    const productId = String(body.productId || "").trim();
    const installateur = String(body.installateur || "").trim();

    if (!productId || !installateur) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Paramètres manquants" })
      };
    }

    const product = PRODUCTS[productId];

    if (!product) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Produit Stripe inconnu" })
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      allow_promotion_codes: true,

      line_items: [
        {
          price_data: {
            currency: "eur",
            product: productId,
            unit_amount: product.amount
          },
          quantity: 1
        }
      ],

      success_url: "https://kva-solutions.netlify.app/?stripe=success",
      cancel_url: "https://kva-solutions.netlify.app/?stripe=cancel",

      metadata: {
        installateur: installateur,
        productId: productId,
        productName: product.name
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: session.id
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: err.message || "Erreur serveur Stripe"
      })
    };
  }
};
