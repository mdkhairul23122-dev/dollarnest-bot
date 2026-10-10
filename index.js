const http = require('http');
const config = require('./config');
const storage = require('./storage');
const bscTracker = require('./bscTracker');
const telegramBot = require('./telegramBot');

console.log('====================================================');
console.log('🚀 DollarNest Multi-Chain (BSC & ETH) Payout Bot Starting...');
console.log(`📢 Target Channel: ${config.CHANNEL_ID}`);
console.log(`⏱ Schedule: BSC (USDT) every 2 mins | ETH (USDC) every 30 mins`);
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

let isBscProcessing = false;
let isEthProcessing = false;

async function dispatchBscPayout() {
  if (isBscProcessing) return;
  isBscProcessing = true;

  try {
    const payout = await bscTracker.getNextBscPayout();
    if (payout) {
      console.log(`[BSC Dispatcher] 📤 Sending: ${payout.amount} USDT (Tx: ${payout.txHash})`);
      await telegramBot.sendPayoutNotification(payout);
    }
  } catch (err) {
    console.error('[BSC Dispatcher] Error:', err.message);
  } finally {
    isBscProcessing = false;
  }
}

async function dispatchEthPayout() {
  if (isEthProcessing) return;
  isEthProcessing = true;

  try {
    const payout = await bscTracker.getNextEthPayout();
    if (payout) {
      console.log(`[ETH Dispatcher] 📤 Sending: ${payout.amount} USDC (Tx: ${payout.txHash})`);
      await telegramBot.sendPayoutNotification(payout);
    }
  } catch (err) {
    console.error('[ETH Dispatcher] Error:', err.message);
  } finally {
    isEthProcessing = false;
  }
}

// Background scanner loop every 20s to keep both chain queues populated
setInterval(async () => {
  try {
    await bscTracker.scanAllChains();
  } catch (_) {}
}, 20000);

// BSC USDT posting loop (Every 2 minutes ~ 120s)
async function startBscPostingLoop() {
  while (true) {
    await dispatchBscPayout();
    const bscMinutes = 2; // 2 minutes
    const randomOffset = Math.floor(Math.random() * 20) - 10;
    const finalSeconds = (bscMinutes * 60) + randomOffset; // ~110s - 130s (2 minutes)
    console.log(`[BSC Dispatcher] ⏳ Next BSC USDT post in ${finalSeconds}s (~2 min)...`);
    await new Promise((resolve) => setTimeout(resolve, finalSeconds * 1000));
  }
}

// Ethereum USDC posting loop (Strictly every 30 minutes)
async function startEthPostingLoop() {
  // First ETH post after 3 minutes so it doesn't clash at initial boot
  await new Promise((resolve) => setTimeout(resolve, 3 * 60 * 1000));

  while (true) {
    await dispatchEthPayout();
    const ethMinutes = 30; // 30 minutes
    const randomOffsetSec = Math.floor(Math.random() * 60) - 30;
    const finalSeconds = (ethMinutes * 60) + randomOffsetSec;
    console.log(`[ETH Dispatcher] ⏳ Next Ethereum USDC post in ${(finalSeconds / 60).toFixed(1)} minutes...`);
    await new Promise((resolve) => setTimeout(resolve, finalSeconds * 1000));
  }
}

// Start both posting loops after 3 seconds
setTimeout(() => {
  startBscPostingLoop();
  startEthPostingLoop();
}, 3000);

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
