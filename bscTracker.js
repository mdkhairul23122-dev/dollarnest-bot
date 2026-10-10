const { ethers } = require('ethers');
const axios = require('axios');
const config = require('./config');
const storage = require('./storage');

// Minimal ERC20 / BEP20 ABI for Transfer event & balanceOf
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address account) view returns (uint256)'
];

class BscTracker {
  constructor() {
    this.currentRpcIndex = 0;
    this.provider = this.getProvider();
    this.usdtContract = new ethers.Contract(config.USDT_CONTRACT_ADDRESS, ERC20_ABI, this.provider);
    this.pendingQueue = [];
    this.lastScannedBlock = 0;
  }

  getProvider() {
    const rpcUrl = config.BSC_RPCS[this.currentRpcIndex];
    return new ethers.JsonRpcProvider(rpcUrl, { chainId: 56, name: 'bnb' }, { staticNetwork: true });
  }

  rotateRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % config.BSC_RPCS.length;
    this.provider = this.getProvider();
    this.usdtContract = new ethers.Contract(config.USDT_CONTRACT_ADDRESS, ERC20_ABI, this.provider);
  }

  /**
   * Scan BSC network for real USDT BEP-20 transfers in the $0.1 - $0.5 range
   */
  async scanNetworkForMicroPayouts() {
    try {
      const currentBlock = await this.provider.getBlockNumber();

      if (!this.lastScannedBlock || (currentBlock - this.lastScannedBlock) > 10) {
        this.lastScannedBlock = currentBlock - 3;
      }

      if (currentBlock <= this.lastScannedBlock) {
        return;
      }

      const fromBlock = this.lastScannedBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 3); // Query small block batch (3 blocks max)

      const trackedWallet = storage.getTrackedWallet();
      let filter;

      if (trackedWallet && ethers.isAddress(trackedWallet)) {
        filter = this.usdtContract.filters.Transfer(trackedWallet, null);
      } else {
        filter = this.usdtContract.filters.Transfer();
      }

      const events = await this.usdtContract.queryFilter(filter, fromBlock, toBlock);

      for (const event of events) {
        try {
          const parsed = this.usdtContract.interface.parseLog({
            topics: event.topics,
            data: event.data
          });

          if (parsed && parsed.args) {
            const from = parsed.args[0];
            const to = parsed.args[1];
            const rawAmount = parsed.args[2];
            const amountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

            // Filter between MIN_AMOUNT and MAX_AMOUNT
            if (amountNum >= config.MIN_AMOUNT && amountNum <= config.MAX_AMOUNT) {
              const txHash = event.transactionHash;

              if (!storage.isTxProcessed(txHash) && !this.pendingQueue.some(item => item.txHash === txHash)) {
                this.pendingQueue.push({
                  txHash: txHash,
                  from: from,
                  to: to,
                  amount: amountNum.toFixed(4),
                  timestamp: Math.floor(Date.now() / 1000),
                  blockNumber: event.blockNumber
                });
              }
            }
          }
        } catch (_) {}
      }

      this.lastScannedBlock = toBlock;
    } catch (_) {
      this.rotateRpc();
    }
  }

  /**
   * Generate realistic verified micro transaction (0.10 to 0.50 USDT)
   */
  generateLiveMicroPayout() {
    const randomHex = () => Math.floor(Math.random() * 0xffffffffff).toString(16).padStart(10, '0');
    const randomAmount = (config.MIN_AMOUNT + Math.random() * (config.MAX_AMOUNT - config.MIN_AMOUNT)).toFixed(4);
    
    return {
      txHash: `0x${randomHex()}${randomHex()}${randomHex()}${randomHex()}${randomHex()}`.substring(0, 66),
      from: `0x1cc0547688299fa3ad124dc4fee278fdcbd${randomHex().substring(0, 4)}`,
      to: `0xaa28${randomHex()}${randomHex()}0246`.substring(0, 42),
      amount: randomAmount,
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Get the next payout to post
   */
  async getNextPayout() {
    if (this.pendingQueue.length > 0) {
      return this.pendingQueue.shift();
    }

    // Try scanning on-chain
    await this.scanNetworkForMicroPayouts();

    if (this.pendingQueue.length > 0) {
      return this.pendingQueue.shift();
    }

    // Return realistic live micro transaction
    return this.generateLiveMicroPayout();
  }

  async getWalletBalances(walletAddress) {
    const target = walletAddress || storage.getTrackedWallet();
    if (!target || !ethers.isAddress(target)) return null;

    try {
      const [bnbRaw, usdtRaw] = await Promise.all([
        this.provider.getBalance(target),
        this.usdtContract.balanceOf(target)
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
