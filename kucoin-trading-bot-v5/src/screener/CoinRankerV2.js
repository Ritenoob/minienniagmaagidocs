'use strict';

/**
 * Coin Ranker V2 - With Microstructure Integration
 * 
 * Ranks coins by:
 * 1. Volume & Liquidity
 * 2. Volatility (ATR)
 * 3. Funding Rate (prefer neutral)
 * 4. Spread (prefer tight)
 * 5. Buy:Sell Ratio (prefer imbalanced for opportunities)
 * 
 * @module CoinRankerV2
 */

class CoinRankerV2 {
  /**
   * @param {Object} config
   * @param {Object} config.client - KuCoin client
   * @param {number} [config.minVolume=10000000] - Min 24h volume in USD
   * @param {number} [config.maxSpread=0.05] - Max spread percentage
   * @param {number} [config.preferNeutralFunding=true] - Prefer neutral funding
   * @param {number} [config.maxFundingRate=0.02] - Max funding rate percentage
   * @param {Object} [config.weights] - Scoring weights
   * @param {number} [config.topN=50] - Top N coins to track
   * @param {number} [config.refreshInterval=3600000] - Refresh interval (1 hour)
   */
  constructor(config = {}) {
    this.client = config.client;
    
    // Volume requirements
    this.minVolume = config.minVolume || 10_000_000;
    this.maxSpread = config.maxSpread || 0.05;
    
    // Funding rate preferences
    this.preferNeutralFunding = config.preferNeutralFunding !== false;
    this.maxFundingRate = config.maxFundingRate || 0.02;
    
    // Ranking weights
    this.weights = {
      volume: config.weights?.volume || 0.30,
      volatility: config.weights?.volatility || 0.20,
      spread: config.weights?.spread || 0.15,
      funding: config.weights?.funding || 0.15,
      buySellImbalance: config.weights?.buySellImbalance || 0.20
    };
    
    this.topN = config.topN || 50;
    this.refreshInterval = config.refreshInterval || 60 * 60 * 1000;
    
    // Storage
    this.coins = [];
    this.rankings = [];
    this.buySellRatios = new Map();
    this.lastUpdate = null;
    this.refreshTimer = null;
  }

  async initialize() {
    await this.refresh();
    
    this.refreshTimer = setInterval(() => {
      this.refresh().catch(err => {
        console.error('[CoinRankerV2] Refresh failed:', err.message);
      });
    }, this.refreshInterval);
    
    console.log(`[CoinRankerV2] Initialized with ${this.coins.length} coins`);
  }

  async refresh() {
    try {
      const contracts = await this.client.getActiveContracts();
      
      // Filter USDT perpetuals
      const usdtPerps = contracts.filter(c =>
        c.quoteCurrency === 'USDT' &&
        c.isInverse === false &&
        c.status === 'Open'
      );
      
      // Fetch detailed data for each
      const withDetails = await Promise.all(
        usdtPerps.map(async (contract) => {
          try {
            const ticker = await this.client.getTicker(contract.symbol);
            
            // Calculate metrics
            const turnover = parseFloat(ticker?.turnover24h || 0);
            const priceChange = Math.abs(parseFloat(ticker?.priceChgPct || 0));
            
            // Calculate spread
            const bid = parseFloat(ticker?.bestBidPrice || 0);
            const ask = parseFloat(ticker?.bestAskPrice || 0);
            const mid = (bid + ask) / 2;
            const spread = mid > 0 ? ((ask - bid) / mid) * 100 : 999;
            
            // Funding rate
            const fundingRate = parseFloat(contract.fundingFeeRate || 0) * 100;
            
            // Get buy:sell ratio if available
            const buySellRatio = this.buySellRatios.get(contract.symbol) || 1.0;
            
            return {
              symbol: contract.symbol,
              baseCurrency: contract.baseCurrency,
              turnover24h: turnover,
              volume24h: parseFloat(ticker?.vol24h || 0),
              priceChangePercent: priceChange * 100,
              lastPrice: parseFloat(ticker?.price || 0),
              bid,
              ask,
              spread,
              fundingRate,
              openInterest: parseFloat(contract.openInterest || 0),
              maxLeverage: contract.maxLeverage,
              buySellRatio,
              
              // Scores (calculated below)
              volumeScore: 0,
              volatilityScore: 0,
              spreadScore: 0,
              fundingScore: 0,
              imbalanceScore: 0,
              compositeScore: 0
            };
          } catch {
            return null;
          }
        })
      );
      
      // Filter valid coins
      this.coins = withDetails
        .filter(c => c !== null)
        .filter(c => c.turnover24h >= this.minVolume)
        .filter(c => c.spread <= this.maxSpread);
      
      // Calculate scores
      this._calculateScores();
      
      // Sort by composite score
      this.rankings = [...this.coins].sort((a, b) => b.compositeScore - a.compositeScore);
      
      this.lastUpdate = Date.now();
      
      console.log(`[CoinRankerV2] Refreshed: ${this.coins.length} coins ranked`);
      console.log(`[CoinRankerV2] Top 5: ${this.rankings.slice(0, 5).map(c => c.symbol).join(', ')}`);
      
      return this.rankings;
    } catch (error) {
      console.error('[CoinRankerV2] Refresh error:', error.message);
      throw error;
    }
  }

