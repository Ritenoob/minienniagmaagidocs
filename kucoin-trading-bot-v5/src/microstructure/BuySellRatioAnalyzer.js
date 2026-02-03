'use strict';

/**
 * Buy:Sell Ratio Analyzer
 * 
 * Analyzes real-time trade flow to detect:
 * - Order flow imbalance (aggressive buyers vs sellers)
 * - Absorption patterns (large orders absorbed by opposing flow)
 * - Exhaustion signals (extreme ratios followed by reversal)
 * 
 * ⚠️ LIVE-ONLY: Requires real-time trade data. Not backtestable.
 * 
 * @module BuySellRatioAnalyzer
 */

const Decimal = require('decimal.js');

class BuySellRatioAnalyzer {
  /**
   * @param {Object} config
   * @param {number} [config.windowMs=60000] - Rolling window in ms
   * @param {number} [config.shortWindowMs=5000] - Short-term window
   * @param {number} [config.longWindowMs=300000] - Long-term window
   * @param {number} [config.imbalanceThresholdStrong=0.70] - Strong imbalance threshold
   * @param {number} [config.imbalanceThresholdExtreme=0.80] - Extreme imbalance
   * @param {number} [config.exhaustionReversal=0.15] - Reversal threshold
   * @param {number} [config.minTradesForSignal=50] - Min trades required
   * @param {number} [config.maxWeight=15] - Max signal weight
   */
  constructor(config = {}) {
    this.windowMs = config.windowMs || 60000;
    this.shortWindowMs = config.shortWindowMs || 5000;
    this.longWindowMs = config.longWindowMs || 300000;
    
    this.imbalanceThresholdStrong = config.imbalanceThresholdStrong || 0.70;
    this.imbalanceThresholdExtreme = config.imbalanceThresholdExtreme || 0.80;
    this.exhaustionReversal = config.exhaustionReversal || 0.15;
    
    this.minTradesForSignal = config.minTradesForSignal || 50;
    this.maxWeight = config.maxWeight || 15;
    this.maxHistory = config.maxHistory || 100;
    
    // Trade storage
    this.trades = [];
    this.shortTrades = [];
    this.longTrades = [];
    
    // Current metrics
    this.currentRatio = null;
    this.shortRatio = null;
    this.longRatio = null;
    this.ratioDelta = null;
    
    this.buyVolume = new Decimal(0);
    this.sellVolume = new Decimal(0);
    this.totalTrades = 0;
    
    // History
    this.ratioHistory = [];
    
    // Live mode flag
    this.liveOnlyValidation = true;
    this.isLiveMode = false;
  }

  enableLiveMode() {
    this.isLiveMode = true;
  }

  disableLiveMode() {
    this.isLiveMode = false;
  }

  /**
   * Process incoming trade
   * @param {Object} trade - {side: 'buy'|'sell', size: number, price: number, ts?: number}
   * @returns {Object} Result
   */
  processTrade(trade) {
    if (!this.isLiveMode) return this.getResult();
    
    const now = Date.now();
    const tradeData = {
      ts: trade.ts || now,
      side: trade.side,
      size: new Decimal(trade.size),
      price: new Decimal(trade.price),
      value: new Decimal(trade.size).mul(trade.price)
    };
    
    // Add to all windows
    this.trades.push(tradeData);
    this.shortTrades.push(tradeData);
    this.longTrades.push(tradeData);
    
    // Cleanup expired
    this._cleanupWindow(this.trades, now, this.windowMs);
    this._cleanupWindow(this.shortTrades, now, this.shortWindowMs);
    this._cleanupWindow(this.longTrades, now, this.longWindowMs);
    
    // Recalculate
    this._calculateRatios();
    
    return this.getResult();
  }

  /**
   * Batch process trades
   * @param {Array} trades
   * @returns {Object} Result
   */
  processTrades(trades) {
    for (const trade of trades) {
      this.processTrade(trade);
    }
    return this.getResult();
  }

  _cleanupWindow(window, now, maxAge) {
    while (window.length > 0 && now - window[0].ts > maxAge) {
      window.shift();
    }
  }

