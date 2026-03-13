const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {

  // ── Vérification signature Stripe ──────────────────────────────────
  let data;
  try {
    const sig = event.headers["stripe-signature"];
    const webhookEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    data = webhookEvent;
  } catch (err) {
    console.error("Signature invalide :", err.message);
    return { statusCode: 400, body: "Signature invalide" };
  }

  if (data.type !== "checkout.session.completed") {
    return { statusCode: 200 };
  }

  const session = data.data.object;
  const installateur = session.metadata.installateur;

  // ── Nom d'entreprise (champ custom Stripe) ─────────────────────────
  const nomEntreprise = session.custom_fields
    ?.find(f => f.key === "nom_entreprise")
    ?.text?.value || "";

  // ── Récupération des articles achetés ──────────────────────────────
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

  const credits = { urbanisme: 0, raccordement: 0, consuel: 0 };

  for (const item of lineItems.data) {
    const price = item.price.id;
    const qty   = item.quantity;
    if (price === "price_1TAUW77tptk3qWWotDPNJ1vu") credits.urbanisme    += qty;
    if (price === "price_1TAUW77tptk3qWWotDPNJ1vu") credits.raccordement += qty;
    if (price === "price_1TAUW77tptk3qWWotDPNJ1vu") credits.consuel      += qty;
    if (price === "price_1TAUW77tptk3qWWotDPNJ1vu") {
      credits.urbanisme    += qty;
      credits.raccordement += qty;
      credits.consuel      += qty;
    }
  }

  // ── Envoi vers Google Apps Script ──────────────────────────────────
  try {
    const gasRes = await fetch(process.env.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:        "addCredits",
        installateur:  installateur,
        nomEntreprise: nomEntreprise,
        credits:       credits
      })
    });

    if (!gasRes.ok) {
      console.error("Erreur GAS HTTP :", gasRes.status, await gasRes.text());
      return { statusCode: 500, body: "Erreur GAS" };
    }

  } catch (err) {
    console.error("Erreur fetch GAS :", err.message);
    return { statusCode: 500, body: "Erreur réseau GAS" };
  }

  return { statusCode: 200, body: "ok" };
};
