const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const admin = require('firebase-admin');

// 1. Настройка Firebase Admin
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

// 2. Сервер для Render
http.createServer((req, res) => { res.end('IZIPAY Bot Live'); }).listen(process.env.PORT || 3000);

// 3. Настройка Telegram бота
const token = '8383398356:AAFJRxBGmhL2edF72kCcfStO-ho01tGhdUk';
const bot = new TelegramBot(token, { polling: true });
const adminId = '7897252945'; 

// Команда /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to IZIPAY!', {
        reply_markup: {
            inline_keyboard: [[{ text: 'Open wallet', web_app: { url: 'https://izipay2.github.io/izipay-app/' } }]]
        }
    });
});

// 4. ГЛАВНАЯ ФУНКЦИЯ: Уведомление при ручном добавлении транзакции в базу
db.ref('users').on('child_added', (userSnap) => {
    const userId = userSnap.key;
    // Следим за новыми записями в history каждого юзера
    db.ref(`users/${userId}/history`).on('child_added', (histSnap) => {
        const tx = histSnap.val();
        
        // Отправляем уведомление только если notified: false
        if (tx && tx.notified === false) {
            const msg = `🔔 **New Transaction!**\n\n` +
                        `📝 ${tx.details || 'Transaction processed'}\n` +
                        `💰 Amount: ${tx.amount}\n` +
                        `✅ Status: ${tx.status || 'Success'}`;

            bot.sendMessage(userId, msg, { parse_mode: 'Markdown' })
                .then(() => {
                    // После отправки меняем на true, чтобы не спамить
                    db.ref(`users/${userId}/history/${histSnap.key}`).update({ notified: true });
                })
                .catch(e => console.log("Error sending to " + userId, e.message));
        }
    });
});

// 5. Уведомления админу о новых запросах (без кнопок подтверждения)
db.ref('users').on('child_changed', (snapshot) => {
    const user = snapshot.val();
    const userId = snapshot.key;

    if (user.status === 'pending' && user.pending_request) {
        bot.sendMessage(adminId, `💳 **NEW CARD REQUEST**\n👤 ${user.name}\n💰 $${user.request_price}`);
    }
    if (user.withdraw_request && user.withdraw_request.status === 'pending') {
        bot.sendMessage(adminId, `💰 **WITHDRAW REQUEST**\n👤 ${user.name}\n💵 $${user.withdraw_request.amount}\n💳 ${user.withdraw_request.wallet}`);
    }
});

console.log('🚀 Бот мониторит ручные транзакции...');
