# Panduan Deploy ke Vercel

## Struktur Project
- **Client**: Next.js di `client/client-side/`
- **Server**: Express.js di `server/`

## ⚠️ PENTING: Vercel hanya bisa deploy Next.js, Server Express perlu di platform terpisah

Vercel **TIDAK BISA** menjalankan Express server yang terpisah. Solusinya:

### ✅ Opsi 1: Client di Vercel, Server di Railway/Render (RECOMMENDED)

#### 📱 Deploy Client (Next.js) ke Vercel:

1. **Push code ke GitHub** (jika belum)
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Login ke Vercel**
   - Buka [vercel.com](https://vercel.com)
   - Login dengan GitHub

3. **Import Project**
   - Klik "Add New Project"
   - Pilih repository GitHub Anda
   - **PENTING**: Set **Root Directory** ke `client/client-side`
   - Framework: Next.js (auto-detect)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

4. **Set Environment Variables di Vercel**
   - Masuk ke Project Settings → Environment Variables
   - Tambahkan:
     ```
     NEXT_PUBLIC_API_URL=https://your-server-url.railway.app
     ```
   - **Catatan**: URL ini akan diisi setelah server di-deploy

#### 🖥️ Deploy Server (Express) ke Railway:

1. **Login ke Railway**
   - Buka [railway.app](https://railway.app)
   - Login dengan GitHub

2. **Create New Project**
   - Klik "New Project"
   - Pilih "Deploy from GitHub repo"
   - Pilih repository Anda

3. **Setup Service**
   - Railway akan auto-detect, tapi pastikan:
   - **Root Directory**: `server`
   - **Start Command**: `node index.js`

4. **Set Environment Variables di Railway**
   - Masuk ke Variables tab
   - Tambahkan:
     ```
     COUCHBASE_USERNAME=your_username
     COUCHBASE_PASSWORD=your_password
     JWT_SECRET_KEY=your_secret_key
     AI_API_KEY=your_ai_api_key
     PORT=3001 (optional, Railway auto-set)
     ```

5. **Dapatkan URL Server**
   - Railway akan memberikan URL (contoh: `https://your-app.railway.app`)
   - Copy URL ini

6. **Update Vercel Environment Variable**
   - Kembali ke Vercel
   - Update `NEXT_PUBLIC_API_URL` dengan URL Railway
   - Redeploy client

#### 🖥️ Alternatif: Deploy Server ke Render:

1. **Login ke Render**
   - Buka [render.com](https://render.com)
   - Login dengan GitHub

2. **New Web Service**
   - Connect GitHub repository
   - **Root Directory**: `server`
   - **Build Command**: (kosongkan)
   - **Start Command**: `node index.js`
   - **Environment**: Node

3. **Set Environment Variables** (sama seperti Railway)

4. **Dapatkan URL dan update Vercel**

### 📋 Checklist Environment Variables

#### Client (Vercel):
- ✅ `NEXT_PUBLIC_API_URL` - URL server backend (contoh: `https://your-app.railway.app`)

#### Server (Railway/Render):
- ✅ `COUCHBASE_USERNAME`
- ✅ `COUCHBASE_PASSWORD`
- ✅ `JWT_SECRET_KEY`
- ✅ `AI_API_KEY`
- ✅ `PORT` (optional, platform biasanya auto-set)

### 🧪 Testing Setelah Deploy

1. **Test Server:**
   ```bash
   curl https://your-server-url.railway.app/login
   # Harus return error (karena no body), bukan 404
   ```

2. **Test Client:**
   - Buka URL Vercel
   - Coba login/register
   - Test upload PDF

### ⚠️ Catatan Penting

- ✅ Server sudah menggunakan `cors()` middleware (sudah ada di code)
- ✅ Server menggunakan `process.env.PORT` untuk production
- ⚠️ File uploads di `uploads/` folder - pastikan platform support persistent storage
- ⚠️ Railway/Render biasanya punya storage terbatas, pertimbangkan cloud storage untuk production

### 🔄 Workflow Deploy

1. Deploy server dulu → dapatkan URL
2. Deploy client dengan URL server di environment variable
3. Test aplikasi end-to-end

