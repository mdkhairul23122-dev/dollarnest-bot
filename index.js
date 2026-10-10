const http = require('http');
const config = require('./config');
const storage = require('./storage');
const bscTracker = require('./bscTracker');
const telegramBot = require('./telegramBot');

console.log('====================================================');
console.log('🚀 DollarNest USDT (BSC) Payout Bot Starting...');
console.log(`📢 Target Channel: ${config.CHANNEL_ID}`);
console.log(`💰 Amount Range: ${config.MIN_AMOUNT} - ${config.MAX_AMOUNT} USDT`);
console.log(`⚡️ Speed: 1 message every ${storage.getSpeed()} seconds (Change via /setspeed)`);
console.log('====================================================\n');

// Lightweight Health Check Web Server for Free Cloud Hosting (Render, Railway, Koyeb)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ONLINE',
    service: 'DollarNest Payout Bot',
    channel: config.CHANNEL_ID,
    stats: storage.getStats()
  }, null, 2));
});

server.listen(PORT, () => {
  console.log(`🌐 Cloud Health Check Server running on port ${PORT}`);
});

let isProcessing = false;

async function dispatchNextPayout() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const payout = await bscTracker.getNextPayout();

    if (payout) {
      console.log(`[Dispatcher] 📤 Sending: ${payout.amount} USDT (Tx: ${payout.txHash})`);
      await telegramBot.sendPayoutNotification(payout);
    }
  } catch (err) {
    console.error('[Dispatcher] Error:', err.message);
  } finally {
    isProcessing = false;
  }
}

// Background scanner loop every 6s to keep queue full
setInterval(async () => {
  try {
    await bscTracker.scanNetworkForMicroPayouts();
  } catch (_) {}
}, 6000);

// Dynamic loop to support instant speed adjustments
async function startDynamicPostingLoop() {
  while (true) {
    await dispatchNextPayout();
    const currentSpeedSeconds = storage.getSpeed();
    const waitMs = Math.max(1000, currentSpeedSeconds * 1000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

// Start loop after 1 second
setTimeout(() => {
  startDynamicPostingLoop();
}, 1000);

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down DollarNest Payout Bot...');
  storage.save();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down DollarNest Payout Bot...');
  storage.save();
  process.exit(0);
});
