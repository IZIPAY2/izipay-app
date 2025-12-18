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

// 4. Уведомление клиента о транзакции (сплошной текст)
db.ref('users').on('child_added', (userSnap) => {
    const userId = userSnap.key;
    db.ref(`users/${userId}/history`).on('child_added', (histSnap) => {
        const tx = histSnap.val();
        if (tx && tx.notified === false) {
            const msg = `🔔 **New Transaction!**\n\n${tx.details}`;
            bot.sendMessage(userId, msg, { parse_mode: 'Markdown' })
                .then(() => {
                    db.ref(`users/${userId}/history/${histSnap.key}`).update({ notified: true });
                })
                .catch(e => console.log("Error sending to " + userId, e.message));
        }
    });
});

// 5. Уведомления админу (БЕЗ ПОВТОРОВ ПРИ ИЗМЕНЕНИИ БАЗЫ)
db.ref('users').on('child_changed', (snapshot) => {
    const user = snapshot.val();
    const userId = snapshot.key;

    if (!user) return;

    // --- КАРТА ---
    // Бот пишет тебе только если статус 'pending' И мы еще не ставили метку 'admin_notified'
    if (user.status === 'pending' && user.pending_request && !user.admin_notified) {
        const cardText = `💳 **НОВАЯ ЗАЯВКА НА КАРТУ**\n\n` +
                         `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                         `🆔 ID: \`${userId}\`\n` +
                         `Тип: *${user.pending_request}*\n` +
                         `💰 Цена: *$${user.request_price}*`;

        bot.sendMessage(adminId, cardText, { parse_mode: 'Markdown' })
            .then(() => {
                // Помечаем в базе, что админ уже получил это уведомление
                db.ref(`users/${userId}`).update({ admin_notified: true });
            });
    }

    // --- ВЫВОД ---
    if (user.withdraw_request && user.withdraw_request.status === 'pending' && !user.withdraw_request.admin_notified) {
        const w = user.withdraw_request;
        const withdrawText = `💰 **ЗАПРОС НА ВЫВОД**\n\n` +
                             `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                             `🆔 ID: \`${userId}\`\n` +
                             `💵 Сумма: **$${w.amount}**\n` +
                             `💳 Кошелек: \`${w.wallet}\``;

        bot.sendMessage(adminId, withdrawText, { parse_mode: 'Markdown' })
            .then(() => {
                db.ref(`users/${userId}/withdraw_request`).update({ admin_notified: true });
            });
    }

    // --- ПОПОЛНЕНИЕ ---
    if (user.deposit_request && user.deposit_request.status === 'pending' && !user.deposit_request.admin_notified) {
        const d = user.deposit_request;
        const depositText = `💵 **ЗАПРОС НА ПОПОЛНЕНИЕ**\n\n` +
                            `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                            `🆔 ID: \`${userId}\`\n` +
                            `💰 Сумма: **$${d.amount}**`;

        bot.sendMessage(adminId, depositText, { parse_mode: 'Markdown' })
            .then(() => {
                db.ref(`users/${userId}/deposit_request`).update({ admin_notified: true });
            });
    }
});

bot.on('polling_error', (err) => { if (!err.message.includes('409')) console.error(err.message); });
console.log('🚀 Бот запущен. Спам админу отключен.');
