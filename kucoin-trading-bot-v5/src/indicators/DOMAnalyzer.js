/**
 * Depth of Market (DOM) Analyzer - LIVE TRADING ONLY
 * 
 * ⚠️ CRITICAL: This indicator is for LIVE trading validation ONLY
 *    NEVER claim backtest-optimized results for DOM signals
 *    DOM data is not available in historical backtests
 * 
 * Signals: Imbalance, Wall Detection, Microprice Bias
 * Max Weight: 15 points
 * 
 * @module DOMAnalyzer
 * @version 5.0.0
 */

'use strict';

class DOMAnalyzer {
  constructor(config = {}) {
    this.depthLevels = config.depthLevels || [5, 10, 25];
    this.imbalanceThresholdLong = config.imbalanceThresholdLong || 0.60;
    this.imbalanceThresholdShort = config.imbalanceThresholdShort || 0.40;
    this.spreadMaxPercent = config.spreadMaxPercent || 0.05;
    this.wallDetectionEnabled = config.wallDetectionEnabled || false;
    this.micropriceBias = config.micropriceBias !== false;
    
    // CRITICAL FLAG
    this.liveOnlyValidation = true;
    this.isLiveMode = false;
    
    this.lastOrderBook = null;
    this.imbalanceHistory = [];
    this.maxHistory = config.historyLength || 50;
    
    // Warm-up tracking
    this.updateCount = 0;
    this.minUpdatesForSignal = config.minUpdatesForSignal || 5;
  }

  /**
   * MUST call this to enable DOM signals
   * Without this, DOM returns no signals (safe for backtests)
   */
  enableLiveMode() {
    this.isLiveMode = true;
    console.log('[DOM] Live mode enabled - DOM signals active');
  }

  disableLiveMode() {
    this.isLiveMode = false;
    console.log('[DOM] Live mode disabled - DOM signals inactive');
  }

  /**
   * Update with order book data
   * @param {Object} orderBook - { bids: [[price, size], ...], asks: [[price, size], ...] }
   * @returns {Object} Result with value and signals
   */
  update(orderBook) {
    if (!this.isLiveMode) {
      return this.getResult();
    }
    
    if (!orderBook || !orderBook.bids || !orderBook.asks) {
      return this.getResult();
    }
    
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return this.getResult();
    }
    
    this.lastOrderBook = orderBook;
    this.updateCount++;
    
    // Calculate imbalance at each depth level
    const imbalances = this.depthLevels.map(level => {
      return this.calculateImbalance(orderBook, level);
    });
    
    const avgImbalance = imbalances.reduce((a, b) => a + b, 0) / imbalances.length;
    
    this.imbalanceHistory.push({
      ts: Date.now(),
      imbalance: avgImbalance,
      imbalances
    });
    
