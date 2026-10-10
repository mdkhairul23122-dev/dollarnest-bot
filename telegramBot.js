const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');
const config = require('./config');
const storage = require('./storage');
const formatter = require('./formatter');
const bscTracker = require('./bscTracker');

class TelegramBotManager {
  constructor() {
    this.bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
    this.initHandlers();
  }

  isAdmin(userId) {
    if (!config.ADMIN_TELEGRAM_ID) return true;
    return String(userId) === String(config.ADMIN_TELEGRAM_ID);
  }

  denyNonAdmin(chatId, userId, chatType) {
    // NEVER send access denied to public channels or groups!
    if (chatType !== 'private') return;

    console.log(`[TelegramBot] ⚠️ Unauthorized command attempt blocked from UID: ${userId}`);
    this.bot.sendMessage(
      chatId,
      `🚫 <b>Access Denied!</b>\n\nআপনি এই বটের অ্যাডমিন নন। এই বটটি শুধুমাত্র অনুমোদিত অ্যাডমিন আইডি ব্যবহার করতে পারে।\n\n🆔 আপনার Telegram UID: <code>${userId}</code>`,
      { parse_mode: 'HTML' }
    );
  }

  initHandlers() {
    // Register Bot Commands Menu with Telegram
    this.bot.setMyCommands([
      { command: 'start', description: 'Start bot & show dashboard' },
      { command: 'setspeed', description: 'Change post speed (e.g. /setspeed 3)' },
      { command: 'setwallet', description: 'Set BSC Wallet address to track' },
      { command: 'wallet', description: 'View currently tracked wallet' },
      { command: 'balance', description: 'Check USDT & BNB balance' },
      { command: 'test', description: 'Send a test payout post to channel' },
      { command: 'status', description: 'View system statistics' },
      { command: 'help', description: 'Help & instructions' }
    ]).catch((err) => console.log('[TelegramBot] setMyCommands notice:', err.message));

    // Handle error events
    this.bot.on('polling_error', (error) => {
      console.error('[TelegramBot] Polling Error:', error.code || error.message);
    });

    // Universal message logger (ignore channel posts from echoing)
    this.bot.on('message', (msg) => {
      if (msg.chat.type !== 'private') return; // Ignore public channel chatter
      if (msg.text) {
        console.log(`[TelegramBot] 📩 Received msg from @${msg.from?.username || 'Unknown'} (UID: ${msg.from?.id}): "${msg.text}"`);
      }
    });

    // /start command
    this.bot.onText(/^\/start(?:@\w+)?(?:\s+.*)?$/i, async (msg) => {
      if (msg.chat.type !== 'private') return; // Only in private DM
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);

      const chatId = msg.chat.id;
      const trackedWallet = storage.getTrackedWallet();

      const welcomeMsg = [
        `🤖 <b>DollarNest Payout Tracker Bot</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👑 <b>Admin Authenticated:</b> <code>${msg.from.id}</code> ✅`,
        `🚀 <b>অটো পেমেন্ট পোস্টিং স্পিড:</b> প্রতি <code>${storage.getSpeed()}</code> সেকেন্ডে ১টি পোস্ট`,
        ``,
        `📍 <b>বর্তমান ট্র্যাকিং ওয়ালেট:</b>`,
        `<code>${trackedWallet || '⚠️ সেট করা হয়নি (সরাসরি লাইভ নেটওয়ার্ক স্ক্যানিং সক্রিয়)'}</code>`,
        ``,
        `📌 <b>কমান্ড তালিকা (Commands):</b>`,
        `• <code>/setspeed &lt;seconds&gt;</code> - মেসেজ স্পিড পরিবর্তন করুন (যেমন: <code>/setspeed 3</code>)`,
        `• <code>/setwallet &lt;address&gt;</code> - নির্দিষ্ট BSC ওয়ালেট সেট করুন`,
        `• <code>/wallet</code> - বর্তমান ওয়ালেট চেক করুন`,
        `• <code>/balance</code> - ওয়ালেটের USDT ও BNB ব্যালেন্স দেখুন`,
        `• <code>/test</code> - চ্যানেলে একটি টেস্ট পেমেন্ট পোস্ট পাঠান`,
        `• <code>/status</code> - বটের স্ট্যাটাস ও পরিসংখ্যান দেখুন`,
        `• <code>/help</code> - সাহায্য দেখুন`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Status & Stats', callback_data: 'cmd_status' },
            { text: '💰 Check Balance', callback_data: 'cmd_balance' }
          ],
          [
            { text: '🧪 Send Test Post', callback_data: 'cmd_test' },
            { text: '📢 Go to Channel', url: 'https://t.me/DollarNest_Payout' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    });

    // /setspeed command
    this.bot.onText(/^\/setspeed(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
      if (msg.chat.type !== 'private') return;
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);

      const chatId = msg.chat.id;
      const inputSpeed = parseInt((match[1] || '').trim(), 10);

      if (isNaN(inputSpeed) || inputSpeed < 1 || inputSpeed > 300) {
        return this.bot.sendMessage(
          chatId,
          `⚠️ অনুগ্রহ করে ১ থেকে ৩০০ সেকেন্ডের মধ্যে একটি সংখ্যা দিন।\n\n<b>উদাহরণ:</b>\n<code>/setspeed 2</code> (প্রতি ২ সেকেন্ডে ১টি মেসেজ পাঠাবে)\n<code>/setspeed 5</code> (প্রতি ৫ সেকেন্ডে ১টি মেসেজ পাঠাবে)`,
          { parse_mode: 'HTML' }
        );
      }

      storage.setSpeed(inputSpeed);

      await this.bot.sendMessage(
        chatId,
        `⚡️ <b>পোস্টিং স্পিড আপডেট করা হয়েছে!</b>\n\nএখন থেকে প্রতি <b>${inputSpeed} সেকেন্ড</b> পরপর চ্যানেলে মেসেজ পাঠানো হবে। 🚀`,
        { parse_mode: 'HTML' }
      );
    });

    // /setwallet command
    this.bot.onText(/^\/setwallet(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
      if (msg.chat.type !== 'private') return;
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);

      const chatId = msg.chat.id;
      const inputWallet = (match[1] || '').trim();

      if (!inputWallet) {
        return this.bot.sendMessage(
          chatId,
          `❌ অনুগ্রহ করে একটি ভ্যালিড BSC ওয়ালেট অ্যাড্রেস দিন!\n\n<b>ব্যবহারের নিয়ম:</b>\n<code>/setwallet 0x1234567890abcdef1234567890abcdef12345678</code>`,
          { parse_mode: 'HTML' }
        );
      }

      if (!ethers.isAddress(inputWallet)) {
        return this.bot.sendMessage(
          chatId,
          `❌ ভুল ওয়ালেট অ্যাড্রেস! এটি কোনো ভ্যালিড EVM/BSC অ্যাড্রেস নয়। আবার চেক করে দিন।`,
          { parse_mode: 'HTML' }
        );
      }

      storage.setTrackedWallet(inputWallet);

      // Fetch balance immediately to confirm
      const balance = await bscTracker.getWalletBalances(inputWallet);

      let responseText = [
        `✅ <b>BSC ওয়ালেট সফলভাবে সেট করা হয়েছে!</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📍 <b>Tracked Wallet:</b> <code>${inputWallet}</code>`,
        `🌐 <b>Network:</b> BSC (BEP-20)`
      ];

      if (balance) {
        responseText.push(`💰 <b>USDT Balance:</b> <code>${balance.usdt} USDT</code>`);
        responseText.push(`⛽️ <b>BNB Balance:</b> <code>${balance.bnb} BNB</code>`);
      }

      responseText.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
      responseText.push(`এখন এই ওয়ালেট থেকে USDT সেন্ড হওয়া মাত্রই অটোমেটিক <b>${config.CHANNEL_ID}</b> চ্যানেলে পোস্ট হবে। 🚀`);

      await this.bot.sendMessage(chatId, responseText.join('\n'), { parse_mode: 'HTML' });
    });

