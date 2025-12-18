const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const admin = require('firebase-admin');

// 1. Безопасная настройка Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '') : undefined,
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL,
  "universe_domain": process.env.FIREBASE_UNIVERSE_DOMAIN
};

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://izipay-f1def-default-rtdb.firebaseio.com"
        });
        console.log("✅ Firebase Admin успешно инициализирован");
    } catch (error) {
        console.error("❌ Ошибка инициализации Firebase:", error.message);
    }
}
const db = admin.database();

// 2. Сервер для Render
http.createServer((req, res) => { res.end('IZIPAY Bot is Live'); }).listen(process.env.PORT || 3000);

// 3. Настройка Telegram бота
const token = '8383398356:AAFJRxBGmhL2edF72kCcfStO-ho01tGhdUk';
const bot = new TelegramBot(token, { polling: true });
const adminId = '7897252945'; 

// Проверка команды /start
bot.onText(/\/start/, (msg) => {
    console.log(`Команда /start получена от ${msg.chat.id}`);
    bot.sendMessage(msg.chat.id, 'Welcome to IZIPAY!', {
        reply_markup: {
            inline_keyboard: [[{ 
                text: 'Open wallet', 
                web_app: { url: 'https://izipay2.github.io/izipay-app/' } 
            }]]
        }
    }).catch(err => console.error("Ошибка /start:", err.message));
});

// 4. Следим за изменениями (ИСПРАВЛЕНО: используем child_added и child_changed)
const usersRef = db.ref('users');

const handleUserRequest = (snapshot) => {
    const user = snapshot.val();
    const userId = snapshot.key;

    if (user && user.status === 'pending' && user.pending_request) {
        console.log(`🔔 Новая или измененная заявка от ${userId}`);
        const text = `🔔 **НОВАЯ ЗАЯВКА НА КАРТУ**\n\n` +
                     `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                     `🆔 ID: \`${userId}\`\n` +
                     `💳 Тип: *${user.pending_request}*\n` +
                     `💰 Цена: *$${user.request_price}*\n\n` +
                     `✅ Зайди в Firebase!`;

        bot.sendMessage(adminId, text, { parse_mode: 'Markdown' })
            .then(() => console.log("✅ Сообщение отправлено админу"))
            .catch(err => console.error("❌ Ошибка ТГ:", err.message));
    }
};

// Слушаем и новые записи, и изменения в старых
usersRef.on('child_added', handleUserRequest);
usersRef.on('child_changed', handleUserRequest);

bot.on('polling_error', (err) => {
    if (!err.message.includes('409 Conflict')) {
        console.error("⚠️ Ошибка ТГ:", err.message);
    }
});

console.log('🚀 Мониторинг базы запущен (added + changed)...');