  _calculateRatios() {
    this.currentRatio = this._calculateWindowRatio(this.trades);
    this.shortRatio = this._calculateWindowRatio(this.shortTrades);
    this.longRatio = this._calculateWindowRatio(this.longTrades);
    
    if (this.shortRatio !== null && this.longRatio !== null) {
      this.ratioDelta = this.shortRatio - this.longRatio;
    }
    
    this._updateVolumeMetrics();
    
    if (this.currentRatio !== null) {
      this.ratioHistory.push({
        ts: Date.now(),
        ratio: this.currentRatio,
        shortRatio: this.shortRatio,
        delta: this.ratioDelta
      });
      
      if (this.ratioHistory.length > this.maxHistory) {
        this.ratioHistory.shift();
      }
    }
  }

  _calculateWindowRatio(window) {
    if (window.length < this.minTradesForSignal) return null;
    
    let buyValue = new Decimal(0);
    let sellValue = new Decimal(0);
    
    for (const trade of window) {
      if (trade.side === 'buy') {
        buyValue = buyValue.plus(trade.value);
      } else {
        sellValue = sellValue.plus(trade.value);
      }
    }
    
    const total = buyValue.plus(sellValue);
    if (total.isZero()) return 0.5;
    
    return buyValue.div(total).toNumber();
  }

  _updateVolumeMetrics() {
    this.buyVolume = new Decimal(0);
    this.sellVolume = new Decimal(0);
    this.totalTrades = this.trades.length;
    
    for (const trade of this.trades) {
      if (trade.side === 'buy') {
        this.buyVolume = this.buyVolume.plus(trade.value);
      } else {
        this.sellVolume = this.sellVolume.plus(trade.value);
      }
    }
  }

