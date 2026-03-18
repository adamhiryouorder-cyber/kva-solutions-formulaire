exports.handler = async (event) => {
  try {
    if (!["GET", "POST"].includes(event.httpMethod)) {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Méthode non autorisée" })
      };
    }

    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "APPS_SCRIPT_URL manquante" })
      };
    }

    let response;

    if (event.httpMethod === "GET") {
      const qs = new URLSearchParams(event.queryStringParameters || {}).toString();
      const url = qs ? `${APPS_SCRIPT_URL}?${qs}` : APPS_SCRIPT_URL;

      response = await fetch(url, {
        method: "GET",
        redirect: "follow"
      });
    } else {
      const body = JSON.parse(event.body || "{}");

      response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(body),
        redirect: "follow"
      });
    }

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: err.message || "Erreur proxy"
      })
    };
  }
};
