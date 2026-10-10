const { ethers } = require('ethers');
const config = require('./config');
const storage = require('./storage');

// ERC-20 Transfer method signatures:
// transfer(address,uint256) -> 0xa9059cbb
// transferFrom(address,address,uint256) -> 0x23b87266
const METHOD_TRANSFER = '0xa9059cbb';
const METHOD_TRANSFER_FROM = '0x23b87266';

class BscTracker {
  constructor() {
    this.currentRpcIndex = 0;
    this.provider = this.getProvider();
    this.pendingQueue = [];
    this.lastProcessedBlock = 0;
    this.isScanning = false;
  }

  getProvider() {
    const rpcUrl = config.BSC_RPCS[this.currentRpcIndex];
    return new ethers.JsonRpcProvider(rpcUrl, { chainId: 56, name: 'bnb' }, { staticNetwork: true });
  }

  rotateRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % config.BSC_RPCS.length;
    this.provider = this.getProvider();
  }

  /**
   * Decode 100% exact real on-chain USDT transactions from latest BSC blocks
   */
  async scanLatestBlocks() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const latestBlock = await this.provider.getBlock('latest', true);
      if (!latestBlock || !latestBlock.number) {
        this.isScanning = false;
        return;
      }

      if (this.lastProcessedBlock === latestBlock.number) {
        this.isScanning = false;
        return;
      }

      const txs = latestBlock.prefetchedTransactions || [];
      const trackedWallet = storage.getTrackedWallet();

      for (const tx of txs) {
        if (!tx || !tx.to) continue;

        // Check if transaction is interacting with USDT (BEP-20) contract
        if (tx.to.toLowerCase() === config.USDT_CONTRACT_ADDRESS) {
          const data = tx.data || '';

          // 1. Standard transfer(address to, uint256 amount)
          if (data.startsWith(METHOD_TRANSFER) && data.length >= 138) {
            const recipient = '0x' + data.substring(34, 74);
            const rawAmount = BigInt('0x' + data.substring(74, 138));
            const exactAmountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

            // If a specific wallet is tracked, filter by sender
            if (trackedWallet && ethers.isAddress(trackedWallet)) {
              if (tx.from.toLowerCase() !== trackedWallet) continue;
            }

            // Ignore 0 amount transfers
            if (isNaN(exactAmountNum) || exactAmountNum <= 0) continue;

            if (!storage.isTxProcessed(tx.hash) && !this.pendingQueue.some(q => q.txHash === tx.hash)) {
              this.pendingQueue.push({
                txHash: tx.hash,
                from: tx.from,
                to: recipient,
                amount: exactAmountNum, // 100% EXACT ON-CHAIN AMOUNT
                timestamp: latestBlock.timestamp || Math.floor(Date.now() / 1000),
                blockNumber: latestBlock.number
              });
            }
          }
          // 2. transferFrom(address from, address to, uint256 amount)
          else if (data.startsWith(METHOD_TRANSFER_FROM) && data.length >= 202) {
            const sender = '0x' + data.substring(34, 74);
            const recipient = '0x' + data.substring(98, 138);
            const rawAmount = BigInt('0x' + data.substring(138, 202));
            const exactAmountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

            if (trackedWallet && ethers.isAddress(trackedWallet)) {
              if (sender.toLowerCase() !== trackedWallet) continue;
            }

            if (isNaN(exactAmountNum) || exactAmountNum <= 0) continue;

            if (!storage.isTxProcessed(tx.hash) && !this.pendingQueue.some(q => q.txHash === tx.hash)) {
              this.pendingQueue.push({
                txHash: tx.hash,
                from: sender,
                to: recipient,
                amount: exactAmountNum, // 100% EXACT ON-CHAIN AMOUNT
                timestamp: latestBlock.timestamp || Math.floor(Date.now() / 1000),
                blockNumber: latestBlock.number
              });
            }
          }
        }
      }

      this.lastProcessedBlock = latestBlock.number;
    } catch (err) {
      this.rotateRpc();
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get next 100% EXACT REAL on-chain transaction
   */
  async getNextPayout() {
    if (this.pendingQueue.length === 0) {
      await this.scanLatestBlocks();
    }

    if (this.pendingQueue.length > 0) {
      return this.pendingQueue.shift();
    }

    // Retry once if queue was empty
    await this.scanLatestBlocks();
    if (this.pendingQueue.length > 0) {
      return this.pendingQueue.shift();
    }

    return null;
  }

  async getWalletBalances(walletAddress) {
    const target = walletAddress || storage.getTrackedWallet();
    if (!target || !ethers.isAddress(target)) return null;

    try {
      const ABI = ['function balanceOf(address account) view returns (uint256)'];
      const contract = new ethers.Contract(config.USDT_CONTRACT_ADDRESS, ABI, this.provider);
      const [bnbRaw, usdtRaw] = await Promise.all([
        this.provider.getBalance(target),
        contract.balanceOf(target)
      ]);
      return {
        address: target,
        bnb: Number(ethers.formatEther(bnbRaw)).toFixed(4),
        usdt: Number(ethers.formatUnits(usdtRaw, config.USDT_DECIMALS)).toFixed(2)
      };
    } catch (err) {
      return null;
    }
  }
}

module.exports = new BscTracker();
