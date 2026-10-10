const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_FILE = path.join(__dirname, 'data.json');

class Storage {
  constructor() {
    this.data = {
      trackedWallet: config.TRACK_WALLET || '',
      speedSeconds: 75, // 1 to 2 minutes
      lastCheckedBlock: 0,
      processedTxHashes: [],
      customUsernames: [],
      payoutCount: 0,
      totalUsdtSent: 0
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...parsed,
          processedTxHashes: Array.isArray(parsed.processedTxHashes) ? parsed.processedTxHashes : [],
          customUsernames: Array.isArray(parsed.customUsernames) ? parsed.customUsernames : []
        };
      }
      // If config has wallet and storage doesn't, sync from config
      if (!this.data.trackedWallet && config.TRACK_WALLET) {
        this.data.trackedWallet = config.TRACK_WALLET.toLowerCase();
      }
    } catch (err) {
      console.error('[Storage] Error loading data.json:', err.message);
    }
  }

  save() {
    try {
      // Keep only latest 3000 tx hashes to save disk space
      if (this.data.processedTxHashes.length > 3000) {
        this.data.processedTxHashes = this.data.processedTxHashes.slice(-2000);
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Error saving data.json:', err.message);
    }
  }

  getTrackedWallet() {
    return (this.data.trackedWallet || '').toLowerCase();
  }

  setTrackedWallet(address) {
    this.data.trackedWallet = (address || '').trim().toLowerCase();
    this.save();
  }

  getSpeed() {
    return this.data.speedSeconds || 4;
  }

  setSpeed(seconds) {
    this.data.speedSeconds = Math.max(1, parseInt(seconds, 10) || 4);
    this.save();
  }

  getCustomUsernames() {
    return Array.isArray(this.data.customUsernames) ? this.data.customUsernames : [];
  }

  setCustomUsernames(usernames) {
    if (Array.isArray(usernames)) {
      this.data.customUsernames = usernames
        .map(u => String(u).trim().replace(/^@+/, ''))
        .filter(u => u.length > 0)
        .map(u => `@${u}`);
      this.save();
      return this.data.customUsernames;
    }
    return [];
  }

  clearCustomUsernames() {
    this.data.customUsernames = [];
    this.save();
  }

  isTxProcessed(txHash) {
    if (!txHash) return true;
    return this.data.processedTxHashes.includes(txHash.toLowerCase());
  }

  addProcessedTx(txHash, amount = 0) {
    if (!txHash) return;
    const lower = txHash.toLowerCase();
    if (!this.data.processedTxHashes.includes(lower)) {
      this.data.processedTxHashes.push(lower);
      this.data.payoutCount = (this.data.payoutCount || 0) + 1;
      this.data.totalUsdtSent = Number(((this.data.totalUsdtSent || 0) + Number(amount)).toFixed(4));
      this.save();
    }
  }

  getLastCheckedBlock() {
    return this.data.lastCheckedBlock || 0;
  }

  setLastCheckedBlock(blockNumber) {
    this.data.lastCheckedBlock = blockNumber;
    this.save();
  }

  getStats() {
    return {
      trackedWallet: this.data.trackedWallet,
      payoutCount: this.data.payoutCount || 0,
      totalUsdtSent: this.data.totalUsdtSent || 0,
      recordedTxs: this.data.processedTxHashes.length,
      lastCheckedBlock: this.data.lastCheckedBlock
    };
  }
}

module.exports = new Storage();
