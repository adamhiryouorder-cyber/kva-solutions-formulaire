const cloudinary = require("cloudinary").v2;
const Busboy = require("busboy");
const { createClient } = require("@supabase/supabase-js");

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

async function uploadFile(file) {
  const isPdf = file.mimetype === "application/pdf";

  if (isPdf) {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const cleanName = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${Date.now()}_${cleanName}`;
    const { error } = await supabase.storage
      .from("kva-pdfs")
      .upload(key, file.buffer, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("kva-pdfs").getPublicUrl(key);
    return { url: data.publicUrl };
  } else {
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: "image",
      folder: "kva-form",
      access_mode: "public",
    });
    return { url: result.secure_url };
  }
}

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const files = await parseMultipart(event);
    if (!files.length) {
      return { statusCode: 400, body: "No file received" };
    }
    const uploaded = await uploadFile(files[0]);
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
