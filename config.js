require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || '8966410128:AAHMhaYhNfm5keEdqich_1xrmI3UIgCv7JM',
  CHANNEL_ID: process.env.CHANNEL_ID || '@DollarNest_Payout',
  BOT_USERNAME: process.env.BOT_USERNAME || '@DollarNestInvatorbot',

  // Amount Filter (0.1 to 0.5 USDT)
  MIN_AMOUNT: parseFloat(process.env.MIN_AMOUNT || '0.1'),
  MAX_AMOUNT: parseFloat(process.env.MAX_AMOUNT || '0.5'),

  // Default Speed: Fast (every 4 seconds = 15 messages/minute)
  // Can be customized via .env or /setspeed command
  DEFAULT_POST_INTERVAL_MS: parseInt(process.env.POST_INTERVAL_SECONDS || '4', 10) * 1000, 

  BSCSCAN_API_KEY: process.env.BSCSCAN_API_KEY || '',
  ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID, 10) : null,

  // BSC USDT Contract Details (BEP-20)
  USDT_CONTRACT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955'.toLowerCase(),
  USDT_DECIMALS: 18,

  // Robust public BSC RPC URLs list
  BSC_RPCS: [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
    'https://binance.llamarpc.com',
    'https://rpc.ankr.com/bsc'
  ],

  // BscScan API Endpoint
  BSCSCAN_API_URL: 'https://api.bscscan.com/api'
};