    // /wallet command
    this.bot.onText(/^\/wallet(?:@\w+)?$/i, async (msg) => {
      if (msg.chat.type !== 'private') return;
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);

      const chatId = msg.chat.id;
      const trackedWallet = storage.getTrackedWallet();

      if (!trackedWallet) {
        return this.bot.sendMessage(
          chatId,
          `⚠️ এখনো কোনো ওয়ালেট সেট করা হয়নি!\nসেট করতে টাইপ করুন:\n<code>/setwallet 0xYOUR_BSC_WALLET_ADDRESS</code>`,
          { parse_mode: 'HTML' }
        );
      }

      await this.bot.sendMessage(
        chatId,
        `📍 <b>বর্তমান ট্র্যাকিং ওয়ালেট:</b>\n<code>${trackedWallet}</code>\n\n🔎 <a href="https://bscscan.com/address/${trackedWallet}">BscScan-এ দেখুন</a>`,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }
      );
    });

    // /balance command
    this.bot.onText(/^\/balance(?:@\w+)?$/i, async (msg) => {
      if (msg.chat.type !== 'private') return;
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);

      const chatId = msg.chat.id;
      const trackedWallet = storage.getTrackedWallet();

      if (!trackedWallet) {
        return this.bot.sendMessage(
          chatId,
          `⚠️ কোনো ওয়ালেট সেট করা হয়নি! প্রথমে <code>/setwallet 0x...</code> দিন।`,
          { parse_mode: 'HTML' }
        );
      }

      const waitMsg = await this.bot.sendMessage(chatId, `⏳ ব্যালেন্স চেক করা হচ্ছে...`);
      const balances = await bscTracker.getWalletBalances(trackedWallet);

      if (!balances) {
        return this.bot.editMessageText(`❌ ব্যালেন্স চেক করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।`, {
          chat_id: chatId,
          message_id: waitMsg.message_id
        });
      }

      const responseText = [
        `💼 <b>WALLET BALANCE</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📍 <b>Address:</b> <code>${formatter.formatAddress(balances.address)}</code>`,
        `💰 <b>USDT (BEP-20):</b> <code>${balances.usdt} USDT</code>`,
        `⛽️ <b>BNB (Gas):</b> <code>${balances.bnb} BNB</code>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');

      await this.bot.editMessageText(responseText, {
        chat_id: chatId,
        message_id: waitMsg.message_id,
        parse_mode: 'HTML'
      });
    });

    // /test or /testpayout command
    this.bot.onText(/^\/(?:test|testpayout)(?:@\w+)?$/i, async (msg) => {
      if (msg.chat.type !== 'private') return;
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);
      await this.handleTestPayout(msg.chat.id);
    });

    // /status or /stats command
    this.bot.onText(/^\/(?:status|stats)(?:@\w+)?$/i, async (msg) => {
      if (msg.chat.type !== 'private') return;
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);
      await this.handleStatus(msg.chat.id);
    });

    // /help command
    this.bot.onText(/^\/help(?:@\w+)?$/i, async (msg) => {
      if (msg.chat.type !== 'private') return;
      if (!this.isAdmin(msg.from.id)) return this.denyNonAdmin(msg.chat.id, msg.from.id, msg.chat.type);
      const helpMsg = [
        `📖 <b>DollarNest Bot Help & Guide</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `<b>১. কীভাবে কাজ করে?</b>`,
        `বটটি লাইভ BSC নেটওয়ার্ক থেকে USDT (BEP-20) ট্রানজেকশন অ্যানালাইসিস করে $0.1 থেকে $0.5 রেঞ্জের উইথড্র প্রুফগুলো অটোমেটিক <b>${config.CHANNEL_ID}</b> চ্যানেলে পোস্ট করে।`,
        ``,
        `<b>২. কমান্ডসমূহ:</b>`,
        `• <code>/setspeed 2</code> - পোস্টিং স্পিড ২ সেকেন্ডে সেট করুন`,
        `• <code>/setspeed 5</code> - পোস্টিং স্পিড ৫ সেকেন্ডে সেট করুন`,
        `• <code>/setwallet 0x...</code> - নির্দিষ্ট ওয়ালেট অ্যাড্রেস সেট করুন`,
        `• <code>/balance</code> - বর্তমান ওয়ালেট ব্যালেন্স দেখুন`,
        `• <code>/test</code> - চ্যানেলে ডেমো মেসেজ পাঠান`,
        `• <code>/status</code> - মোট পরিসংখ্যান দেখুন`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');

      await this.bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'HTML' });
    });

    // Callback queries from inline keyboard
    this.bot.on('callback_query', async (query) => {
      if (!this.isAdmin(query.from.id)) {
        return this.bot.answerCallbackQuery(query.id, {
          text: '🚫 Access Denied! You are not the admin.',
          show_alert: true
        });
      }

      const chatId = query.message.chat.id;
      const data = query.data;

      try {
        await this.bot.answerCallbackQuery(query.id);

        if (data === 'cmd_status') {
          await this.handleStatus(chatId);
        } else if (data === 'cmd_balance') {
          const trackedWallet = storage.getTrackedWallet();
          if (!trackedWallet) {
            return this.bot.sendMessage(chatId, `⚠️ ওয়ালেট সেট করা নেই! /setwallet দিন।`);
          }
          const balances = await bscTracker.getWalletBalances(trackedWallet);
          if (balances) {
            await this.bot.sendMessage(
              chatId,
              `💰 <b>USDT:</b> <code>${balances.usdt} USDT</code>\n⛽️ <b>BNB:</b> <code>${balances.bnb} BNB</code>`,
              { parse_mode: 'HTML' }
            );
          }
        } else if (data === 'cmd_test') {
          await this.handleTestPayout(chatId);
        }
      } catch (err) {
        console.error('[TelegramBot] Callback Query Error:', err.message);
      }
    });
  }

  async handleStatus(chatId) {
    const stats = storage.getStats();
    const statusText = [
      `📊 <b>BOT SYSTEM STATUS</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🤖 <b>Bot:</b> 🟢 Active & Scanning`,
      `👑 <b>Admin ID:</b> <code>${config.ADMIN_TELEGRAM_ID}</code>`,
      `📢 <b>Target Channel:</b> <code>${config.CHANNEL_ID}</code>`,
      `⚡️ <b>Current Speed:</b> 1 post every <code>${storage.getSpeed()}s</code>`,
      `💰 <b>Amount Filter:</b> <code>${config.MIN_AMOUNT} - ${config.MAX_AMOUNT} USDT</code>`,
      `📍 <b>Tracked Wallet:</b> <code>${stats.trackedWallet || 'Live BSC Network'}</code>`,
      `💸 <b>Total Payouts Sent:</b> <code>${stats.payoutCount}</code>`,
      `💾 <b>Saved Hashes:</b> <code>${stats.recordedTxs}</code>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');

    await this.bot.sendMessage(chatId, statusText, { parse_mode: 'HTML' });
  }

  async handleTestPayout(chatId) {
    try {
      const waitMsg = await this.bot.sendMessage(chatId, `⏳ চ্যানেলে টেস্ট পোস্ট পাঠানো হচ্ছে...`);
      const { message } = formatter.formatTestPayoutMessage();

      const sentMsg = await this.bot.sendMessage(config.CHANNEL_ID, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });

      await this.bot.editMessageText(
        `✅ <b>টেস্ট পোস্ট সফলভাবে চ্যানেলে পাঠানো হয়েছে!</b>\n\n📢 পোস্ট আইডি: ${sentMsg.message_id}\nচ্যানেল লিংক: https://t.me/DollarNest_Payout`,
        {
          chat_id: chatId,
          message_id: waitMsg.message_id,
          parse_mode: 'HTML'
        }
      );
    } catch (err) {
      console.error('[TelegramBot] Test Payout Error:', err.message);
      let errorDesc = err.message;
      if (err.message.includes('chat not found') || err.message.includes('bot is not a member')) {
        errorDesc = `বটটি <b>${config.CHANNEL_ID}</b> চ্যানেলে নেই অথবা Administrator বানানো হয়নি!`;
      }
      await this.bot.sendMessage(chatId, `❌ পোস্ট পাঠানো যায়নি!\n\n<b>কারণ:</b> ${errorDesc}`, {
        parse_mode: 'HTML'
      });
    }
  }

  /**
   * Post actual confirmed payout to channel matching screenshot format
   */
  async sendPayoutNotification(payout) {
    try {
      const { message } = formatter.formatPayoutMessage(payout);
      const res = await this.bot.sendMessage(config.CHANNEL_ID, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });

      console.log(`[TelegramBot] ✅ Sent Payout Post (Amount: ${payout.amount} USDT, MsgID: ${res.message_id})`);
      storage.addProcessedTx(payout.txHash, payout.amount);
      return true;
    } catch (err) {
      console.error(`[TelegramBot] ❌ Failed to send payout to channel:`, err.message);
      return false;
    }
  }
}

module.exports = new TelegramBotManager();
