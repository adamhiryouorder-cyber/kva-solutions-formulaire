const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {

  const data = JSON.parse(event.body);

  if (data.type !== "checkout.session.completed") {
    return { statusCode: 200 };
  }

  const session = data.data.object;

  const installateur = session.metadata.installateur;

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

  const credits = {
    urbanisme: 0,
    raccordement: 0,
    consuel: 0
  };

  for (const item of lineItems.data) {

    const price = item.price.id;
    const qty = item.quantity;

    if (price === "price_1T9Qvz6YXq3YLz85GnRCLMGD")
      credits.urbanisme += qty;

    if (price === "price_1T97Gi6YXq3YLz85AwActkK1")
      credits.raccordement += qty;

    if (price === "price_1T9QeO6YXq3YLz85TJqymxtK")
      credits.consuel += qty;

    if (price === "price_1T2b0E6YXq3YLz85MnLR9zhM") {
      credits.urbanisme += qty;
      credits.raccordement += qty;
      credits.consuel += qty;
    }

  }

  await fetch(process.env.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "addCredits",
      installateur: installateur,
      credits: credits
    })
  });

  return {
    statusCode: 200,
    body: "ok"
  };

};
