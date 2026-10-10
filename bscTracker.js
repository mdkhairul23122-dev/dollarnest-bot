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
    this.lastScannedBlock = 0;
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
   * Scan BSC blocks to collect real on-chain USDT transactions strictly in the 0.10 to 0.50 USDT range
   */
  async scanBlocksForMicroRange() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      if (!currentBlock) {
        this.isScanning = false;
        return;
      }

      if (!this.lastScannedBlock || (currentBlock - this.lastScannedBlock) > 50) {
        this.lastScannedBlock = currentBlock - 20;
      }

      const startBlock = this.lastScannedBlock + 1;
      const endBlock = Math.min(currentBlock, startBlock + 15);

      if (startBlock > currentBlock) {
        // Also check recent blocks to populate queue if empty
        if (this.pendingQueue.length === 0) {
          this.lastScannedBlock = currentBlock - 25;
        }
        this.isScanning = false;
        return;
      }

      const trackedWallet = storage.getTrackedWallet();

      for (let bNum = startBlock; bNum <= endBlock; bNum++) {
        try {
          const block = await this.provider.getBlock(bNum, true);
          if (!block || !block.prefetchedTransactions) continue;

          for (const tx of block.prefetchedTransactions) {
            if (!tx || !tx.to) continue;

            // Check USDT contract
            if (tx.to.toLowerCase() === config.USDT_CONTRACT_ADDRESS) {
              const data = tx.data || '';

              // Standard transfer(to, amount)
              if (data.startsWith(METHOD_TRANSFER) && data.length >= 138) {
                const recipient = '0x' + data.substring(34, 74);
                const rawAmount = BigInt('0x' + data.substring(74, 138));
                const exactAmountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

                if (trackedWallet && ethers.isAddress(trackedWallet)) {
                  if (tx.from.toLowerCase() !== trackedWallet) continue;
                }

                // STRICT RANGE: 0.10 <= amount <= 0.50 USDT
                if (exactAmountNum >= config.MIN_AMOUNT && exactAmountNum <= config.MAX_AMOUNT) {
                  if (!storage.isTxProcessed(tx.hash) && !this.pendingQueue.some(q => q.txHash === tx.hash)) {
                    this.pendingQueue.push({
                      txHash: tx.hash,
                      from: tx.from,
                      to: recipient,
                      amount: exactAmountNum,
                      timestamp: block.timestamp || Math.floor(Date.now() / 1000),
                      blockNumber: block.number
                    });
                  }
                }
              }
              // transferFrom(from, to, amount)
              else if (data.startsWith(METHOD_TRANSFER_FROM) && data.length >= 202) {
                const sender = '0x' + data.substring(34, 74);
                const recipient = '0x' + data.substring(98, 138);
                const rawAmount = BigInt('0x' + data.substring(138, 202));
                const exactAmountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

                if (trackedWallet && ethers.isAddress(trackedWallet)) {
                  if (sender.toLowerCase() !== trackedWallet) continue;
                }

                // STRICT RANGE: 0.10 <= amount <= 0.50 USDT
                if (exactAmountNum >= config.MIN_AMOUNT && exactAmountNum <= config.MAX_AMOUNT) {
                  if (!storage.isTxProcessed(tx.hash) && !this.pendingQueue.some(q => q.txHash === tx.hash)) {
                    this.pendingQueue.push({
                      txHash: tx.hash,
                      from: sender,
                      to: recipient,
                      amount: exactAmountNum,
                      timestamp: block.timestamp || Math.floor(Date.now() / 1000),
                      blockNumber: block.number
                    });
                  }
                }
              }
            }
          }
        } catch (_) {}
      }

      this.lastScannedBlock = endBlock;
    } catch (err) {
      this.rotateRpc();
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get next real BSC transaction strictly in 0.1 - 0.5 USDT range
   */
  async getNextPayout() {
    if (this.pendingQueue.length === 0) {
      await this.scanBlocksForMicroRange();
    }

    if (this.pendingQueue.length > 0) {
      return this.pendingQueue.shift();
    }

    // Try scanning deeper back if queue is empty
    this.lastScannedBlock = Math.max(0, this.lastScannedBlock - 30);
    await this.scanBlocksForMicroRange();

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
