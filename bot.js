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
    bot.sendMessage(msg.chat.id, 'Welcome to IZIPAY Wallet!', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Open Wallet', web_app: { url: 'https://izipay2.github.io/izipay-app/' } }]
            ]
        }
    }).catch(err => console.error("Ошибка /start:", err.message));
});

// 4. Уведомление КЛИЕНТА о транзакции (сплошной текст)
db.ref('users').on('child_added', (userSnap) => {
    const userId = userSnap.key;
    db.ref(`users/${userId}/history`).on('child_added', (histSnap) => {
        const tx = histSnap.val();
        // Отправляем, только если notified: false
        if (tx && tx.notified === false) {
            const msg = `🔔 New Transaction!\n\n${tx.details}`;
            bot.sendMessage(userId, msg)
                .then(() => {
                    db.ref(`users/${userId}/history/${histSnap.key}`).update({ notified: true });
                })
                .catch(e => console.error("Ошибка уведомления юзера:", e.message));
        }
    });
});

// 5. Уведомления АДМИНУ
db.ref('users').on('child_changed', (snapshot) => {
    const user = snapshot.val();
    const userId = snapshot.key;
    if (!user) return;

    // Уведомление о КАРТЕ 
    // Сработает, только если статус pending И поле notified_card еще не создано/false
    if (user.status === 'pending' && user.pending_request && !user.notified_card) {
        const cardText = `💳 НОВАЯ ЗАЯВКА НА КАРТУ\n\n👤 Имя: ${user.name || 'User'}\n🆔 ID: ${userId}\n💰 Цена: $${user.request_price}`;
        
        bot.sendMessage(adminId, cardText).then(() => {
            // Ставим метку именно для КАРТЫ, чтобы не писать повторно
            db.ref(`users/${userId}`).update({ notified_card: true });
        }).catch(e => console.error("Ошибка админу:", e.message));
    }

    // Уведомление о ВЫВОДЕ
    if (user.withdraw_request && user.withdraw_request.status === 'pending' && !user.withdraw_request.notified) {
        const w = user.withdraw_request;
        const withdrawText = `💰 ЗАПРОС НА ВЫВОД\n\n👤 Имя: ${user.name}\n🆔 ID: ${userId}\n💵 Сумма: $${w.amount}\n💳 Кошелек: ${w.wallet}`;
        
        bot.sendMessage(adminId, withdrawText).then(() => {
            db.ref(`users/${userId}/withdraw_request`).update({ notified: true });
        });
    }

    // Уведомление о ПОПОЛНЕНИИ
    if (user.deposit_request && user.deposit_request.status === 'pending' && !user.deposit_request.notified) {
        const d = user.deposit_request;
        bot.sendMessage(adminId, `💵 ЗАПРОС НА ПОПОЛНЕНИЕ\n\n👤 Имя: ${user.name}\n💰 Сумма: $${d.amount}`).then(() => {
            db.ref(`users/${userId}/deposit_request`).update({ notified: true });
        });
    }
});

// Глушим ошибку 409 Conflict
bot.on('polling_error', (err) => {
    if (!err.message.includes('409 Conflict')) console.error("TG Error:", err.message);
});

console.log('🚀 Бот запущен.');
