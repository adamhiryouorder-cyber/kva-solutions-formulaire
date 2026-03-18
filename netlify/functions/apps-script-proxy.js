exports.handler = async (event) => {
  try {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

    if (!APPS_SCRIPT_URL) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "APPS_SCRIPT_URL manquante"
        })
      };
    }

    // ===== GET -> pour le login / suivi installateur =====
    if (event.httpMethod === "GET") {
      const params = new URLSearchParams(event.queryStringParameters || {});
      const url = `${APPS_SCRIPT_URL}?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/plain, */*"
        }
      });

      const text = await response.text();

      return {
        statusCode: response.status || 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: text
      };
    }

    // ===== POST -> pour crédits / actions =====
    if (event.httpMethod === "POST") {
      const body = event.body || "{}";

      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body
      });

      const text = await response.text();

      return {
        statusCode: response.status || 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: text
      };
    }

    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Méthode non autorisée"
      })
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
