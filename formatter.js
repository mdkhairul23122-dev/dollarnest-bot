/**
 * DollarNest Telegram Message Formatter (Exact layout matching user design)
 */
const config = require('./config');

function formatAddress(address) {
  if (!address) return '0x0000...0000';
  const clean = address.toLowerCase();
  if (clean.length <= 10) return clean;
  return `${clean.substring(0, 6)}...${clean.substring(clean.length - 4)}`;
}

function formatDate(timestamp) {
  const date = timestamp ? new Date(timestamp * 1000) : new Date();
  
  // Format: "Oct 10, 2026, 6:12:38 PM"
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12

  return `${month} ${day}, ${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

function generateUsername(toAddress) {
  if (toAddress && toAddress.length > 10) {
    // Generate a consistent pseudo-random 10 digit number from recipient address
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
  const timeString = formatDate(timestamp);
  const fromShort = formatAddress(from || '0x55d398326f99059ff775485246999027b3197955');
  const toShort = formatAddress(to);
  const userTag = username || generateUsername(to);
  const botTag = botUsername || config.BOT_USERNAME || '@DollarNestInvatorbot';
  const bscScanTxUrl = `https://bscscan.com/tx/${txHash}`;

  const message = [
    `<b>DollarNest Payout review</b>`,
    `🚀 <b>New Withdrawal Confirmed! (BSC Network)</b>`,
    ``,
    `🌐 <b>Username:</b> ${userTag}`,
    `💰 <b>Amount:</b> ${formattedAmount}`,
    `📥 <b>From:</b> <code>${fromShort}</code>`,
    `📤 <b>To:</b> <code>${toShort}</code>`,
    `🌐 <b>Network:</b> Binance Smart Chain (BEP-20)`,
    `🕒 <b>Time:</b> ${timeString}`,
    `🤖 <b>Bot:</b> ${botTag}`,
    ``,
    `🔗 <a href="${bscScanTxUrl}">View on BscScan</a>`
  ].join('\n');

  return { message, bscScanTxUrl };
}

function formatTestPayoutMessage() {
  const sampleTx = '0x126da80e866e4a2829b4e78a635677c7ec515b1fbaf0e7d5eb8db93540d99ef8';
  return formatPayoutMessage({
    amount: '0.3500',
    from: '0x1cc0547688299fa3ad124dc4fee278fdcbd38c10',
    to: '0xaa2845c1234567890abcdef1234567890aa00246',
    txHash: sampleTx,
    timestamp: Math.floor(Date.now() / 1000)
  });
}

module.exports = {
  formatPayoutMessage,
  formatTestPayoutMessage,
  formatAddress,
  formatDate
};
