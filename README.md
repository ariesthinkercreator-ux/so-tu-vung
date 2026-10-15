# Sổ Từ Vựng – deploy lên Vercel

Thư mục này là bản web hoàn chỉnh: `index.html` + `data/` (cơ sở dữ liệu) + `api/lookup.js` (tra trực tuyến khi thiếu từ).

## Cách 1 – Kéo thả bằng Vercel CLI (nhanh nhất)
```
npm i -g vercel
cd vercel
vercel          # lần đầu: đăng nhập, chọn "Create new project", chấp nhận mặc định
vercel --prod   # đưa lên tên miền chính thức
```

## Cách 2 – Qua GitHub
1. Tạo repo GitHub, đẩy toàn bộ nội dung thư mục này lên (gốc repo phải có `index.html`).
2. vercel.com → Add New → Project → Import repo → Framework Preset: **Other** → Deploy.

## Tra trực tuyến: mỗi người tự trả
- Mặc định, **không cần đặt biến môi trường nào**. Chủ trang không mất phí.
- Người dùng không dán khóa (mặc định, chạy trên cả máy tính và điện thoại): từ ngoài cơ sở dữ liệu được tra ở Free Dictionary API rồi dịch máy sang tiếng Việt (MyMemory, hoặc bộ dịch có sẵn của Chrome nếu máy đã cài). Các lệnh gọi chạy từ trình duyệt của người dùng nên không ai mất phí; MyMemory cho mỗi người dùng khoảng 5.000 ký tự/ngày (~20–30 từ), hết thì chỉ còn định nghĩa tiếng Anh.
- Người dùng dán khóa API Claude của họ vào ô "Khóa API Claude của bạn" (cột bên phải): trình duyệt gọi thẳng Anthropic, có nghĩa tiếng Việt, và phí tính vào tài khoản của chính người đó. Khóa chỉ lưu trên trình duyệt của họ, không qua máy chủ của trang.
