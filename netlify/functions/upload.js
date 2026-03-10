const cloudinary = require("cloudinary").v2;
const Busboy = require("busboy");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: event.headers });
    const files = [];
    busboy.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info || {};
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("error", reject);
      file.on("end", () => {
        files.push({
          fieldname,
          filename: filename || "upload",
          mimetype: mimeType || "application/octet-stream",
          buffer: Buffer.concat(chunks),
        });
      });
    });
    busboy.on("finish", () => resolve(files));
    busboy.on("error", reject);
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body || "", "utf8");
    busboy.end(body);
  });
}

// Images → Cloudinary
function uploadImageToCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        type: "upload",
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url });
      }
    );
    stream.end(file.buffer);
  });
}

// PDFs → file.io (service gratuit, lien valable 14 jours, aucune dépendance)
async function uploadPdfToFileIo(file) {
  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  formData.append("file", blob, file.filename);
  // expires=14d : le lien reste accessible 14 jours
  formData.append("expires", "14d");
  // autoDelete=false : le fichier n'est pas supprimé après le premier accès
  formData.append("autoDelete", "false");

  const res = await fetch("https://file.io", {
    method: "POST",
    body: formData,
  });

  const json = await res.json();

  if (!json.success || !json.link) {
    throw new Error("file.io upload échoué : " + JSON.stringify(json));
  }

  return { url: json.link };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const files = await parseMultipart(event);
    if (!files.length) {
      return { statusCode: 400, body: "No file received" };
    }

    const file = files[0];
    const isPdf = file.mimetype === "application/pdf";

    let uploaded;
    if (isPdf) {
      uploaded = await uploadPdfToFileIo(file);
    } else {
      uploaded = await uploadImageToCloudinary(file, "kva-form");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uploaded),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e && e.message ? e.message : String(e) }),
    };
  }
};
