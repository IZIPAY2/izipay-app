const TelegramBot = require('node-telegram-bot-api'); 
const http = require('http'); 

// --- НАСТРОЙКИ ---
const token = '8383398356:AAFJRxBGmhL2edF72kCcfStO-ho01tGhdUk'; 
const adminId = '7897252945'; 
const PORT = process.env.PORT || 3000; 
const MY_URL = "https://izipay-app.onrender.com"; 

const bot = new TelegramBot(token, { polling: true });

// --- 1. ВЕБ-СЕРВЕР (Для Cron-job и предотвращения сна) ---
const server = http.createServer((req, res) => {
  // Логика для приема уведомлений от твоего PHP-сайта
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.message) {
          bot.sendMessage(adminId, data.message, { parse_mode: 'Markdown' });
        }
        res.writeHead(200);
        res.end('OK');
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  } else {
    console.log(`[${new Date().toISOString()}] Ping received`);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('IZIPAY Bot is Active');
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`); 
});

// Само-пинг каждые 10 минут
setInterval(() => { 
  http.get(MY_URL, (res) => { 
    console.log('Self-ping successful'); 
  }).on('error', (e) => console.log('Self-ping failed:', e.message)); 
}, 600000); 

// --- 2. КОМАНДА /START (Вход в Mini App) ---
bot.onText(/\/start/, (msg) => { 
    const chatId = msg.chat.id;
    const gifUrl = 'https://raw.githubusercontent.com/IZIPAY2/izipay-app/main/intro.gif'; 

    const welcomeMessage = `👋 Welcome to IZIPAY\n\nIZIPAY is a crypto-powered payment solution for fast, global spending.\nGet instant virtual or physical cards and pay with your crypto anywhere.\n\n⚡ Cards issued in minutes\n🌍 Accepted worldwide\n🪙 Top up directly with crypto\n\n✔ Apple Pay & Google Pay\n✔ Secure payments at thousands of merchants\n✔ Trusted by 10,000+ users\n\nNo subscriptions. No hidden fees. Just freedom.`;

    bot.sendAnimation(chatId, gifUrl, {
        caption: welcomeMessage,
        reply_markup: { 
            inline_keyboard: [
                [{ text: 'Open wallet', web_app: { url: 'https://izipay2.github.io/izipay-app/' } }],
                [
                    { text: 'Support', url: 'https://t.me/izipay_sup' },
                    { text: 'Website', url: 'https://izipay.me' }
                ]
            ] 
        } 
    }).catch((error) => {
        console.error("Error sending GIF:", error.message);
        bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: { 
                inline_keyboard: [
                    [{ text: 'Open wallet', web_app: { url: 'https://izipay2.github.io/izipay-app/' } }],
                    [
                        { text: 'Support', url: 'https://t.me/izipay_sup' },
                        { text: 'Website', url: 'https://izipay.me' }
                    ]
                ] 
            }
        });
    });
});

// Глушим ошибку 409 Conflict 
bot.on('polling_error', (err) => { 
    if (!err.message.includes('409')) console.error("TG Error:", err.message); 
}); 

console.log('🚀 Бот запущен на MySQL логике (без Firebase).');
