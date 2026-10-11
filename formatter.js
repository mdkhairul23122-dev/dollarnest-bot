/**
 * DollarNest Telegram Message Formatter (Multi-Chain: BSC USDT & ETH USDC)
 */
const config = require('./config');
const storage = require('./storage');

function formatAddress(address) {
  if (!address) return '0x0000...0000';
  const clean = address.toLowerCase();
  if (clean.length <= 10) return clean;
  return `${clean.substring(0, 6)}...${clean.substring(clean.length - 4)}`;
}

function formatDateTimeParts(timestamp) {
  const date = timestamp ? new Date(timestamp * 1000) : new Date();

  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dateString = `${fullMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;

  return { dateString, timeString };
}

// 100% Real, Diverse Telegram Usernames Pool
const REAL_TELEGRAM_USERNAMES = [
  'alexvt', 'davidvt', 'samvt', 'johnvt', 'brianvt', 'markvt', 'kevinvt', 'danvt',
  'alexander', 'david_smith', 'michael_brown', 'daniel_crypto', 'james_wilson',
  'john_miller', 'robert_davis', 'william_taylor', 'richard_anderson', 'thomas_thomas',
  'charles_jackson', 'christopher_white', 'matthew_harris', 'anthony_clark', 'mark_lewis',
  'donald_walker', 'steven_hall', 'paul_allen', 'andrew_young', 'joshua_king',
  'kenneth_wright', 'kevin_scott', 'brian_torres', 'george_nguyen', 'edward_hill',
  'ronald_flores', 'timothy_green', 'jason_adams', 'jeffrey_nelson', 'ryan_baker',
  'jacob_hall', 'gary_rivera', 'nicholas_campbell', 'eric_mitchell', 'jonathan_carter',
  'stephen_roberts', 'larry_gomez', 'justin_phillips', 'scott_evans', 'brandon_turner',
  'benjamin_diaz', 'samuel_parker', 'gregory_cruz', 'frank_edwards', 'alexander_collins',
  'raymond_reyes', 'patrick_stewart', 'jack_morris', 'dennis_morales', 'jerry_murphy',
  'tyler_cook', 'aaron_rogers', 'jose_gutierrez', 'henry_ortiz', 'adam_morgan',
  'douglas_cooper', 'nathan_peterson', 'peter_bailey', 'zachary_reed', 'kyle_kelly',
  'walter_howard', 'harold_ramos', 'jeremy_kim', 'ethan_cox', 'carl_ward',
  'keith_richardson', 'roger_watson', 'gerald_brooks', 'christian_chavez', 'terry_wood',
  'sean_james', 'arthur_bennett', 'austin_gray', 'noah_mendoza', 'lawrence_ruiz',
  'jesse_hughes', 'joe_price', 'bryan_alvarez', 'billy_castillo', 'jordan_sanders',
  'albert_patel', 'dylan_myers', 'bruce_long', 'willie_ross', 'gabriel_foster',
  'logan_jimenez', 'alan_powell', 'juan_jenkins', 'wayne_perry', 'roy_russell',
  'ralph_sullivan', 'randy_bell', 'eugene_coleman', 'vincent_butler', 'russell_henderson',
  'louis_barnes', 'philip_gonzales', 'bobby_fisher', 'johnny_vasquez', 'bradley_simmons',
  'elena_petrova', 'sophia_williams', 'olivia_davis', 'emma_johnson', 'ava_brown',
  'isabella_jones', 'mia_miller', 'clara_wilson', 'natalia_k', 'victoria_secret',
  'anna_k', 'maria_garcia', 'chloe_smith', 'hannah_montana', 'zoe_kraus',
  'karim_khan', 'tanvir_ahmed', 'hasan_ali', 'rahim_crypto', 'arif_hossain',
  'stefan_m', 'marco_polo', 'sergey_b', 'andrei_t', 'viktor_k', 'maxim_g',
  'julian_c', 'sebastian_v', 'mateo_r', 'leon_s', 'oscar_w', 'leo_messi'
];

// Common name and handle prefixes for dynamic generation
const TELEGRAM_PREFIXES = [
  'Dk', 'Al', 'Sk', 'Md', 'Jo', 'Ro', 'Ka', 'Ta', 'Ha', 'Sa',
  'Cr', 'Mr', 'Mi', 'Da', 'Em', 'So', 'Ol', 'Ch', 'Ma', 'Lu',
  'Vi', 'An', 'St', 'Ke', 'Ra', 'Sh', 'Ar', 'Fa', 'Ze', 'Ni',
  'dk', 'al', 'sk', 'md', 'jo', 'ro', 'ka', 'ta', 'ha', 'sa'
];

const TELEGRAM_LETTER_SUFFIXES = [
  'vt', 'th', 'rt', 'wn', 'to', 'im', 'an', 'ny', 'el', 'ra',
  'ia', 'is', 'va', 'te', 'er', 'ex', 'in', 'on', 'us', 'dy'
];

/**
 * Mask username into formats:
 * - Number ending: @Dk***54, @Al***92, @Sk***77
 * - Letter ending: @al**vt, @da**th, @ka**im
 */
function maskUsername(username) {
  if (!username) return '@Dk***54';
  let clean = String(username).trim();
  if (!clean.startsWith('@')) clean = '@' + clean;

  // If already masked (contains *), keep as is (e.g. @Dk***54 or @al**vt)
  if (clean.includes('*')) {
    return clean;
  }

  // Extract clean alphanumeric characters
  const raw = clean.slice(1).replace(/[^a-zA-Z0-9]/g, '');
  if (!raw) return '@Dk***54';

  // Check if username ends with digits (e.g. Dk54, alex99, user07)
  const numMatch = raw.match(/^([a-zA-Z]+)(\d+)$/);
  if (numMatch) {
    const letters = numMatch[1];
    const digits = numMatch[2];
    const prefix = letters.length >= 2 ? letters.slice(0, 2) : (letters + 'x');
    const suffix = digits.length >= 2 ? digits.slice(-2) : ('0' + digits);
    return `@${prefix}***${suffix}`;
  }

  // Pure letters or general handles (e.g. alexvt -> @al**vt)
  let handle = raw;
  if (handle.length < 4) {
    handle = handle + 'vt';
  }

  const prefix = handle.slice(0, 2);
  const suffix = handle.slice(-2);
  return `@${prefix}**${suffix}`;
}

/**
 * Generate a random masked username (both @Dk***54 number-based and @al**vt letter-based)
 */
function generateUsername() {
  const customList = storage.getCustomUsernames();
  if (customList && customList.length > 0) {
    const index = Math.floor(Math.random() * customList.length);
    return maskUsername(customList[index]);
  }

  // 60% chance of number ending (like @Dk***54), 40% chance of letter ending (like @al**vt)
  const isNumberType = Math.random() < 0.6;
  const prefix = TELEGRAM_PREFIXES[Math.floor(Math.random() * TELEGRAM_PREFIXES.length)];

  if (isNumberType) {
    const num = Math.floor(Math.random() * 90) + 10; // 10 to 99
    return `@${prefix}***${num}`;
  }

  // Letter ending: either pick from REAL_TELEGRAM_USERNAMES or dynamic suffix
  if (Math.random() < 0.5) {
    const suffix = TELEGRAM_LETTER_SUFFIXES[Math.floor(Math.random() * TELEGRAM_LETTER_SUFFIXES.length)];
    return `@${prefix.toLowerCase()}**${suffix}`;
  } else {
    const index = Math.floor(Math.random() * REAL_TELEGRAM_USERNAMES.length);
    return maskUsername(REAL_TELEGRAM_USERNAMES[index]);
  }
}

function formatPayoutMessage({ amount, from, to, txHash, timestamp, botUsername, username, network, tokenSymbol, explorerBaseUrl }) {
  const numAmount = parseFloat(amount);
  const token = tokenSymbol || 'USDT';
  const formattedAmount = `${Number(numAmount.toFixed(4))} ${token}`;
  const { dateString, timeString } = formatDateTimeParts(timestamp);
  const fromShort = formatAddress(from);
  const toShort = formatAddress(to);
  const userTag = maskUsername(username || generateUsername());
  const botTag = botUsername || config.BOT_USERNAME || '@DollarNestInvatorbot';
  
  const isEthereum = network && network.toLowerCase().includes('ethereum');
  const netName = isEthereum ? 'Ethereum (ERC-20)' : 'Binance Smart Chain (BEP-20)';
  const netProtocol = isEthereum ? 'ERC-20' : 'BEP-20';
  const explorerName = isEthereum ? 'Etherscan' : 'BscScan';
  const baseUrl = explorerBaseUrl || (isEthereum ? 'https://etherscan.io' : 'https://bscscan.com');
  
  const txUrl = `${baseUrl}/tx/${txHash}`;
  const receiverUrl = `${baseUrl}/address/${to}`;
  const senderUrl = `${baseUrl}/address/${from}`;

  const message = [
    `💎 <b>DollarNest | Payout Review</b> 💎`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🚀 <b>NEW WITHDRAWAL CONFIRMED!</b> ✅`,
    `💚 Successfully Paid via ${netProtocol}`,
    `👤 <b>Username:</b> ${userTag}`,
    `💰 <b>Amount:</b> <code>${formattedAmount}</code>`,
    `📥 <b>From Wallet:</b>`,
    `<a href="${senderUrl}"><code>${fromShort}</code></a>`,
    `📤 <b>To Wallet:</b>`,
    `<a href="${receiverUrl}"><code>${toShort}</code></a>`,
    `🌐 <b>Network:</b> ${netName}`,
    `🕒 <b>Date:</b> ${dateString}`,
    `⏰ <b>Time:</b> ${timeString}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔗 <b>Verify Transaction on ${explorerName}</b>`,
    `👉 ${txUrl}`,
    `💸 Fast • Secure • Transparent`,
    `🤖 <b>Official Bot:</b> ${botTag}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💎 <b>DollarNest — Your Rewards, Your Success!</b> 🚀`
  ].join('\n');

  return { message, txUrl };
}

function formatTestPayoutMessage() {
  const sampleTx = '0x92bf1aa5281681518ec5d1e94aabada8cfd4df4e123804d63d';
  return formatPayoutMessage({
    amount: '0.2053',
    tokenSymbol: 'USDT',
    network: 'Binance Smart Chain (BEP-20)',
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
  generateUsername,
  maskUsername
};
