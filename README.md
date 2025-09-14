🛡️ Discord Anti-Raid Bot

Bot này giúp bảo vệ server Discord của bạn khỏi các hành vi spam tạo kênh và spam @everyone từ các bot độc hại.

⚙️ Tính năng

🚫 Chặn bot spam tạo kênh

Kick bot tạo quá nhiều kênh trong 1 phút.

Xóa toàn bộ webhooks của bot đó.

🚫 Chặn bot spam @everyone

Xóa tin nhắn spam @everyone.

Kick bot ngay lập tức.

Xóa toàn bộ webhooks.

📜 Whitelist bot an toàn

Thêm, xóa, liệt kê hoặc xóa toàn bộ danh sách whitelist.

📊 Thống kê hệ thống

Thời gian hoạt động (uptime).

Số server được bảo vệ.

Số bot đã kick.

Số webhooks đã xóa.

Số lần chặn spam.

🚀 Cài đặt
1. Clone project
git clone https://github.com/your-username/discord-antiraid-bot.git
cd discord-antiraid-bot

2. Cài dependencies
npm install discord.js

3. Cấu hình bot

Mở file code và chỉnh sửa phần CONFIG:

const CONFIG = {
    TOKEN: "YOUR_BOT_TOKEN", // Token bot Discord
    OWNER_ID: "YOUR_DISCORD_ID", // ID của bạn để nhận log
    MAX_CHANNELS_PER_MINUTE: 4, // Giới hạn tạo kênh/phút
    TIME_WINDOW: 60000, // Thời gian tính spam (ms)
    WHITELISTED_BOTS: [
        "BOT_ID_AN_TOAN" // Các bot tin cậy
    ]
};

4. Chạy bot
node index.js

📖 Lệnh (dành cho OWNER_ID)

?status → Xem tình trạng hệ thống.

add <botId> → Thêm bot vào whitelist.

remove <botId> → Xóa bot khỏi whitelist.

list → Xem danh sách whitelist.

clear → Xóa toàn bộ whitelist.

🛡️ Cảnh báo

Bot cần quyền Kick Members và Manage Webhooks để hoạt động.

Không chia sẻ token bot cho người khác.

📌 License

MIT License – Bạn có thể sử dụng, chỉnh sửa và phân phối lại.
