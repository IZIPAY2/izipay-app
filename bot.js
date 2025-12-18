const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const admin = require('firebase-admin');

// 1. Настройка Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL
};

if (!admin.apps.length) {
    admin.initializeApp({
        databaseURL: "https://izipay-f1def-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

// 2. Сервер для Render
http.createServer((req, res) => { res.end('IZIPAY Bot is Live'); }).listen(process.env.PORT || 3000);

// 3. Настройка бота
const token = '8383398356:AAEgAuC_P3yuKy8ohR3up93E19MPaV_lzFU';
const bot = new TelegramBot(token, {polling: true});
const adminId = '7897252945'; 

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Добро пожаловать в IZIPAY!', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Открыть кошелек', web_app: { url: 'https://izipay2.github.io/izipay-app/' } }]]
        }
    });
});

// 4. Следим за изменениями в базе
const usersRef = db.ref('users');

usersRef.on('child_changed', (snapshot) => {
    const user = snapshot.val();
    const userId = snapshot.key;

    // Срабатывает только если статус сменился на pending И переданы детали заявки
    if (user.status === 'pending' && user.pending_request) {
        const text = `🔔 **НОВАЯ ЗАЯВКА НА КАРТУ**\n\n` +
                     `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                     `🆔 ID: \`${userId}\`\n` +
                     `💳 Тип: *${user.pending_request}*\n` +
                     `💰 Цена: *$${user.request_price}*\n\n` +
                     `✅ Зайди в Firebase, чтобы выдать данные!`;
        
        bot.sendMessage(adminId, text, { parse_mode: 'Markdown' });
    }
});

console.log('Бот запущен и мониторит Firebase...');
