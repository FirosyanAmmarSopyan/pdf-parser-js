require("dotenv").config(); // Harus PALING ATAS!
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bcrypt = require("bcrypt");
const couchbase = require("couchbase");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { pdf } = require("pdf-to-img");
const Tesseract = require("tesseract.js");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// --- Example endpoints ---

app.post("/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const doc = {
      type: "user",
      username,
      password: hash,
      email,
    };
    const cluster = await couchbase.connect(
      "couchbases://cb.fdpgxuhig2hlnbfn.cloud.couchbase.com",
      {
        username: process.env.COUCHBASE_USERNAME,
        password: process.env.COUCHBASE_PASSWORD,
      }
    );
    const bucket = cluster.bucket("users");
    const collection = bucket.defaultCollection();
    await collection.upsert(username, doc);
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to register" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const cluster = await couchbase.connect(
      "couchbases://cb.fdpgxuhig2hlnbfn.cloud.couchbase.com",
      {
        username: process.env.COUCHBASE_USERNAME,
        password: process.env.COUCHBASE_PASSWORD,
      }
    );
    const bucket = cluster.bucket("users");
    const collection = bucket.defaultCollection();
    const result = await collection.get(username);
    const user = result.value;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Unauthorized" });
    const token = jwt.sign(
      { username: user.username },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );
    res.json({ token });
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token provided" });
  const token = header.split(" ")[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET_KEY);
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid token" });
  }
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const originalExt = path.extname(req.file.originalname) || ".pdf";
    const pdfPath = req.file.path + originalExt;
    fs.renameSync(req.file.path, pdfPath);

    console.log("PDF uploaded:", pdfPath);

    const document = await pdf(pdfPath, { scale: 5 });

    let allOcrText = "";
    let pageNum = 1;

    for await (const imageBuffer of document) {
      console.log(`Processing page ${pageNum} with OCR...`);

      // Tesseract OCR dari buffer image
      const {
        data: { text },
      } = await Tesseract.recognize(imageBuffer, "eng", {
        logger: (m) => console.log(`Page ${pageNum}:`, m.status),
      });

      allOcrText += text + "\n\n--- PAGE BREAK ---\n\n";
      pageNum++;
    }

    console.log("OCR completed. Total text length:", allOcrText.length);

    const prompt = `
Kamu adalah AI yang ahli dalam mengekstrak data dari dokumen PDF form.
Berikut adalah hasil OCR dari PDF form "Proof of Sustainability (PoS) for CORSIA Eligible Fuels":

${allOcrText}

Tugas kamu:
1. Identifikasi semua field name (label) dan value (isi input) dari teks OCR ini.
2. PENTING: Ekstrak field SESUAI URUTAN dari atas ke bawah seperti di dokumen asli.
3. Gunakan field name PERSIS seperti di dokumen (jangan diubah atau disingkat).
4. Return dalam format JSON ARRAY dengan urutan yang sama seperti di dokumen.

Format output yang diinginkan (ARRAY):
[
  {
    "field": "Unique Number of Sustainability Declaration / Batch ID number",
    "value": "..."
  },
  {
    "field": "Place and date of dispatch",
    "value": "..."
  },
  {
    "field": "Date of Issuance",
    "value": "..."
  }
]

PENTING:
- Return JSON ARRAY (bukan object).
- Urutan field harus SAMA PERSIS dengan urutan di dokumen (dari atas ke bawah).
- Jangan skip field kosong, tetap masukkan dengan value "".
- Untuk checkbox, cek jika ada tanda centang/X atau kata "Yes", berikan "Yes", jika tidak "No".

Berikan HANYA JSON array yang valid, tanpa penjelasan tambahan.
    `.trim();

    const perplexityKey = process.env.AI_API_KEY;
    const apiRes = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a precise data extraction assistant. Always preserve original field names and exact order from documents. Return valid JSON array only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      },
      {
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiResponse = apiRes.data.choices[0].message.content;
    console.log("AI response received");

    let extractedArray;
    try {
      extractedArray = JSON.parse(aiResponse);
    } catch (e) {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedArray = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI tidak mengembalikan JSON array valid");
      }
    }

    const orderedData = {};
    extractedArray.forEach((item) => {
      orderedData[item.field] = item.value;
    });

    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      data: orderedData,
      dataArray: extractedArray,
    });
  } catch (err) {
    console.error("Error:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: "Gagal parsing PDF atau ekstraksi data",
      detail: err.message,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