  /**
   * SIGNAL 1: Flow Imbalance
   */
  getFlowImbalanceSignal() {
    if (!this.isLiveMode || this.currentRatio === null) return null;
    
    if (this.currentRatio >= this.imbalanceThresholdStrong) {
      const isExtreme = this.currentRatio >= this.imbalanceThresholdExtreme;
      return {
        type: 'bullish_flow_imbalance',
        direction: 'bullish',
        strength: isExtreme ? 'very_strong' : 'strong',
        message: `Buy pressure: ${(this.currentRatio * 100).toFixed(1)}%`,
        metadata: {
          ratio: this.currentRatio,
          buyVolume: this.buyVolume.toNumber(),
          sellVolume: this.sellVolume.toNumber(),
          tradeCount: this.totalTrades,
          liveOnly: true
        }
      };
    }
    
    if (this.currentRatio <= (1 - this.imbalanceThresholdStrong)) {
      const isExtreme = this.currentRatio <= (1 - this.imbalanceThresholdExtreme);
      return {
        type: 'bearish_flow_imbalance',
        direction: 'bearish',
        strength: isExtreme ? 'very_strong' : 'strong',
        message: `Sell pressure: ${((1 - this.currentRatio) * 100).toFixed(1)}%`,
        metadata: {
          ratio: this.currentRatio,
          buyVolume: this.buyVolume.toNumber(),
          sellVolume: this.sellVolume.toNumber(),
          tradeCount: this.totalTrades,
          liveOnly: true
        }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Absorption Pattern
   */
  getAbsorptionSignal() {
    if (!this.isLiveMode || this.ratioDelta === null) return null;
    if (this.ratioHistory.length < 10) return null;
    
    if (this.shortRatio !== null && this.longRatio !== null) {
      // Bullish absorption: heavy selling absorbed
      if (this.shortRatio < 0.35 && this.longRatio > 0.45) {
        return {
          type: 'bullish_absorption',
          direction: 'bullish',
          strength: 'moderate',
          message: 'Selling absorbed (buyers stepping in)',
          metadata: { shortRatio: this.shortRatio, longRatio: this.longRatio, liveOnly: true }
        };
      }
      
      // Bearish absorption: heavy buying absorbed
      if (this.shortRatio > 0.65 && this.longRatio < 0.55) {
        return {
          type: 'bearish_absorption',
          direction: 'bearish',
          strength: 'moderate',
          message: 'Buying absorbed (sellers stepping in)',
          metadata: { shortRatio: this.shortRatio, longRatio: this.longRatio, liveOnly: true }
        };
      }
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Exhaustion Pattern
   */
  getExhaustionSignal() {
    if (!this.isLiveMode || this.ratioHistory.length < 20) return null;
    
    const recent = this.ratioHistory.slice(-20);
    
    let maxRatio = 0;
    let minRatio = 1;
    
    for (let i = 0; i < recent.length - 5; i++) {
      if (recent[i].ratio > maxRatio) maxRatio = recent[i].ratio;
      if (recent[i].ratio < minRatio) minRatio = recent[i].ratio;
    }
    
    const currentRatio = recent[recent.length - 1].ratio;
    
    // Bullish exhaustion: extreme selling now reversing
    if (minRatio < 0.25 && currentRatio > minRatio + this.exhaustionReversal) {
      return {
        type: 'bullish_exhaustion',
        direction: 'bullish',
        strength: 'strong',
        message: `Selling exhaustion (reversed from ${(minRatio * 100).toFixed(1)}%)`,
        metadata: { extremeRatio: minRatio, currentRatio, liveOnly: true }
      };
    }
    
    // Bearish exhaustion: extreme buying now reversing
    if (maxRatio > 0.75 && currentRatio < maxRatio - this.exhaustionReversal) {
      return {
        type: 'bearish_exhaustion',
        direction: 'bearish',
        strength: 'strong',
        message: `Buying exhaustion (reversed from ${(maxRatio * 100).toFixed(1)}%)`,
        metadata: { extremeRatio: maxRatio, currentRatio, liveOnly: true }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Delta Momentum
   */
  getDeltaMomentumSignal() {
    if (!this.isLiveMode || this.ratioHistory.length < 10) return null;
    
    const recent = this.ratioHistory.slice(-10);
    const oldRatio = recent[0].ratio;
    const newRatio = recent[recent.length - 1].ratio;
    const change = newRatio - oldRatio;
    
    if (change > 0.15) {
      return {
        type: 'bullish_delta_momentum',
        direction: 'bullish',
        strength: 'moderate',
        message: `Buy ratio surging (+${(change * 100).toFixed(1)}%)`,
        metadata: { change, oldRatio, newRatio, liveOnly: true }
      };
    }
    
    if (change < -0.15) {
      return {
        type: 'bearish_delta_momentum',
        direction: 'bearish',
        strength: 'moderate',
        message: `Sell ratio surging (${(change * 100).toFixed(1)}%)`,
        metadata: { change, oldRatio, newRatio, liveOnly: true }
      };
    }
    
    return null;
  }

  getSignals() {
    if (!this.isLiveMode) return [];
    
    const signals = [];
    
    const imbalance = this.getFlowImbalanceSignal();
    if (imbalance) signals.push(imbalance);
    
    const absorption = this.getAbsorptionSignal();
    if (absorption) signals.push(absorption);
    
    const exhaustion = this.getExhaustionSignal();
    if (exhaustion) signals.push(exhaustion);
    
    const momentum = this.getDeltaMomentumSignal();
    if (momentum) signals.push(momentum);
    
    return signals;
  }

  getResult() {
    return {
      value: {
        ratio: this.currentRatio,
        shortRatio: this.shortRatio,
        longRatio: this.longRatio,
        delta: this.ratioDelta,
        buyVolume: this.buyVolume.toNumber(),
        sellVolume: this.sellVolume.toNumber(),
        tradeCount: this.totalTrades,
        isLive: this.isLiveMode
      },
      signals: this.getSignals(),
      warning: this.isLiveMode ? null : 'Buy:Sell signals disabled (not live mode)'
    };
  }

  getRatioString() {
    if (this.currentRatio === null) return 'N/A';
    const buyPct = (this.currentRatio * 100).toFixed(1);
    const sellPct = ((1 - this.currentRatio) * 100).toFixed(1);
    return `${buyPct}:${sellPct}`;
  }

  reset() {
    this.trades = [];
    this.shortTrades = [];
    this.longTrades = [];
    this.currentRatio = null;
    this.shortRatio = null;
    this.longRatio = null;
    this.ratioDelta = null;
    this.buyVolume = new Decimal(0);
    this.sellVolume = new Decimal(0);
    this.totalTrades = 0;
    this.ratioHistory = [];
  }
}

module.exports = BuySellRatioAnalyzer;
