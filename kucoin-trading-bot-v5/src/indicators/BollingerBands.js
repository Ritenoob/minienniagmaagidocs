/**
 * Bollinger Bands - ENHANCED with Full Signal Detection
 * 
 * Signals: Band Touch, Squeeze, Breakout, %B Analysis
 * Formula: Middle = SMA(Close, period)
 *          Upper = Middle + (StdDev * multiplier)
 *          Lower = Middle - (StdDev * multiplier)
 * 
 * Max Weight: 10 points
 * 
 * @module BollingerBands
 */

class BollingerBands {
  /**
   * @param {Object} config
   * @param {number} [config.period=20] - SMA period
   * @param {number} [config.stdDev=2] - Standard deviation multiplier
   * @param {number} [config.historyLength=50] - Max history
   */
  constructor(config = {}) {
    this.period = config.period || 20;
    this.stdDev = config.stdDev || 2;
    
    this.prices = [];
    
    this.upper = null;
    this.middle = null;
    this.lower = null;
    this.bandwidth = null;
    this.percentB = null;
    
    this.prevUpper = null;
    this.prevLower = null;
    this.prevBandwidth = null;
    
    this.bandwidthHistory = [];
    this.priceHistory = [];
    this.maxHistory = config.historyLength || 50;
    
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  update(candle) {
    const close = typeof candle === 'number' ? candle : candle.close;
    
    if (close === undefined || close === null || isNaN(close)) {
      return this.getResult();
    }
    
    this.candleCount++;
    
    this.prevUpper = this.upper;
    this.prevLower = this.lower;
    this.prevBandwidth = this.bandwidth;
    
    this.prices.push(close);
    if (this.prices.length > this.period) {
      this.prices.shift();
    }
    
    if (this.prices.length < this.period) {
      return this.getResult();
    }
    
    this.isWarmedUp = true;
    
    // Calculate SMA (middle band)
    this.middle = this.prices.reduce((a, b) => a + b, 0) / this.period;
    
    // Calculate standard deviation
    const squaredDiffs = this.prices.map(p => Math.pow(p - this.middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.period;
    const std = Math.sqrt(variance);
    
    // Calculate bands
    this.upper = this.middle + (std * this.stdDev);
    this.lower = this.middle - (std * this.stdDev);
    
    // Bandwidth: (Upper - Lower) / Middle * 100
    this.bandwidth = ((this.upper - this.lower) / this.middle) * 100;
    
    // %B: (Close - Lower) / (Upper - Lower)
    const bandRange = this.upper - this.lower;
    this.percentB = bandRange === 0 ? 0.5 : (close - this.lower) / bandRange;
    
    this.bandwidthHistory.push(this.bandwidth);
    this.priceHistory.push(close);
    
    if (this.bandwidthHistory.length > this.maxHistory) {
      this.bandwidthHistory.shift();
    }
    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: Band Touch
   */
  getBandTouch() {
    if (this.upper === null) return null;
    
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    
    // Touch lower band (potential support)
    if (currentPrice <= this.lower * 1.001) {
      return {
        type: 'lower_band_touch',
        direction: 'bullish',
        strength: 'moderate',
        message: `Price touched lower Bollinger Band (${this.lower.toFixed(2)})`,
        metadata: { price: currentPrice, lower: this.lower, percentB: this.percentB }
      };
    }
    
    // Touch upper band (potential resistance)
    if (currentPrice >= this.upper * 0.999) {
      return {
        type: 'upper_band_touch',
        direction: 'bearish',
        strength: 'moderate',
        message: `Price touched upper Bollinger Band (${this.upper.toFixed(2)})`,
        metadata: { price: currentPrice, upper: this.upper, percentB: this.percentB }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Squeeze Detection
   * Squeeze indicates low volatility preceding big move
   */
  getSqueeze() {
    if (this.bandwidthHistory.length < 20) return null;
    
    const avgBandwidth = this.bandwidthHistory.reduce((a, b) => a + b, 0) / this.bandwidthHistory.length;
    const minBandwidth = Math.min(...this.bandwidthHistory.slice(-20));
    
    // Squeeze: bandwidth near 20-period minimum (within 10%)
    if (this.bandwidth < avgBandwidth * 0.5 && this.bandwidth <= minBandwidth * 1.1) {
      return {
        type: 'bollinger_squeeze',
        direction: 'neutral',
        strength: 'strong',
        message: `Bollinger squeeze detected (bandwidth: ${this.bandwidth.toFixed(2)}%)`,
        metadata: { 
          bandwidth: this.bandwidth, 
          avgBandwidth, 
          minBandwidth,
          warning: 'VOLATILITY_EXPANSION_IMMINENT'
        }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Breakout Detection
   */
  getBreakout() {
    if (this.prevUpper === null || this.priceHistory.length < 2) return null;
    
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    const prevPrice = this.priceHistory[this.priceHistory.length - 2];
    
    // Bullish breakout: price breaks above upper band
    if (prevPrice < this.prevUpper && currentPrice > this.upper) {
      return {
        type: 'bullish_breakout',
        direction: 'bullish',
        strength: 'strong',
        message: 'Price broke above upper Bollinger Band',
        metadata: { price: currentPrice, upper: this.upper }
      };
    }
    
    // Bearish breakdown: price breaks below lower band
    if (prevPrice > this.prevLower && currentPrice < this.lower) {
      return {
        type: 'bearish_breakdown',
        direction: 'bearish',
        strength: 'strong',
        message: 'Price broke below lower Bollinger Band',
        metadata: { price: currentPrice, lower: this.lower }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 4: %B Extremes
   */
  getPercentBSignal() {
    if (this.percentB === null) return null;
    
    // Extreme oversold (%B < 0)
    if (this.percentB < 0) {
      return {
        type: 'percentb_oversold',
        direction: 'bullish',
        strength: this.percentB < -0.1 ? 'strong' : 'moderate',
        message: `%B below lower band (${(this.percentB * 100).toFixed(1)}%)`,
        metadata: { percentB: this.percentB }
      };
    }
    
    // Extreme overbought (%B > 1)
    if (this.percentB > 1) {
      return {
        type: 'percentb_overbought',
        direction: 'bearish',
        strength: this.percentB > 1.1 ? 'strong' : 'moderate',
        message: `%B above upper band (${(this.percentB * 100).toFixed(1)}%)`,
        metadata: { percentB: this.percentB }
      };
    }
    
    return null;
  }

  getSignals() {
    if (!this.isWarmedUp) return [];
    
    const signals = [];
    
    const squeeze = this.getSqueeze();
    if (squeeze) signals.push(squeeze);
    
    const breakout = this.getBreakout();
    if (breakout) signals.push(breakout);
    
    const touch = this.getBandTouch();
    if (touch) signals.push(touch);
    
    const percentB = this.getPercentBSignal();
    if (percentB) signals.push(percentB);
    
    return signals;
  }

  getResult() {
    return {
      value: this.upper !== null ? {
        upper: this.upper,
        middle: this.middle,
        lower: this.lower,
        bandwidth: this.bandwidth,
        percentB: this.percentB
      } : null,
      signals: this.isWarmedUp ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp
    };
  }

  reset() {
    this.prices = [];
    this.upper = null;
    this.middle = null;
    this.lower = null;
    this.bandwidth = null;
    this.percentB = null;
    this.prevUpper = null;
    this.prevLower = null;
    this.prevBandwidth = null;
    this.bandwidthHistory = [];
    this.priceHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }
}

module.exports = BollingerBands;
