const { ethers } = require('ethers');
const config = require('./config');
const storage = require('./storage');

const METHOD_TRANSFER = '0xa9059cbb';
const METHOD_TRANSFER_FROM = '0x23b87266';

class MultiChainTracker {
  constructor() {
    this.bscRpcIndex = 0;
    this.ethRpcIndex = 0;
    this.bscProvider = this.getBscProvider();
    this.ethProvider = this.getEthProvider();
    this.bscQueue = [];
    this.ethQueue = [];
    this.lastBscBlock = 0;
    this.lastEthBlock = 0;
    this.lastNetworkServed = 'ETH'; // Alternates between BSC and ETH
    this.isScanning = false;
  }

  getBscProvider() {
    const rpcUrl = config.BSC_RPCS[this.bscRpcIndex];
    return new ethers.JsonRpcProvider(rpcUrl, { chainId: 56, name: 'bnb' }, { staticNetwork: true });
  }

  getEthProvider() {
    const rpcUrl = config.ETH_RPCS[this.ethRpcIndex];
    return new ethers.JsonRpcProvider(rpcUrl, { chainId: 1, name: 'mainnet' }, { staticNetwork: true });
  }

  rotateBscRpc() {
    this.bscRpcIndex = (this.bscRpcIndex + 1) % config.BSC_RPCS.length;
    this.bscProvider = this.getBscProvider();
  }

  rotateEthRpc() {
    this.ethRpcIndex = (this.ethRpcIndex + 1) % config.ETH_RPCS.length;
    this.ethProvider = this.getEthProvider();
  }

  /**
   * Scan BSC blocks for real USDT BEP-20 transfers
   */
  async scanBscBlocks() {
    try {
      const currentBlock = await this.bscProvider.getBlockNumber();
      if (!currentBlock) return;

      if (!this.lastBscBlock || (currentBlock - this.lastBscBlock) > 30) {
        this.lastBscBlock = currentBlock - 10;
      }

      const startBlock = this.lastBscBlock + 1;
      const endBlock = Math.min(currentBlock, startBlock + 8);
      if (startBlock > currentBlock) {
        if (this.bscQueue.length === 0) this.lastBscBlock = currentBlock - 15;
        return;
      }

      for (let bNum = startBlock; bNum <= endBlock; bNum++) {
        try {
          const block = await this.bscProvider.getBlock(bNum, true);
          if (!block || !block.prefetchedTransactions) continue;

          for (const tx of block.prefetchedTransactions) {
            if (!tx || !tx.to) continue;

            if (tx.to.toLowerCase() === config.USDT_CONTRACT_ADDRESS) {
              const data = tx.data || '';

              if (data.startsWith(METHOD_TRANSFER) && data.length >= 138) {
                const recipient = '0x' + data.substring(34, 74);
                const rawAmount = BigInt('0x' + data.substring(74, 138));
                const exactAmountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDT_DECIMALS));

                if (!storage.isTxProcessed(tx.hash) && !this.bscQueue.some(q => q.txHash === tx.hash)) {
                  this.bscQueue.push({
                    txHash: tx.hash,
                    from: tx.from,
                    to: recipient,
                    amount: exactAmountNum,
                    tokenSymbol: 'USDT',
                    network: 'Binance Smart Chain (BEP-20)',
                    explorerBaseUrl: 'https://bscscan.com',
                    timestamp: block.timestamp || Math.floor(Date.now() / 1000),
                    blockNumber: block.number
                  });
                }
              }
            }
          }
        } catch (_) {}
      }