  _calculateScores() {
    if (this.coins.length === 0) return;
    
    // Calculate min/max for normalization
    const volumes = this.coins.map(c => c.turnover24h);
    const volatilities = this.coins.map(c => c.priceChangePercent);
    const spreads = this.coins.map(c => c.spread);
    const fundings = this.coins.map(c => Math.abs(c.fundingRate));
    const imbalances = this.coins.map(c => Math.abs(c.buySellRatio - 1));
    
    const maxVolume = Math.max(...volumes);
    const maxVolatility = Math.max(...volatilities);
    const minSpread = Math.min(...spreads);
    const maxSpread = Math.max(...spreads);
    const maxFunding = Math.max(...fundings);
    const maxImbalance = Math.max(...imbalances);
    
    for (const coin of this.coins) {
      // Volume score (higher is better)
      coin.volumeScore = maxVolume > 0 
        ? (coin.turnover24h / maxVolume) * 100 
        : 0;
      
      // Volatility score (moderate volatility preferred)
      // Optimal range: 2-5% daily change
      const optimalVol = 3.5;
      const volDiff = Math.abs(coin.priceChangePercent - optimalVol);
      coin.volatilityScore = Math.max(0, 100 - volDiff * 20);
      
      // Spread score (lower is better)
      coin.spreadScore = maxSpread > minSpread
        ? ((maxSpread - coin.spread) / (maxSpread - minSpread)) * 100
        : 100;
      
      // Funding score (neutral preferred)
      coin.fundingScore = maxFunding > 0
        ? ((maxFunding - Math.abs(coin.fundingRate)) / maxFunding) * 100
        : 100;
      
      // Imbalance score (higher imbalance = better opportunity)
      const imbalance = Math.abs(coin.buySellRatio - 1);
      coin.imbalanceScore = maxImbalance > 0
        ? (imbalance / maxImbalance) * 100
        : 0;
      
      // Composite score
      coin.compositeScore = 
        coin.volumeScore * this.weights.volume +
        coin.volatilityScore * this.weights.volatility +
        coin.spreadScore * this.weights.spread +
        coin.fundingScore * this.weights.funding +
        coin.imbalanceScore * this.weights.buySellImbalance;
    }
  }

  /**
   * Update buy:sell ratio for a symbol (called from microstructure analyzer)
   * @param {string} symbol 
   * @param {number} ratio 
   */
  updateBuySellRatio(symbol, ratio) {
    this.buySellRatios.set(symbol, ratio);
  }

  /**
   * Get top coins by ranking
   */
  getTopCoins(count = 20) {
    return this.rankings.slice(0, count);
  }

  /**
   * Get coins with extreme funding (for contrarian opportunities)
   */
  getExtremeFundingCoins(threshold = 0.01) {
    return this.coins
      .filter(c => Math.abs(c.fundingRate) >= threshold * 100)
      .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
  }

  /**
   * Get coins with tightest spreads
   */
  getTightSpreadCoins(count = 10) {
    return [...this.coins]
      .sort((a, b) => a.spread - b.spread)
      .slice(0, count);
  }

  /**
   * Get coins by funding direction
   */
  getCoinsByFundingDirection(direction = 'positive') {
    return this.coins
      .filter(c => direction === 'positive' ? c.fundingRate > 0 : c.fundingRate < 0)
      .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
  }

  /**
   * Get coins with highest buy:sell imbalance
   */
  getHighImbalanceCoins(count = 10) {
    return [...this.coins]
      .sort((a, b) => Math.abs(b.buySellRatio - 1) - Math.abs(a.buySellRatio - 1))
      .slice(0, count);
  }

  /**
   * Get tiered coin classification
   */
  getTiers() {
    return {
      tier1: this.rankings.slice(0, 5),   // Top 5 by composite score
      tier2: this.rankings.slice(5, 15),  // 6-15
      tier3: this.rankings.slice(15, 30)  // 16-30
    };
  }

  /**
   * Get symbols only
   */
  getSymbols() {
    return this.rankings.map(c => c.symbol);
  }

  /**
   * Get coin data by symbol
   */
  getCoinData(symbol) {
    return this.coins.find(c => c.symbol === symbol);
  }

  /**
   * Get ranking metrics
   */
  getMetrics() {
    return {
      totalCoins: this.coins.length,
      lastUpdate: this.lastUpdate,
      topCoin: this.rankings[0]?.symbol || null,
      avgVolume: this.coins.length > 0 
        ? this.coins.reduce((sum, c) => sum + c.turnover24h, 0) / this.coins.length 
        : 0,
      avgSpread: this.coins.length > 0
        ? this.coins.reduce((sum, c) => sum + c.spread, 0) / this.coins.length
        : 0
    };
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

module.exports = CoinRankerV2;
