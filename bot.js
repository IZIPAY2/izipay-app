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

// Команда /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to IZIPAY!', {
        reply_markup: {
            inline_keyboard: [[{ 
                text: 'Open wallet', 
                web_app: { url: 'https://izipay2.github.io/izipay-app/' } 
            }]]
        }
    }).catch(err => console.error("Ошибка /start:", err.message));
});

// 4. Мониторинг базы данных
const usersRef = db.ref('users');

usersRef.on('child_changed', (snapshot) => {
    const user = snapshot.val();
    const userId = snapshot.key;

    if (!user) return;

    // --- УВЕДОМЛЕНИЕ О ЗАЯВКЕ НА КАРТУ ---
    if (user.status === 'pending' && user.pending_request) {
        console.log(`🔔 Новая заявка на карту от ${userId}`);
        const cardText = `💳 **НОВАЯ ЗАЯВКА НА КАРТУ**\n\n` +
                         `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                         `🆔 ID: \`${userId}\`\n` +
                         `Тип: *${user.pending_request}*\n` +
                         `💰 Цена: *$${user.request_price}*`;

        bot.sendMessage(adminId, cardText, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: 'OPEN APP', web_app: { url: 'https://izipay2.github.io/izipay-app/' } }]]
            }
        });
    }

    // --- УВЕДОМЛЕНИЕ О ВЫВОДЕ СРЕДСТВ ---
    if (user.withdraw_request && user.withdraw_request.status === 'pending') {
        console.log(`💰 Новый запрос на вывод от ${userId}`);
        const withdraw = user.withdraw_request;
        const withdrawText = `💰 **ЗАПРОС НА ВЫВОД**\n\n` +
                             `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                             `🆔 ID: \`${userId}\`\n` +
                             `💵 Сумма: **$${withdraw.amount}**\n` +
                             `🪙 Монета: ${withdraw.coin} (${withdraw.network})\n` +
                             `💳 Кошелек: \`${withdraw.wallet}\``;

        bot.sendMessage(adminId, withdrawText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Выполнено', callback_data: `approve_out_${userId}` },
                        { text: '❌ Отклонить', callback_data: `reject_out_${userId}` }
                    ]
                ]
            }
        });
    }
});

// Обработка кнопок (callback_query)
bot.on('callback_query', (query) => {
    if (query.from.id.toString() !== adminId) return;

    const [action, type, targetId] = query.data.split('_');

    if (type === 'out') {
        if (action === 'approve') {
            // При нажатии "Выполнено" — просто удаляем или меняем статус в базе
            db.ref(`users/${targetId}/withdraw_request`).update({ status: 'completed' });
            bot.editMessageText(query.message.text + "\n\n✅ **ВЫПОЛНЕНО**", {
                chat_id: adminId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });
        } else if (action === 'reject') {
            db.ref(`users/${targetId}/withdraw_request`).update({ status: 'rejected' });
            bot.editMessageText(query.message.text + "\n\n❌ **ОТКЛОНЕНО**", {
                chat_id: adminId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });
        }
    }
    bot.answerCallbackQuery(query.id);
});

bot.on('polling_error', (err) => {
    if (!err.message.includes('409 Conflict')) {
        console.error("⚠️ Ошибка ТГ:", err.message);
    }
});

console.log('🚀 Бот запущен. Мониторинг Карт и Выводов активен.');
