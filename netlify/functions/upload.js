const cloudinary = require("cloudinary").v2;
const Busboy = require("busboy");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: event.headers });
    const files = [];

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("end", () => {
        files.push({
          fieldname,
          filename,
          mimetype,
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

function uploadToCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url });
      }
    );
    uploadStream.end(file.buffer);
  });
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

    const uploaded = await uploadToCloudinary(files[0], "kva-form");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uploaded),
    };
  } catch (e) {
  return {
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: e && e.message ? e.message : String(e)
    }),
  };
}

