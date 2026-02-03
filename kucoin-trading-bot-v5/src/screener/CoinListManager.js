'use strict';

/**
 * Coin List Manager
 * 
 * Dynamic coin ranking based on:
 * - 24h volume
 * - Spread
 * - Volatility
 * - Funding rate
 * 
 * @module CoinListManager
 */

const Decimal = require('decimal.js');

class CoinListManager {
  /**
   * @param {Object} config
   * @param {Object} config.client - KuCoin client
   * @param {number} [config.minVolume=10000000] - Min 24h volume
   * @param {number} [config.maxSpread=0.05] - Max spread %
   * @param {number} [config.topN=50] - Top N coins to track
   * @param {number} [config.refreshInterval=3600000] - Refresh interval
   */
  constructor(config = {}) {
    this.client = config.client;
    this.minVolume = config.minVolume || 10_000_000;
    this.maxSpread = config.maxSpread || 0.05;
    this.topN = config.topN || 50;
    this.refreshInterval = config.refreshInterval || 60 * 60 * 1000;
    
    this.coins = [];
    this.tiers = { tier1: [], tier2: [], tier3: [] };
    this.lastUpdate = null;
    this.refreshTimer = null;
  }

  async initialize() {
    await this.refresh();
    
    this.refreshTimer = setInterval(() => {
      this.refresh().catch(err => {
        console.error('[CoinList] Refresh failed:', err.message);
      });
    }, this.refreshInterval);
  }

  async refresh() {
    const contracts = await this.client.getActiveContracts();
    
    // Filter USDT perpetuals
    const usdtPerps = contracts.filter(c =>
      c.quoteCurrency === 'USDT' &&
      c.isInverse === false &&
      c.status === 'Open'
    );
    
    // Fetch tickers
    const withStats = await Promise.all(
      usdtPerps.map(async (contract) => {
        try {
          const ticker = await this.client.getTicker(contract.symbol);
          
          const bid = parseFloat(ticker.bestBidPrice || 0);
          const ask = parseFloat(ticker.bestAskPrice || 0);
          const mid = (bid + ask) / 2;
          const spread = mid > 0 ? ((ask - bid) / mid) * 100 : 999;
          
          return {
            symbol: contract.symbol,
            baseCurrency: contract.baseCurrency,
            volume24h: parseFloat(ticker.vol24h || 0),
            turnover24h: parseFloat(ticker.turnover24h || 0),
            priceChangePercent: parseFloat(ticker.priceChgPct || 0) * 100,
            lastPrice: parseFloat(ticker.price || 0),
            bid,
            ask,
            spread,
            fundingRate: parseFloat(contract.fundingFeeRate || 0) * 100,
            openInterest: parseFloat(contract.openInterest || 0),
            maxLeverage: contract.maxLeverage,
            lotSize: contract.lotSize,
            multiplier: contract.multiplier
          };
        } catch {
          return null;
        }
      })
    );
    
    // Filter and sort
    this.coins = withStats
      .filter(c => c !== null)
      .filter(c => c.turnover24h >= this.minVolume)
      .filter(c => c.spread <= this.maxSpread)
      .sort((a, b) => b.turnover24h - a.turnover24h)
      .slice(0, this.topN);
    
    // Create tiers
    this.tiers = {
      tier1: this.coins.slice(0, 5),
      tier2: this.coins.slice(5, 15),
      tier3: this.coins.slice(15, 30)
    };
    
    this.lastUpdate = Date.now();
    
    return this.coins;
  }

  getTopCoins(count = 20) {
    return this.coins.slice(0, count);
  }

  getSymbols() {
    return this.coins.map(c => c.symbol);
  }

  getCoin(symbol) {
    return this.coins.find(c => c.symbol === symbol);
  }

  getTiers() {
    return this.tiers;
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
}

module.exports = CoinListManager;
