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
    this.lastNetworkServed = 'ETH';
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
   * Scan BSC blocks for real USDT BEP-20 transfers (0.10 - 0.50 USDT)
   */
  async scanBscBlocks() {
    try {
      const currentBlock = await this.bscProvider.getBlockNumber();
      if (!currentBlock) return;

      if (!this.lastBscBlock || (currentBlock - this.lastBscBlock) > 30) {
        this.lastBscBlock = currentBlock - 15;
      }

      const startBlock = this.lastBscBlock + 1;
      const endBlock = Math.min(currentBlock, startBlock + 12);
      if (startBlock > currentBlock) {
        if (this.bscQueue.length === 0) this.lastBscBlock = currentBlock - 20;
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

                // Strictly filter only real on-chain transfers in the 0.10 - 0.50 USDT range
                if (exactAmountNum >= config.MIN_AMOUNT && exactAmountNum <= config.MAX_AMOUNT) {
                  if (!storage.isTxProcessed(tx.hash) && !this.bscQueue.some(q => q.txHash === tx.hash)) {
                    this.bscQueue.push({
                      txHash: tx.hash,
                      from: tx.from,
                      to: recipient,
                      amount: exactAmountNum.toString(),
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
          }
        } catch (_) {}
      }

      this.lastBscBlock = endBlock;
    } catch (_) {
      this.rotateBscRpc();
    }
  }

  /**
   * Scan Ethereum blocks for real USDC ERC-20 transfers (9.00 - 10.00 USDC)
   */
  async scanEthBlocks() {
    try {
      const currentBlock = await this.ethProvider.getBlockNumber();
      if (!currentBlock) return;

      if (!this.lastEthBlock || (currentBlock - this.lastEthBlock) > 30) {
        this.lastEthBlock = currentBlock - 15;
      }

      const startBlock = this.lastEthBlock + 1;
      const endBlock = Math.min(currentBlock, startBlock + 10);
      if (startBlock > currentBlock) {
        if (this.ethQueue.length === 0) this.lastEthBlock = currentBlock - 25;
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

                // Strictly filter only real on-chain transfers in the 9.00 - 10.00 USDC range
                if (exactAmountNum >= 9.00 && exactAmountNum <= 10.00) {
                  if (!storage.isTxProcessed(tx.hash) && !this.ethQueue.some(q => q.txHash === tx.hash)) {
                    this.ethQueue.push({
                      txHash: tx.hash,
                      from: tx.from,
                      to: recipient,
                      amount: exactAmountNum.toString(),
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
   * Get Next BSC USDT Payout ($0.10 - $0.50 USDT)
   */
  async getNextBscPayout() {
    if (this.bscQueue.length === 0) {
      await this.scanBscBlocks();
    }
    if (this.bscQueue.length === 0) {
      this.lastBscBlock = Math.max(0, this.lastBscBlock - 30);
      await this.scanBscBlocks();
    }
    return this.bscQueue.length > 0 ? this.bscQueue.shift() : null;
  }

  /**
   * Get Next Ethereum USDC Payout ($9.00 - $10.00 USDC)
   */
  async getNextEthPayout() {
    if (this.ethQueue.length === 0) {
      await this.scanEthBlocks();
    }
    if (this.ethQueue.length === 0) {
      this.lastEthBlock = Math.max(0, this.lastEthBlock - 30);
      await this.scanEthBlocks();
    }
    return this.ethQueue.length > 0 ? this.ethQueue.shift() : null;
  }

  /**
   * Alternates 50/50 fallback payout
   */
  async getNextPayout() {
    if (this.bscQueue.length === 0 || this.ethQueue.length === 0) {
      await this.scanAllChains();
    }

    let payout = null;

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
      this.lastBscBlock = Math.max(0, this.lastBscBlock - 30);
      this.lastEthBlock = Math.max(0, this.lastEthBlock - 30);
      await this.scanAllChains();

      if (this.bscQueue.length > 0) {
        payout = this.bscQueue.shift();
        this.lastNetworkServed = 'BSC';
      } else if (this.ethQueue.length > 0) {
        payout = this.ethQueue.shift();
        this.lastNetworkServed = 'ETH';
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
