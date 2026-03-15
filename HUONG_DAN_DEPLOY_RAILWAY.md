# 🚀 Hướng Dẫn Deploy Backend Lên Railway (Fix Lỗi ENV)

## ❌ Lỗi hiện tại

```
❌ [ENV ERROR] Missing required environment variables:
   - DATABASE_URL
   - ACCESS_TOKEN_SECRET
   - REFRESH_TOKEN_SECRET
```

**Nguyên nhân:** Railway KHÔNG đọc file `.env` từ máy local. Bạn phải **cài biến môi trường trực tiếp trên Railway Dashboard**.

---

## ✅ Cách Fix — Thêm Environment Variables trên Railway

### Bước 1: Mở Railway Dashboard

1. Vào [https://railway.com/dashboard](https://railway.com/dashboard)
2. Click vào **project** của bạn
3. Click vào **service** Backend (nơi bạn deploy `BE_App`)

### Bước 2: Thêm MySQL Database (nếu chưa có)

1. Trong project, click nút **"+ New"** (góc trên phải)
2. Chọn **"Database"** → **"Add MySQL"**
3. Railway sẽ tự tạo MySQL database và cung cấp biến `DATABASE_URL`
4. Click vào MySQL service → tab **"Connect"** → copy giá trị **`DATABASE_URL`**

> **Lưu ý:** URL sẽ có dạng:
> ```
> mysql://root:XXXXXX@autorack.proxy.rlwy.net:12345/railway
> ```

### Bước 3: Thêm biến môi trường vào Backend Service

1. Click vào **Backend service** (service deploy BE_App)
2. Click tab **"Variables"**
3. Thêm từng biến bằng nút **"+ New Variable"**:

| Tên biến | Giá trị | Ghi chú |
|---|---|---|
| `DATABASE_URL` | `mysql://root:XXXX@....` | Copy từ MySQL service ở Bước 2 |
| `ACCESS_TOKEN_SECRET` | *(tự tạo chuỗi dài ≥ 32 ký tự)* | Xem bên dưới cách tạo |
| `REFRESH_TOKEN_SECRET` | *(tự tạo chuỗi dài ≥ 32 ký tự)* | Xem bên dưới cách tạo |
| `PORT` | `3069` | Port server lắng nghe |
| `NODE_ENV` | `production` | Môi trường production |
| `CORS_ORIGIN` | *(URL frontend của bạn)* | Ví dụ: `https://your-fe.vercel.app` |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` | Tuỳ chỉnh (15 phút) |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | Tuỳ chỉnh (7 ngày) |

**Biến tùy chọn (thêm nếu cần tính năng email):**

| Tên biến | Giá trị | Ghi chú |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Hoặc SMTP server khác |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | `true` nếu dùng port 465 |
| `SMTP_USER` | `your.email@gmail.com` | Email gửi thông báo |
| `SMTP_PASS` | `xxxx xxxx xxxx xxxx` | App Password của Gmail |
| `FRONTEND_URL` | `https://your-fe.vercel.app` | URL frontend |

### Bước 4: Tạo secret key (ACCESS_TOKEN_SECRET & REFRESH_TOKEN_SECRET)

Mở **Terminal/PowerShell** trên máy và chạy:

```powershell
# Tạo ACCESS_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Tạo REFRESH_TOKEN_SECRET (chạy lần nữa, lấy giá trị khác)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Mỗi lệnh sẽ ra 1 chuỗi dài ~128 ký tự. Copy và paste vào Railway Variables.

> ⚠️ **QUAN TRỌNG:** 2 secret phải **KHÁC NHAU**. Không dùng chung 1 giá trị!

### Bước 5: Kết nối DATABASE_URL nhanh bằng Reference Variable

Thay vì copy-paste DATABASE_URL, bạn có thể dùng **Reference Variable** của Railway:

1. Vào **Backend service** → **Variables**
2. Click **"+ New Variable"**
3. Tên: `DATABASE_URL`
4. Giá trị: gõ `${{MySQL.DATABASE_URL}}` (Railway sẽ tự điền)
5. Click **Add**

> Cách này tiện hơn vì nếu Railway thay đổi database URL, biến sẽ tự cập nhật.

### Bước 6: Deploy lại

Sau khi thêm xong tất cả biến:

1. Railway sẽ **tự động redeploy** khi bạn thêm/sửa biến
2. Nếu không, click **"Redeploy"** ở tab **Deployments**
3. Xem **logs** để kiểm tra:
   - ✅ `Environment variables validated`
   - ✅ `Server is running on http://localhost:3069`

---

## 🔍 Cách kiểm tra sau deploy

### Kiểm tra Health Check
Mở trình duyệt, truy cập:
```
https://<your-railway-domain>/health
```

Kết quả mong đợi:
```json
{
  "status": "healthy",
  "database": { "status": "connected" },
  "environment": "production"
}
```

### Lấy public URL
1. Vào **Backend service** → tab **"Settings"** 
2. Kéo xuống phần **"Networking"**
3. Click **"Generate Domain"** để tạo public URL
4. URL sẽ có dạng: `https://be-app-production-xxxx.up.railway.app`

---

## 📌 Migrate Database (Quan trọng!)

Sau khi database đã kết nối thành công, bạn cần chạy migration để tạo các bảng:

### Cách 1: Dùng Railway CLI (khuyên dùng)

```bash
# Cài Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Chạy migration
railway run npx prisma db push
```

### Cách 2: Thêm migrate vào start script

Sửa `package.json`, thay đổi script `start`:

```json
"start": "npx prisma db push && node --import=extensionless/register server.js"
```

> `prisma db push` sẽ sync schema lên database mà không cần migration files.

---

## 🗂 Tóm tắt checklist

- [ ] Tạo MySQL database trên Railway
- [ ] Thêm `DATABASE_URL` (reference `${{MySQL.DATABASE_URL}}` hoặc copy paste)
- [ ] Thêm `ACCESS_TOKEN_SECRET` (tạo bằng lệnh crypto)
- [ ] Thêm `REFRESH_TOKEN_SECRET` (tạo bằng lệnh crypto, khác giá trị trên)
- [ ] Thêm `PORT=3069`
- [ ] Thêm `NODE_ENV=production`
- [ ] Thêm `CORS_ORIGIN` = URL frontend
- [ ] Thêm `ACCESS_TOKEN_EXPIRES_IN=15m`
- [ ] Thêm `REFRESH_TOKEN_EXPIRES_IN=7d`
- [ ] Deploy lại và kiểm tra logs
- [ ] Chạy `prisma db push` để tạo bảng
- [ ] Generate public domain
- [ ] Test health check endpoint
