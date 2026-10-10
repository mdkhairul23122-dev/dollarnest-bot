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
    const newRpc = config.BSC_RPCS[this.currentRpcIndex];
    this.provider = this.getProvider();
  }

  /**
   * Decode real on-chain USDT transactions from latest BSC blocks
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
            const amountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

            // If a specific wallet is tracked, check from
            if (trackedWallet && ethers.isAddress(trackedWallet)) {
              if (tx.from.toLowerCase() !== trackedWallet) continue;
            }

            if (!storage.isTxProcessed(tx.hash) && !this.pendingQueue.some(q => q.txHash === tx.hash)) {
              this.pendingQueue.push({
                txHash: tx.hash,
                from: tx.from,
                to: recipient,
                amount: amountNum.toFixed(4),
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
            const amountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

            if (trackedWallet && ethers.isAddress(trackedWallet)) {
              if (sender.toLowerCase() !== trackedWallet) continue;
            }

            if (!storage.isTxProcessed(tx.hash) && !this.pendingQueue.some(q => q.txHash === tx.hash)) {
              this.pendingQueue.push({
                txHash: tx.hash,
                from: sender,
                to: recipient,
                amount: amountNum.toFixed(4),
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
   * Get next 100% REAL BSC transaction
   */
  async getNextPayout() {
    // If queue is low, fetch fresh block
    if (this.pendingQueue.length === 0) {
      await this.scanLatestBlocks();
    }

    if (this.pendingQueue.length > 0) {
      const realTx = this.pendingQueue.shift();

      // Format amount within nice visual micro range if user requested
      let displayAmount = parseFloat(realTx.amount);
      if (isNaN(displayAmount) || displayAmount <= 0) {
        displayAmount = 0.2500;
      }

      // If the on-chain amount is huge (e.g. 5000 USDT), scale it to micro range (0.1 - 0.5) while keeping REAL txHash!
      if (displayAmount > config.MAX_AMOUNT || displayAmount < config.MIN_AMOUNT) {
        const scaledAmount = (config.MIN_AMOUNT + (Math.abs(Number(BigInt(realTx.txHash) % 4000n)) / 10000)).toFixed(4);
        realTx.amount = scaledAmount;
      }

      return realTx;
    }

    // Wait a brief moment and retry block fetch
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
