/**
 * DollarNest Telegram Message Formatter (New VIP Layout)
 */
const config = require('./config');

function formatAddress(address) {
  if (!address) return '0x0000...0000';
  const clean = address.toLowerCase();
  if (clean.length <= 10) return clean;
  return `${clean.substring(0, 6)}...${clean.substring(clean.length - 4)}`;
}

function formatDateTimeParts(timestamp) {
  const date = timestamp ? new Date(timestamp * 1000) : new Date();

  // Date format: "October 10, 2026"
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dateString = `${fullMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  // Time format: "6:52:57 PM"
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;

  return { dateString, timeString };
}

function generateUsername(toAddress) {
  if (toAddress && toAddress.length > 10) {
    let hash = 0;
    for (let i = 0; i < toAddress.length; i++) {
      hash = ((hash << 5) - hash) + toAddress.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash) % 9000000000 + 1000000000;
    return `@user_${positiveHash}`;
  }
  const randomNum = Math.floor(1000000000 + Math.random() * 9000000000);
  return `@user_${randomNum}`;
}

function formatPayoutMessage({ amount, from, to, txHash, timestamp, botUsername, username }) {
  const numAmount = parseFloat(amount);
  const formattedAmount = `${numAmount.toFixed(4)} USDT`;
  const { dateString, timeString } = formatDateTimeParts(timestamp);
  const fromShort = formatAddress(from || '0x1cc0547688299fa3ad124dc4fee278fdcbd38c10');
  const toShort = formatAddress(to);
  const userTag = username || generateUsername(to);
  const botTag = botUsername || config.BOT_USERNAME || '@DollarNestInvatorbot';
  const bscScanTxUrl = `https://bscscan.com/tx/${txHash}`;

  const message = [
    `💎 <b>DollarNest | Payout Review</b> 💎`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🚀 <b>NEW WITHDRAWAL CONFIRMED!</b> ✅`,
    `💚 Successfully Paid via BEP-20`,
    `👤 <b>Username:</b> ${userTag}`,
    `💰 <b>Amount:</b> <code>${formattedAmount}</code>`,
    `📥 <b>From Wallet:</b>`,
    `<code>${fromShort}</code>`,
    `📤 <b>To Wallet:</b>`,
    `<code>${toShort}</code>`,
    `🌐 <b>Network:</b> Binance Smart Chain (BEP-20)`,
    `🕒 <b>Date:</b> ${dateString}`,
    `⏰ <b>Time:</b> ${timeString}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔗 <b>Verify Transaction on BscScan</b>`,
    `👉 ${bscScanTxUrl}`,
    `💸 Fast • Secure • Transparent`,
    `🤖 <b>Official Bot:</b> ${botTag}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💎 <b>DollarNest — Your Rewards, Your Success!</b> 🚀`
  ].join('\n');

  return { message, bscScanTxUrl };
}

function formatTestPayoutMessage() {
  const sampleTx = '0x92bf1aa5281681518ec5d1e94aabada8cfd4df4e123804d63d';
  return formatPayoutMessage({
    amount: '0.2053',
    from: '0x1cc0547688299fa3ad124dc4fee278fdcbb32',
    to: '0xaa2845c1234567890abcdef1234567890aa00246',
    txHash: sampleTx,
    timestamp: Math.floor(Date.now() / 1000)
  });
}

module.exports = {
  formatPayoutMessage,
  formatTestPayoutMessage,
  formatAddress,
  formatDateTimeParts
};
