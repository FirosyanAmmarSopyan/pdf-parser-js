const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const bcrypt = require("bcrypt");
const couchbase = require("couchbase");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();
// Setup Couchbase
const collectionPromise = (async () => {
  const cluster = await couchbase.connect(
    "couchbases://cb.fdpgxuhig2hlnbfn.cloud.couchbase.com",
    {
      username: process.env.COUCHBASE_USERNAME,
      password: process.env.COUCHBASE_PASSWORD,
    }
  );
  const bucket = cluster.bucket("users");
  return bucket.defaultCollection();
})();

// Setup Express
const app = express();
app.use(cors());
app.use(express.json());

// Multer untuk upload file
const upload = multer({ dest: "uploads/" });

// Register endpoint (untuk pembuatan user baru, biasanya admin saja)
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
    const collection = await collectionPromise;
    await collection.upsert(username, doc);
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to register" });
  }
});

// Login endpoint (ambil user dari DB dan buat JWT jika cocok)
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const collection = await collectionPromise;
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

// Middleware auth JWT
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

async function extractDynamicAI(pdfText) {
  const prompt = `
Anda adalah AI yang kuat untuk ekstraksi data dari dokumen form.

Saya akan memberikan teks yang diekstrak dari file PDF form dengan berbagai field seperti input text, checkbox, radio button, dll. Tugas Anda adalah:

1. Baca seluruh teks dari ATAS ke BAWAH secara berurutan
2. Identifikasi SEMUA field yang ada di form (title/label dan value-nya)
3. Untuk setiap field yang ditemukan, ekstrak:
   - Title/Label field (nama field, pertanyaan, atau label yang menjelaskan field tersebut)
   - Value field (isi dari field tersebut)

KRITIS - PENTING UNTUK AKURASI:
- PERHATIKAN STRUKTUR KOLOM DAN SECTION: Jika form memiliki kolom (seperti Supplier dan Recipient), atau section/grouping, PASTIKAN nilai yang diambil sesuai dengan kolom/section yang tepat
- JIKA ADA HEADER/SECTION (seperti "Supplier", "Recipient", "Section 1", dll), nilai field harus diambil dari kolom/section yang sesuai dengan header tersebut
- CONTOH: Jika ada "Supplier" dengan "Name: 3rd Party" dan "Recipient" dengan "Name: Demo Buyer 2", maka:
  - "Name (Supplier)" atau "Supplier Name" = "3rd Party"
  - "Name (Recipient)" atau "Recipient Name" = "Demo Buyer 2"
- JANGAN mencampur nilai dari kolom/section yang berbeda
- Jika label field sama di beberapa kolom (misalnya "Name" di Supplier dan Recipient), gunakan label yang lebih spesifik seperti "Name (Supplier)" dan "Name (Recipient)" atau "Supplier Name" dan "Recipient Name"

ATURAN EKSTRAKSI:
- Untuk checkbox: jika checked, value = "Yes" atau "Checked", jika tidak checked, value = "No" atau "Unchecked"
- Untuk radio button: value = opsi yang dipilih
- Untuk input text: value = teks yang diisi
- Untuk field kosong: value = "" atau "-"
- Perhatikan struktur form, termasuk checkbox yang mungkin ditandai dengan [X], [✓], atau tanda centang lainnya

PENTING:
- Urutkan hasil sesuai dengan urutan munculnya field di dokumen (dari atas ke bawah)
- Jangan skip field apapun yang terlihat di form
- Jika ada section/grouping, tetap ikuti urutan dari atas ke bawah
- Gunakan title/label yang tepat sesuai yang tertulis di form, TAPI jika ada duplikasi label di kolom berbeda, tambahkan konteks kolom/section
- Jika value tidak ada atau kosong, gunakan "" atau "-"
- PASTIKAN nilai yang diambil sesuai dengan konteks kolom/section yang tepat

Format output yang diharapkan adalah ARRAY OF OBJECTS dengan struktur:
[
  { "title": "Nama Field 1", "value": "Value Field 1" },
  { "title": "Nama Field 2", "value": "Value Field 2" },
  ...
]

Contoh untuk form dengan kolom Supplier dan Recipient:
[
  { "title": "Supplier Name", "value": "3rd Party" },
  { "title": "Supplier Address", "value": "89 East 42nd Street, New York" },
  { "title": "Recipient Name", "value": "Demo Buyer 2" },
  { "title": "Recipient Address", "value": "233 South Wacker Driver, Chicago" }
]

HANYA kembalikan JSON array, tanpa komentar, tanpa penjelasan tambahan, tanpa markdown formatting. Langsung JSON array saja.

Teks dari PDF form:
${pdfText}
  `;

  const response = await axios.post(
    "https://api.perplexity.ai/chat/completions",
    {
      model: "sonar",
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  let aiResult = response.data.choices[0].message.content;
  aiResult = aiResult.replace(/```json/g, "").replace(/```/g, "").trim();
  
  const arrayMatch = aiResult.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsedArray = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsedArray)) {
        return parsedArray;
      }
    } catch (e) {
      console.log("Error parsing array:", e);
    }
  }
  
  try {
    const parsedResult = JSON.parse(aiResult);
    if (Array.isArray(parsedResult)) {
      return parsedResult;
    } else if (typeof parsedResult === 'object') {
      return Object.entries(parsedResult).map(([title, value]) => ({
        title,
        value: value || ""
      }));
    }
    throw new Error("Format tidak valid");
  } catch (e) {
    throw new Error("AI tidak mengembalikan JSON array yang valid. Response: " + aiResult.substring(0, 500));
  }
}

app.post("/upload", auth, upload.single("pdf"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = fs.readFileSync(file.path);
    
    let pdfText;
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      
      const uint8Array = new Uint8Array(fileBuffer);
      
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      let fullText = "";
      const numPages = pdf.numPages;
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item) => item.str)
          .join(" ");
        
        fullText += pageText + "\n";
      }
      
      pdfText = fullText.trim();
      
      if (!pdfText || pdfText.length === 0) {
        throw new Error("PDF tidak mengandung text yang dapat diekstrak. Mungkin PDF ini adalah scan/image-based. Silakan gunakan PDF yang berisi text yang dapat dipilih.");
      }
    } catch (parseError) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      if (parseError.message.includes("tidak mengandung text")) {
        throw parseError;
      }
      throw new Error("Gagal membaca PDF: " + parseError.message);
    }

    const aiParsed = await extractDynamicAI(pdfText);

    fs.unlinkSync(file.path);

    res.json({ tableData: aiParsed });
  } catch (err) {
    console.log(err, "<<<");
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res
      .status(500)
      .json({ error: "Failed to parse PDF with AI", detail: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
