'use strict';

/**
 * Price Ratio Analyzer
 * 
 * Analyzes relationships between:
 * - Bid/Ask prices (spread)
 * - Index price (spot aggregated)
 * - Mark price (fair value)
 * - Basis (futures premium/discount)
 * 
 * ⚠️ LIVE-ONLY: Requires real-time price feeds. Not backtestable.
 * 
 * @module PriceRatioAnalyzer
 */

const Decimal = require('decimal.js');

class PriceRatioAnalyzer {
  /**
   * @param {Object} config
   * @param {number} [config.spreadThresholdWarn=0.02] - Spread warning %
   * @param {number} [config.spreadThresholdCritical=0.05] - Critical spread %
   * @param {number} [config.basisThresholdModerate=0.05] - Moderate basis %
   * @param {number} [config.basisThresholdExtreme=0.15] - Extreme basis %
   * @param {number} [config.convergenceThreshold=0.02] - Convergence threshold
   * @param {number} [config.divergenceThreshold=0.08] - Divergence threshold
   * @param {number} [config.maxWeight=15] - Max signal weight
   */
  constructor(config = {}) {
    this.spreadThresholdWarn = config.spreadThresholdWarn || 0.02;
    this.spreadThresholdCritical = config.spreadThresholdCritical || 0.05;
    this.basisThresholdModerate = config.basisThresholdModerate || 0.05;
    this.basisThresholdExtreme = config.basisThresholdExtreme || 0.15;
    this.convergenceThreshold = config.convergenceThreshold || 0.02;
    this.divergenceThreshold = config.divergenceThreshold || 0.08;
    this.maxWeight = config.maxWeight || 15;
    this.maxHistory = config.maxHistory || 100;
    
    // Current prices
    this.bidPrice = null;
    this.askPrice = null;
    this.indexPrice = null;
    this.markPrice = null;
    this.lastPrice = null;
    
    // Calculated metrics
    this.spread = null;
    this.spreadBps = null;
    this.basis = null;
    this.basisBps = null;
    this.markVsLast = null;
    this.bidAskImbalance = null;
    
    // History
    this.basisHistory = [];
    this.spreadHistory = [];
    
    // Live mode
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
   * Update with latest price data
   * @param {Object} prices - {bid, ask, index, mark, last}
   * @returns {Object} Result
   */
  update(prices) {
    if (!this.isLiveMode) return this.getResult();
    
    if (prices.bid !== undefined) this.bidPrice = new Decimal(prices.bid);
    if (prices.ask !== undefined) this.askPrice = new Decimal(prices.ask);
    if (prices.index !== undefined) this.indexPrice = new Decimal(prices.index);
    if (prices.mark !== undefined) this.markPrice = new Decimal(prices.mark);
    if (prices.last !== undefined) this.lastPrice = new Decimal(prices.last);
    
    this._calculateMetrics();
    
    return this.getResult();
  }

  _calculateMetrics() {
    // Spread
    if (this.bidPrice && this.askPrice && !this.bidPrice.isZero()) {
      const mid = this.bidPrice.plus(this.askPrice).div(2);
      this.spread = this.askPrice.minus(this.bidPrice).div(mid).mul(100).toNumber();
      this.spreadBps = this.spread * 100;
      
      this.spreadHistory.push({ ts: Date.now(), spread: this.spread });
      if (this.spreadHistory.length > this.maxHistory) this.spreadHistory.shift();
    }
    
    // Basis (futures vs spot)
    if (this.markPrice && this.indexPrice && !this.indexPrice.isZero()) {
      this.basis = this.markPrice.minus(this.indexPrice).div(this.indexPrice).mul(100).toNumber();
      this.basisBps = this.basis * 100;
      
      this.basisHistory.push({ ts: Date.now(), basis: this.basis });
      if (this.basisHistory.length > this.maxHistory) this.basisHistory.shift();
    }
    
    // Mark vs Last
    if (this.markPrice && this.lastPrice && !this.lastPrice.isZero()) {
      this.markVsLast = this.markPrice.minus(this.lastPrice).div(this.lastPrice).mul(100).toNumber();
    }
    
    // Bid-Ask imbalance position
    if (this.bidPrice && this.askPrice && this.lastPrice) {
      const range = this.askPrice.minus(this.bidPrice);
      if (!range.isZero()) {
        this.bidAskImbalance = this.lastPrice.minus(this.bidPrice).div(range).toNumber();
      }
    }
  }

  /**
   * SIGNAL 1: Basis (Premium/Discount)
   */
  getBasisSignal() {
    if (!this.isLiveMode || this.basis === null) return null;
    
    // Extreme premium
    if (this.basis > this.basisThresholdExtreme) {
      return {
        type: 'extreme_premium',
        direction: 'bearish',
        strength: 'strong',
        message: `Extreme futures premium: +${this.basis.toFixed(3)}%`,
        metadata: { basis: this.basis, basisBps: this.basisBps, liveOnly: true }
      };
    }
    
    // Extreme discount
    if (this.basis < -this.basisThresholdExtreme) {
      return {
        type: 'extreme_discount',
        direction: 'bullish',
        strength: 'strong',
        message: `Extreme futures discount: ${this.basis.toFixed(3)}%`,
        metadata: { basis: this.basis, basisBps: this.basisBps, liveOnly: true }
      };
    }
    
    // Moderate premium
    if (this.basis > this.basisThresholdModerate) {
      return {
        type: 'moderate_premium',
        direction: 'bearish',
        strength: 'weak',
        message: `Futures premium: +${this.basis.toFixed(3)}%`,
        metadata: { basis: this.basis, liveOnly: true }
      };
    }
    
    // Moderate discount
    if (this.basis < -this.basisThresholdModerate) {
      return {
        type: 'moderate_discount',
        direction: 'bullish',
        strength: 'weak',
        message: `Futures discount: ${this.basis.toFixed(3)}%`,
        metadata: { basis: this.basis, liveOnly: true }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Spread Analysis
   */
  getSpreadSignal() {
    if (!this.isLiveMode || this.spread === null) return null;
    
    if (this.spread > this.spreadThresholdCritical) {
      return {
        type: 'critical_spread',
        direction: 'neutral',
        strength: 'strong',
        message: `CRITICAL spread: ${this.spread.toFixed(3)}% (${this.spreadBps.toFixed(1)} bps)`,
        metadata: { spread: this.spread, spreadBps: this.spreadBps, liveOnly: true, warning: 'AVOID_ENTRY' }
      };
    }
    
    if (this.spread > this.spreadThresholdWarn) {
      return {
        type: 'elevated_spread',
        direction: 'neutral',
        strength: 'weak',
        message: `Elevated spread: ${this.spread.toFixed(3)}%`,
        metadata: { spread: this.spread, liveOnly: true, warning: 'USE_LIMIT_ORDERS' }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Convergence/Divergence
   */
  getConvergenceSignal() {
    if (!this.isLiveMode || this.basisHistory.length < 10) return null;
    
    const recent = this.basisHistory.slice(-10);
    const oldBasis = recent[0].basis;
    const newBasis = recent[recent.length - 1].basis;
    const change = newBasis - oldBasis;
    
    // Converging
    if (Math.abs(newBasis) < Math.abs(oldBasis) && Math.abs(change) > this.convergenceThreshold) {
      return {
        type: 'basis_converging',
        direction: newBasis > 0 ? 'bearish' : 'bullish',
        strength: 'moderate',
        message: `Basis converging: ${oldBasis.toFixed(3)}% → ${newBasis.toFixed(3)}%`,
        metadata: { oldBasis, newBasis, change, liveOnly: true }
      };
    }
    
    // Diverging
    if (Math.abs(newBasis) > Math.abs(oldBasis) && Math.abs(change) > this.divergenceThreshold) {
      return {
        type: 'basis_diverging',
        direction: newBasis > 0 ? 'bullish' : 'bearish',
        strength: 'moderate',
        message: `Basis diverging: ${oldBasis.toFixed(3)}% → ${newBasis.toFixed(3)}%`,
        metadata: { oldBasis, newBasis, change, liveOnly: true }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Bid-Ask Position
   */
  getBidAskImbalanceSignal() {
    if (!this.isLiveMode || this.bidAskImbalance === null) return null;
    
    if (this.bidAskImbalance < 0.2) {
      return {
        type: 'price_near_bid',
        direction: 'bearish',
        strength: 'weak',
        message: `Price near bid (${(this.bidAskImbalance * 100).toFixed(0)}%)`,
        metadata: { imbalance: this.bidAskImbalance, liveOnly: true }
      };
    }
    
    if (this.bidAskImbalance > 0.8) {
      return {
        type: 'price_near_ask',
        direction: 'bullish',
        strength: 'weak',
        message: `Price near ask (${(this.bidAskImbalance * 100).toFixed(0)}%)`,
        metadata: { imbalance: this.bidAskImbalance, liveOnly: true }
      };
    }
    
    return null;
  }

  getSignals() {
    if (!this.isLiveMode) return [];
    
    const signals = [];
    
    const basis = this.getBasisSignal();
    if (basis) signals.push(basis);
    
    const spread = this.getSpreadSignal();
    if (spread) signals.push(spread);
    
    const convergence = this.getConvergenceSignal();
    if (convergence) signals.push(convergence);
    
    const bidAsk = this.getBidAskImbalanceSignal();
    if (bidAsk) signals.push(bidAsk);
    
    return signals;
  }

  getResult() {
    return {
      value: {
        bid: this.bidPrice?.toNumber(),
        ask: this.askPrice?.toNumber(),
        index: this.indexPrice?.toNumber(),
        mark: this.markPrice?.toNumber(),
        last: this.lastPrice?.toNumber(),
        spread: this.spread,
        spreadBps: this.spreadBps,
        basis: this.basis,
        basisBps: this.basisBps,
        markVsLast: this.markVsLast,
        bidAskImbalance: this.bidAskImbalance,
        isLive: this.isLiveMode
      },
      signals: this.getSignals(),
      warning: this.isLiveMode ? null : 'Price ratio signals disabled (not live mode)'
    };
  }

  reset() {
    this.bidPrice = null;
    this.askPrice = null;
    this.indexPrice = null;
    this.markPrice = null;
    this.lastPrice = null;
    this.spread = null;
    this.spreadBps = null;
    this.basis = null;
    this.basisBps = null;
    this.markVsLast = null;
    this.bidAskImbalance = null;
    this.basisHistory = [];
    this.spreadHistory = [];
  }
}

module.exports = PriceRatioAnalyzer;