    if (this.imbalanceHistory.length > this.maxHistory) {
      this.imbalanceHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * Calculate bid/ask imbalance at given depth
   */
  calculateImbalance(orderBook, levels) {
    const bids = orderBook.bids.slice(0, Math.min(levels, orderBook.bids.length));
    const asks = orderBook.asks.slice(0, Math.min(levels, orderBook.asks.length));
    
    let bidVolume = 0;
    let askVolume = 0;
    
    for (const [, size] of bids) {
      bidVolume += parseFloat(size);
    }
    
    for (const [, size] of asks) {
      askVolume += parseFloat(size);
    }
    
    const totalVolume = bidVolume + askVolume;
    
    return totalVolume > 0 ? bidVolume / totalVolume : 0.5;
  }

  /**
   * Check if warmed up
   */
  isWarmedUp() {
    return this.isLiveMode && this.updateCount >= this.minUpdatesForSignal;
  }

  // SIGNAL 1: DOM Imbalance
  getImbalanceSignal() {
    if (!this.isLiveMode || !this.isWarmedUp()) return null;
    if (this.imbalanceHistory.length < 3) return null;
    
    const currentImbalance = this.imbalanceHistory[this.imbalanceHistory.length - 1].imbalance;
    
    // Strong bid imbalance (bullish)
    if (currentImbalance >= this.imbalanceThresholdLong) {
      const isStrong = currentImbalance >= 0.70;
      return {
        type: 'bullish_dom_imbalance',
        direction: 'bullish',
        strength: isStrong ? 'strong' : 'moderate',
        message: `DOM bid imbalance: ${(currentImbalance * 100).toFixed(1)}% bid volume`,
        metadata: {
          imbalance: currentImbalance,
          liveOnly: true
        }
      };
    }
    
    // Strong ask imbalance (bearish)
    if (currentImbalance <= this.imbalanceThresholdShort) {
      const isStrong = currentImbalance <= 0.30;
      return {
        type: 'bearish_dom_imbalance',
        direction: 'bearish',
        strength: isStrong ? 'strong' : 'moderate',
        message: `DOM ask imbalance: ${((1 - currentImbalance) * 100).toFixed(1)}% ask volume`,
        metadata: {
          imbalance: currentImbalance,
          liveOnly: true
        }
      };
    }
    
    return null;
  }

  // SIGNAL 2: Wall Detection
  getWallSignal() {
    if (!this.isLiveMode || !this.wallDetectionEnabled || !this.lastOrderBook) {
      return null;
    }
    
    const bids = this.lastOrderBook.bids.slice(0, 25);
    const asks = this.lastOrderBook.asks.slice(0, 25);
    
    if (bids.length < 5 || asks.length < 5) return null;
    
    // Calculate average size
    let bidTotal = 0;
    let askTotal = 0;
    
    for (const [, size] of bids) {
      bidTotal += parseFloat(size);
    }
    for (const [, size] of asks) {
      askTotal += parseFloat(size);
    }
    
    const avgBidSize = bidTotal / bids.length;
    const avgAskSize = askTotal / asks.length;
    
    // Look for walls (orders >5x average)
    const bidWalls = bids.filter(([, size]) => parseFloat(size) > avgBidSize * 5);
    const askWalls = asks.filter(([, size]) => parseFloat(size) > avgAskSize * 5);
    
    if (bidWalls.length > 0 && askWalls.length === 0) {
      return {
        type: 'bid_wall_support',
        direction: 'bullish',
        strength: 'moderate',
        message: `Bid wall detected at ${bidWalls[0][0]}`,
        metadata: {
          wallPrice: parseFloat(bidWalls[0][0]),
          wallSize: parseFloat(bidWalls[0][1]),
          liveOnly: true
        }
      };
    }
    
    if (askWalls.length > 0 && bidWalls.length === 0) {
      return {
        type: 'ask_wall_resistance',
        direction: 'bearish',
        strength: 'moderate',
        message: `Ask wall detected at ${askWalls[0][0]}`,
        metadata: {
          wallPrice: parseFloat(askWalls[0][0]),
          wallSize: parseFloat(askWalls[0][1]),
          liveOnly: true
        }
      };
    }
    
    return null;
  }

  // SIGNAL 3: Microprice Bias
  getMicropriceSignal() {
    if (!this.isLiveMode || !this.micropriceBias || !this.lastOrderBook) {
      return null;
    }
    
    if (this.lastOrderBook.bids.length === 0 || this.lastOrderBook.asks.length === 0) {
      return null;
    }
    
    const bestBid = parseFloat(this.lastOrderBook.bids[0][0]);
    const bestAsk = parseFloat(this.lastOrderBook.asks[0][0]);
    const bidSize = parseFloat(this.lastOrderBook.bids[0][1]);
    const askSize = parseFloat(this.lastOrderBook.asks[0][1]);
    
    if (bidSize + askSize === 0) return null;
    
    // Microprice calculation: weighted average of bid/ask by opposing volume
    const microprice = (bestBid * askSize + bestAsk * bidSize) / (bidSize + askSize);
    const midprice = (bestBid + bestAsk) / 2;
    const bias = ((microprice - midprice) / midprice) * 10000; // in basis points
    
    if (bias > 2) {
      return {
        type: 'bullish_microprice',
        direction: 'bullish',
        strength: 'weak',
        message: `Microprice bias: +${bias.toFixed(1)} bps`,
        metadata: {
          microprice,
          midprice,
          bias,
          liveOnly: true
        }
      };
    }
    
    if (bias < -2) {
      return {
        type: 'bearish_microprice',
        direction: 'bearish',
        strength: 'weak',
        message: `Microprice bias: ${bias.toFixed(1)} bps`,
        metadata: {
          microprice,
          midprice,
          bias,
          liveOnly: true
        }
      };
    }
    
    return null;
  }

  // SIGNAL 4: Imbalance Trend
  getImbalanceTrendSignal() {
    if (!this.isLiveMode || this.imbalanceHistory.length < 10) return null;
    
    const recent = this.imbalanceHistory.slice(-10);
    const oldAvg = recent.slice(0, 5).reduce((a, b) => a + b.imbalance, 0) / 5;
    const newAvg = recent.slice(5).reduce((a, b) => a + b.imbalance, 0) / 5;
    const change = newAvg - oldAvg;
    
    if (change > 0.10) {
      return {
        type: 'bullish_imbalance_trend',
        direction: 'bullish',
        strength: 'moderate',
        message: `DOM imbalance trending bullish (+${(change * 100).toFixed(1)}%)`,
        metadata: {
          oldAvg,
          newAvg,
          change,
          liveOnly: true
        }
      };
    }
    
    if (change < -0.10) {
      return {
        type: 'bearish_imbalance_trend',
        direction: 'bearish',
        strength: 'moderate',
        message: `DOM imbalance trending bearish (${(change * 100).toFixed(1)}%)`,
        metadata: {
          oldAvg,
          newAvg,
          change,
          liveOnly: true
        }
      };
    }
    
    return null;
  }

  /**
   * Get all signals
   */
  getSignals() {
    if (!this.isLiveMode) {
      return [];
    }
    
    const signals = [];
    
    const imbalance = this.getImbalanceSignal();
    if (imbalance) signals.push(imbalance);
    
    const wall = this.getWallSignal();
    if (wall) signals.push(wall);
    
    const microprice = this.getMicropriceSignal();
    if (microprice) signals.push(microprice);
    
    const trend = this.getImbalanceTrendSignal();
    if (trend) signals.push(trend);
    
    return signals;
  }

  /**
   * Get result object
   */
  getResult() {
    const currentImbalance = this.imbalanceHistory.length > 0
      ? this.imbalanceHistory[this.imbalanceHistory.length - 1].imbalance
      : null;
    
    return {
      value: {
        imbalance: currentImbalance,
        isLive: this.isLiveMode,
        updateCount: this.updateCount
      },
      signals: this.getSignals(),
      isWarmedUp: this.isWarmedUp(),
      warning: this.isLiveMode ? null : 'DOM signals disabled (not live mode)'
    };
  }

  /**
   * Reset state
   */
  reset() {
    this.lastOrderBook = null;
    this.imbalanceHistory = [];
    this.updateCount = 0;
  }
}

module.exports = DOMAnalyzer;