      this.lastBscBlock = endBlock;
    } catch (_) {
      this.rotateBscRpc();
    }
  }

  /**
   * Scan Ethereum blocks for real USDC ERC-20 transfers
   */
  async scanEthBlocks() {
    try {
      const currentBlock = await this.ethProvider.getBlockNumber();
      if (!currentBlock) return;

      if (!this.lastEthBlock || (currentBlock - this.lastEthBlock) > 15) {
        this.lastEthBlock = currentBlock - 4;
      }

      const startBlock = this.lastEthBlock + 1;
      const endBlock = Math.min(currentBlock, startBlock + 3);
      if (startBlock > currentBlock) {
        if (this.ethQueue.length === 0) this.lastEthBlock = currentBlock - 8;
        return;
      }

      for (let bNum = startBlock; bNum <= endBlock; bNum++) {
        try {
          const block = await this.ethProvider.getBlock(bNum, true);
          if (!block || !block.prefetchedTransactions) continue;

          for (const tx of block.prefetchedTransactions) {
            if (!tx || !tx.to) continue;

            if (tx.to.toLowerCase() === config.USDC_ETH_CONTRACT_ADDRESS) {
              const data = tx.data || '';

              if (data.startsWith(METHOD_TRANSFER) && data.length >= 138) {
                const recipient = '0x' + data.substring(34, 74);
                const rawAmount = BigInt('0x' + data.substring(74, 138));
                const exactAmountNum = parseFloat(ethers.formatUnits(rawAmount, config.USDC_ETH_DECIMALS));

                if (!storage.isTxProcessed(tx.hash) && !this.ethQueue.some(q => q.txHash === tx.hash)) {
                  this.ethQueue.push({
                    txHash: tx.hash,
                    from: tx.from,
                    to: recipient,
                    amount: exactAmountNum,
                    tokenSymbol: 'USDC',
                    network: 'Ethereum (ERC-20)',
                    explorerBaseUrl: 'https://etherscan.io',
                    timestamp: block.timestamp || Math.floor(Date.now() / 1000),
                    blockNumber: block.number
                  });
                }
              }
            }
          }
        } catch (_) {}
      }

      this.lastEthBlock = endBlock;
    } catch (_) {
      this.rotateEthRpc();
    }
  }

  async scanAllChains() {
    if (this.isScanning) return;
    this.isScanning = true;
    try {
      await Promise.allSettled([
        this.scanBscBlocks(),
        this.scanEthBlocks()
      ]);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Alternates 50/50 between BSC USDT and Ethereum USDC payouts
   */
  async getNextPayout() {
    if (this.bscQueue.length === 0 || this.ethQueue.length === 0) {
      await this.scanAllChains();
    }

    let payout = null;

    // Alternate: If last was ETH, prefer BSC; if last was BSC, prefer ETH
    if (this.lastNetworkServed === 'ETH') {
      if (this.bscQueue.length > 0) {
        payout = this.bscQueue.shift();
        this.lastNetworkServed = 'BSC';
      } else if (this.ethQueue.length > 0) {
        payout = this.ethQueue.shift();
        this.lastNetworkServed = 'ETH';
      }
    } else {
      if (this.ethQueue.length > 0) {
        payout = this.ethQueue.shift();
        this.lastNetworkServed = 'ETH';
      } else if (this.bscQueue.length > 0) {
        payout = this.bscQueue.shift();
        this.lastNetworkServed = 'BSC';
      }
    }

    if (!payout) {
      this.lastBscBlock = Math.max(0, this.lastBscBlock - 20);
      this.lastEthBlock = Math.max(0, this.lastEthBlock - 10);
      await this.scanAllChains();

      if (this.bscQueue.length > 0) {
        payout = this.bscQueue.shift();
        this.lastNetworkServed = 'BSC';
      } else if (this.ethQueue.length > 0) {
        payout = this.ethQueue.shift();
        this.lastNetworkServed = 'ETH';
      }
    }

    if (payout) {
      let displayAmount = parseFloat(payout.amount);
      if (isNaN(displayAmount) || displayAmount <= 0) {
        displayAmount = 0.25;
      }

      // If on-chain amount is larger than 0.5, normalize to micro range (0.1 - 0.5) while keeping real on-chain txHash!
      if (displayAmount > config.MAX_AMOUNT || displayAmount < config.MIN_AMOUNT) {
        const scaled = (config.MIN_AMOUNT + (Math.abs(Number(BigInt(payout.txHash) % 4000n)) / 10000)).toFixed(4);
        payout.amount = scaled;
      }
    }

    return payout;
  }

  async getWalletBalances(walletAddress) {
    const target = walletAddress || storage.getTrackedWallet();
    if (!target || !ethers.isAddress(target)) return null;

    try {
      const ABI = ['function balanceOf(address account) view returns (uint256)'];
      const contract = new ethers.Contract(config.USDT_CONTRACT_ADDRESS, ABI, this.bscProvider);
      const [bnbRaw, usdtRaw] = await Promise.all([
        this.bscProvider.getBalance(target),
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

module.exports = new MultiChainTracker();
