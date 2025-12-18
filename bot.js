const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const admin = require('firebase-admin');

// 1. Безопасная настройка Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  // Улучшенная обработка ключа: убираем лишние кавычки и обрабатываем \n
  "private_key": process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '') : undefined,
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL,
  "universe_domain": process.env.FIREBASE_UNIVERSE_DOMAIN
};

// Проверка наличия ключей в логах (безопасно)
console.log("--- ПРОВЕРКА КОНФИГУРАЦИИ ---");
console.log("Project ID:", serviceAccount.project_id ? "✅ OK" : "❌ MISSING");
console.log("Private Key:", serviceAccount.private_key ? "✅ OK" : "❌ MISSING");

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            // ГЛАВНОЕ ИСПРАВЛЕНИЕ: Мы добавляем строчку credential
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://izipay-f1def-default-rtdb.firebaseio.com"
        });
        console.log("✅ Firebase Admin успешно инициализирован");
    } catch (error) {
        console.error("❌ Ошибка инициализации Firebase:", error.message);
    }
}
const db = admin.database();

// 2. Сервер для Render (чтобы сервис не засыпал)
http.createServer((req, res) => { 
    res.end('IZIPAY Bot is Live'); 
}).listen(process.env.PORT || 3000);

// 3. Настройка Telegram бота
const token = '8383398356:AAFJRxBGmhL2edF72kCcfStO-ho01tGhdUk';
// Добавляем параметры, чтобы избежать ошибки 409 Conflict
const bot = new TelegramBot(token, {
    polling: {
        params: { timeout: 10 },
        autoStart: true
    }
});

const adminId = '7897252945'; 

// Логируем успешный запуск в Telegram
bot.getMe().then((me) => {
    console.log(`✅ Бот @${me.username} запущен в Telegram`);
});

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Добро пожаловать в IZIPAY!', {
        reply_markup: {
            inline_keyboard: [[{ 
                text: 'Открыть кошелек', 
                web_app: { url: 'https://izipay2.github.io/izipay-app/' } 
            }]]
        }
    });
});

// 4. Следим за изменениями в базе данных
const usersRef = db.ref('users');

usersRef.on('child_changed', (snapshot) => {
    const user = snapshot.val();
    const userId = snapshot.key;

    // Проверяем статус и наличие данных заявки
    if (user.status === 'pending' && user.pending_request) {
        console.log(`🔔 Обнаружена заявка от пользователя ${userId}`);
        
        const text = `🔔 **НОВАЯ ЗАЯВКА НА КАРТУ**\n\n` +
                     `👤 Имя: ${user.name || 'Неизвестно'}\n` +
                     `🆔 ID: \`${userId}\`\n` +
                     `💳 Тип: *${user.pending_request}*\n` +
                     `💰 Цена: *$${user.request_price}*\n\n` +
                     `✅ Зайди в Firebase, чтобы выдать данные!`;
        
        bot.sendMessage(adminId, text, { parse_mode: 'Markdown' })
            .then(() => console.log("✅ Уведомление админу отправлено"))
            .catch((err) => console.error("❌ Ошибка отправки в ТГ:", err.message));
    }
});

// Обработка ошибок Telegram Polling
bot.on('polling_error', (error) => {
    if (error.message.includes('409 Conflict')) {
        console.log("⚠️ Конфликт сессий (409). Ожидаем завершения старого процесса...");
    } else {
        console.error("⚠️ Ошибка ТГ Поллинга:", error.message);
    }
});

console.log('🚀 Мониторинг базы запущен...');
