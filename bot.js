const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const admin = require('firebase-admin');

// 1. Настройка Firebase
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
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://izipay-f1def-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

// 2. Веб-сервер для CRON-JOB.ORG и Само-пинг
const PORT = process.env.PORT || 3000;
const MY_URL = "https://izipay-app.onrender.com";

const server = http.createServer((req, res) => {
  // Этот лог подтверждает, что cron-job зашел на сервер
  console.log(`[${new Date().toISOString()}] Cron-job.org ping received`);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('IZIPAY Bot is Active'); 
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Дополнительный интервал само-пинга (раз в 10 минут)
setInterval(() => {
  http.get(MY_URL, (res) => {
    console.log('Self-ping successful');
  }).on('error', (e) => console.log('Self-ping failed:', e.message));
}, 600000);

// 3. Telegram бот
const token = '8383398356:AAFJRxBGmhL2edF72kCcfStO-ho01tGhdUk';
const bot = new TelegramBot(token, { polling: true });
const adminId = '7897252945'; 

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to IZIPAY!', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Open wallet', web_app: { url: 'https://izipay2.github.io/izipay-app/' } }]]
        }
    });
});

// Слушатель истории (без Markdown, чтобы не было ошибки 400)
db.ref('users').on('child_added', (userSnap) => {
    const userId = userSnap.key;
    db.ref(`users/${userId}/history`).on('child_added', (histSnap) => {
        const tx = histSnap.val();
        if (tx && tx.notified === false) {
            bot.sendMessage(userId, `🔔 New Transaction!\n\n${tx.details}`)
                .then(() => db.ref(`users/${userId}/history/${histSnap.key}`).update({ notified: true }))
                .catch(e => console.log("Notify error:", e.message));
        }
    });
});

// Глушим ошибку 409 Conflict
bot.on('polling_error', (err) => {
    if (!err.message.includes('409')) console.error("TG:", err.message);
});

console.log('🚀 Бот запущен в режиме 24/7 с поддержкой внешнего пинга');
