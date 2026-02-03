'use strict';

/**
 * ATR (Average True Range) Indicator
 * 
 * Measures market volatility using Wilder smoothing.
 * Used for: Position sizing, stop loss calculation, volatility filtering
 * 
 * Formula:
 * TR = max(high - low, |high - prevClose|, |low - prevClose|)
 * ATR = Wilder smoothed TR over period
 * 
 * @module ATRIndicator
 */

const Decimal = require('decimal.js');

class ATRIndicator {
  /**
   * @param {Object} config
   * @param {number} [config.period=14] - ATR period
   * @param {number} [config.historyLength=50] - Max history to retain
   */
  constructor(config = {}) {
    this.period = config.period || 14;
    this.maxHistory = config.historyLength || 50;
    
    // State
    this.prevClose = null;
    this.trValues = [];
    this.atr = null;
    this.prevATR = null;
    
    // History for analysis
    this.atrHistory = [];
    this.priceHistory = [];
    
    // Multiplier for Wilder smoothing
    this.multiplier = new Decimal(1).div(this.period);
  }

  /**
   * Update with new candle
   * @param {Object} candle - {open, high, low, close}
   * @returns {Object} Result with value and signals
   */
  update(candle) {
    const high = new Decimal(candle.high);
    const low = new Decimal(candle.low);
    const close = new Decimal(candle.close);
    
    this.prevATR = this.atr;
    
    // Calculate True Range
    let tr;
    if (this.prevClose === null) {
      // First candle: TR = high - low
      tr = high.minus(low);
    } else {
      // TR = max(H-L, |H-PC|, |L-PC|)
      const hl = high.minus(low);
      const hpc = high.minus(this.prevClose).abs();
      const lpc = low.minus(this.prevClose).abs();
      tr = Decimal.max(hl, hpc, lpc);
    }
    
    this.trValues.push(tr);
    
    // Calculate ATR
    if (this.trValues.length < this.period) {
      // Not enough data yet
      this.atr = null;
    } else if (this.trValues.length === this.period) {
      // Initial ATR: Simple average
      let sum = new Decimal(0);
      for (const t of this.trValues) {
        sum = sum.plus(t);
      }
      this.atr = sum.div(this.period);
    } else {
      // Wilder smoothing: ATR = ((ATR_prev * (n-1)) + TR) / n
      this.atr = this.atr
        .mul(this.period - 1)
        .plus(tr)
        .div(this.period);
      
      // Trim TR values
      this.trValues.shift();
    }
    
    // Update history
    if (this.atr !== null) {
      this.atrHistory.push({
        ts: Date.now(),
        value: this.atr.toNumber()
      });
      
      if (this.atrHistory.length > this.maxHistory) {
        this.atrHistory.shift();
      }
    }
    
    this.priceHistory.push(close.toNumber());
    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory.shift();
    }
    
    this.prevClose = close;
    
    return this.getResult();
  }

  /**
   * Get ATR as percentage of price
   * @returns {number|null} ATR%
   */
  getATRPercent() {
    if (this.atr === null || this.prevClose === null || this.prevClose.isZero()) {
      return null;
    }
    return this.atr.div(this.prevClose).mul(100).toNumber();
  }

  /**
   * Get volatility tier based on ATR%
   * @returns {string} 'low' | 'normal' | 'high' | 'extreme'
   */
  getVolatilityTier() {
    const atrPct = this.getATRPercent();
    if (atrPct === null) return 'unknown';
    
    if (atrPct < 1) return 'low';
    if (atrPct < 3) return 'normal';
    if (atrPct < 6) return 'high';
    return 'extreme';
  }

  /**
   * Calculate stop loss distance based on ATR multiple
   * @param {number} multiple - ATR multiple (e.g., 1.5, 2.0)
   * @returns {number|null} Stop distance in price units
   */
  getStopDistance(multiple = 1.5) {
    if (this.atr === null) return null;
    return this.atr.mul(multiple).toNumber();
  }

  /**
   * Check if volatility is expanding
   * @returns {boolean|null}
   */
  isVolatilityExpanding() {
    if (this.atrHistory.length < 10) return null;
    
    const recent = this.atrHistory.slice(-5);
    const older = this.atrHistory.slice(-10, -5);
    
    const recentAvg = recent.reduce((s, h) => s + h.value, 0) / recent.length;
    const olderAvg = older.reduce((s, h) => s + h.value, 0) / older.length;
    
    return recentAvg > olderAvg * 1.1;
  }

  /**
   * Check if volatility is contracting
   * @returns {boolean|null}
   */
  isVolatilityContracting() {
    if (this.atrHistory.length < 10) return null;
    
    const recent = this.atrHistory.slice(-5);
    const older = this.atrHistory.slice(-10, -5);
    
    const recentAvg = recent.reduce((s, h) => s + h.value, 0) / recent.length;
    const olderAvg = older.reduce((s, h) => s + h.value, 0) / older.length;
    
    return recentAvg < olderAvg * 0.9;
  }

  /**
   * Generate signals
   * @returns {Array} Signal array
   */
  getSignals() {
    const signals = [];
    
    // Volatility expansion signal
    if (this.isVolatilityExpanding()) {
      signals.push({
        type: 'volatility_expanding',
        direction: 'neutral',
        strength: 'moderate',
        message: `Volatility expanding (ATR: ${this.atr?.toFixed(2)})`,
        metadata: {
          atr: this.atr?.toNumber(),
          atrPercent: this.getATRPercent(),
          tier: this.getVolatilityTier()
        }
      });
    }
    
    // Volatility contraction signal (potential breakout setup)
    if (this.isVolatilityContracting()) {
      signals.push({
        type: 'volatility_contracting',
        direction: 'neutral',
        strength: 'moderate',
        message: `Volatility contracting (squeeze potential)`,
        metadata: {
          atr: this.atr?.toNumber(),
          atrPercent: this.getATRPercent(),
          tier: this.getVolatilityTier()
        }
      });
    }
    
    // Extreme volatility warning
    if (this.getVolatilityTier() === 'extreme') {
      signals.push({
        type: 'extreme_volatility',
        direction: 'neutral',
        strength: 'strong',
        message: `EXTREME volatility detected (ATR%: ${this.getATRPercent()?.toFixed(2)}%)`,
        metadata: {
          atr: this.atr?.toNumber(),
          atrPercent: this.getATRPercent(),
          warning: 'REDUCE_SIZE'
        }
      });
    }
    
    return signals;
  }

  /**
   * Get result object
   * @returns {Object}
   */
  getResult() {
    return {
      value: this.atr?.toNumber() ?? null,
      atrPercent: this.getATRPercent(),
      volatilityTier: this.getVolatilityTier(),
      signals: this.atr !== null ? this.getSignals() : []
    };
  }

  /**
   * Reset state
   */
  reset() {
    this.prevClose = null;
    this.trValues = [];
    this.atr = null;
    this.prevATR = null;
    this.atrHistory = [];
    this.priceHistory = [];
  }
}

module.exports = ATRIndicator;
