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
  hours = hours ? hours : 12;
  const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;

  return { dateString, timeString };
}

const FOREIGN_NAMES = [
  'alex', 'david', 'sophia', 'lucas', 'oliver', 'michael', 'elena', 'robert',
  'kevin', 'jason', 'daniel', 'emma', 'arthur', 'dmitry', 'nicolas', 'samuel',
  'maria', 'mark', 'james', 'william', 'liam', 'noah', 'ethan', 'mason',
  'logan', 'jackson', 'aiden', 'clara', 'victoria', 'natalia',
  'stefan', 'marco', 'sergey', 'andrei', 'viktor', 'maxim', 'hannah', 'chloe',
  'julian', 'sebastian', 'mateo', 'leon', 'henry', 'george', 'oscar', 'leo'
];

const FOREIGN_SUFFIXES = [
  '', '_fx', '_crypto', '_trade', '_invest', '_pro', '_92', '_98', '_77',
  '_88', '_01', '_07', '_vip', '_eth', '_bsc', '_usdt', '_king', '_official'
];

function generateUsername(toAddress) {
  let seed = 0;
  if (toAddress && toAddress.length > 10) {
    for (let i = 0; i < toAddress.length; i++) {
      seed = ((seed << 5) - seed) + toAddress.charCodeAt(i);
      seed |= 0;
    }
    seed = Math.abs(seed);
  } else {
    seed = Math.floor(Math.random() * 100000000);
  }

  // 50% chance of @user_XXXXXXXXXX, 50% chance of foreign username
  const typeChance = seed % 10;

  if (typeChance < 5) {
    const userNum = (seed % 9000000000) + 1000000000;
    return `@user_${userNum}`;
  } else {
    const nameIndex = seed % FOREIGN_NAMES.length;
    const suffixIndex = (seed >> 3) % FOREIGN_SUFFIXES.length;
    const name = FOREIGN_NAMES[nameIndex];
    const suffix = FOREIGN_SUFFIXES[suffixIndex];
    
    const numAppend = (suffix === '' || suffix.startsWith('_')) ? (seed % 900 + 10) : '';
    if (suffix === '') {
      return `@${name}_${numAppend}`;
    }
    return `@${name}${suffix}`;
  }
}

function formatPayoutMessage({ amount, from, to, txHash, timestamp, botUsername, username }) {
  const numAmount = parseFloat(amount);
  const formattedAmount = `${Number(numAmount.toFixed(4))} USDT`;
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
    `👤 <b>Username:</b> <code>${userTag}</code>`,
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
  formatDateTimeParts,
  generateUsername
};
