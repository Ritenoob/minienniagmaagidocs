/**
 * Stochastic Oscillator - ENHANCED with Full Signal Detection
 * 
 * Signals: K/D Crossover, Zone Analysis, Divergence
 * Formula: %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
 *          %D = SMA(%K, dPeriod)
 * 
 * Max Weight: 10 points
 * 
 * @module StochasticIndicator
 */

class StochasticIndicator {
  /**
   * @param {Object} config
   * @param {number} [config.kPeriod=14] - %K period
   * @param {number} [config.dPeriod=3] - %D smoothing period
   * @param {number} [config.smooth=3] - %K smoothing
   * @param {number} [config.oversold=20] - Oversold threshold
   * @param {number} [config.overbought=80] - Overbought threshold
   */
  constructor(config = {}) {
    this.kPeriod = config.kPeriod || 14;
    this.dPeriod = config.dPeriod || 3;
    this.smooth = config.smooth || 3;
    this.oversold = config.oversold || 20;
    this.overbought = config.overbought || 80;
    
    this.highs = [];
    this.lows = [];
    this.closes = [];
    this.rawKValues = [];
    this.kValues = [];
    
    this.currentK = null;
    this.currentD = null;
    this.prevK = null;
    this.prevD = null;
    
    this.kHistory = [];
    this.priceHistory = [];
    this.maxHistory = config.historyLength || 50;
    
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  update(candle) {
    const { high, low, close } = candle;
    
    if (high === undefined || low === undefined || close === undefined) {
      return this.getResult();
    }
    
    this.candleCount++;
    
    this.prevK = this.currentK;
    this.prevD = this.currentD;
    
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);
    
    if (this.highs.length > this.kPeriod) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
    }
    
    if (this.highs.length < this.kPeriod) {
      return this.getResult();
    }
    
    const highestHigh = Math.max(...this.highs);
    const lowestLow = Math.min(...this.lows);
    const range = highestHigh - lowestLow;
    
    // Raw %K
    const rawK = range === 0 ? 50 : ((close - lowestLow) / range) * 100;
    this.rawKValues.push(rawK);
    
    if (this.rawKValues.length > this.smooth) {
      this.rawKValues.shift();
    }
    
    // Smoothed %K
    this.currentK = this.rawKValues.reduce((a, b) => a + b, 0) / this.rawKValues.length;
    
    // %D (SMA of %K)
    this.kHistory.push(this.currentK);
    if (this.kHistory.length >= this.dPeriod) {
      const dWindow = this.kHistory.slice(-this.dPeriod);
      this.currentD = dWindow.reduce((a, b) => a + b, 0) / this.dPeriod;
      this.isWarmedUp = true;
    }
    
    this.priceHistory.push(close);
    
    if (this.kHistory.length > this.maxHistory) {
      this.kHistory.shift();
    }
    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: K/D Crossover
   */
  getKDCrossover() {
    if (this.prevK === null || this.prevD === null) return null;
    if (this.currentK === null || this.currentD === null) return null;
    
    // Bullish: %K crosses ABOVE %D
    if (this.prevK <= this.prevD && this.currentK > this.currentD) {
      const inOversold = this.currentK < this.oversold + 10;
      return {
        type: 'bullish_kd_crossover',
        direction: 'bullish',
        strength: inOversold ? 'strong' : 'moderate',
        message: `%K crossed above %D ${inOversold ? '(in oversold zone)' : ''}`,
        metadata: { k: this.currentK, d: this.currentD, inOversold }
      };
    }
    
    // Bearish: %K crosses BELOW %D
    if (this.prevK >= this.prevD && this.currentK < this.currentD) {
      const inOverbought = this.currentK > this.overbought - 10;
      return {
        type: 'bearish_kd_crossover',
        direction: 'bearish',
        strength: inOverbought ? 'strong' : 'moderate',
        message: `%K crossed below %D ${inOverbought ? '(in overbought zone)' : ''}`,
        metadata: { k: this.currentK, d: this.currentD, inOverbought }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Zone Analysis
   */
  getZone() {
    if (this.currentK === null) return null;
    
    if (this.currentK < this.oversold) {
      const isExtreme = this.currentK < 10;
      return {
        type: 'oversold_zone',
        direction: 'bullish',
        strength: isExtreme ? 'extreme' : 'moderate',
        message: `Stochastic in oversold zone (%K: ${this.currentK.toFixed(1)})`,
        metadata: { k: this.currentK, d: this.currentD }
      };
    }
    
    if (this.currentK > this.overbought) {
      const isExtreme = this.currentK > 90;
      return {
        type: 'overbought_zone',
        direction: 'bearish',
        strength: isExtreme ? 'extreme' : 'moderate',
        message: `Stochastic in overbought zone (%K: ${this.currentK.toFixed(1)})`,
        metadata: { k: this.currentK, d: this.currentD }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Divergence Detection
   */
  getDivergence() {
    if (this.kHistory.length < 20 || this.priceHistory.length < 20) {
      return null;
    }

    const recentK = this.kHistory.slice(-14);
    const recentPrices = this.priceHistory.slice(-14);
    
    // Bullish divergence
    const priceLows = this._findSwingLows(recentPrices);
    const kLows = this._findSwingLows(recentK);
    
    if (priceLows.length >= 2 && kLows.length >= 2) {
      const lastPrice = recentPrices[priceLows[priceLows.length - 1]];
      const prevPrice = recentPrices[priceLows[priceLows.length - 2]];
      const lastK = recentK[kLows[kLows.length - 1]];
      const prevK = recentK[kLows[kLows.length - 2]];
      
      if (lastPrice < prevPrice && lastK > prevK) {
        return {
          type: 'bullish_divergence',
          direction: 'bullish',
          strength: 'very_strong',
          message: 'Bullish Stochastic divergence',
          metadata: { priceLow: lastPrice, kLow: lastK }
        };
      }
    }
    
    // Bearish divergence
    const priceHighs = this._findSwingHighs(recentPrices);
    const kHighs = this._findSwingHighs(recentK);
    
    if (priceHighs.length >= 2 && kHighs.length >= 2) {
      const lastPrice = recentPrices[priceHighs[priceHighs.length - 1]];
      const prevPrice = recentPrices[priceHighs[priceHighs.length - 2]];
      const lastK = recentK[kHighs[kHighs.length - 1]];
      const prevK = recentK[kHighs[kHighs.length - 2]];
      
      if (lastPrice > prevPrice && lastK < prevK) {
        return {
          type: 'bearish_divergence',
          direction: 'bearish',
          strength: 'very_strong',
          message: 'Bearish Stochastic divergence',
          metadata: { priceHigh: lastPrice, kHigh: lastK }
        };
      }
    }
    
    return null;
  }

  _findSwingLows(data) {
    const lows = [];
    for (let i = 2; i < data.length - 2; i++) {
      if (data[i] < data[i-1] && data[i] < data[i-2] &&
          data[i] < data[i+1] && data[i] < data[i+2]) {
        lows.push(i);
      }
    }
    return lows;
  }

  _findSwingHighs(data) {
    const highs = [];
    for (let i = 2; i < data.length - 2; i++) {
      if (data[i] > data[i-1] && data[i] > data[i-2] &&
          data[i] > data[i+1] && data[i] > data[i+2]) {
        highs.push(i);
      }
    }
    return highs;
  }

  getSignals() {
    if (!this.isWarmedUp) return [];
    
    const signals = [];
    
    const divergence = this.getDivergence();
    if (divergence) signals.push(divergence);
    
    const crossover = this.getKDCrossover();
    if (crossover) signals.push(crossover);
    
    const zone = this.getZone();
    if (zone) signals.push(zone);
    
    return signals;
  }

  getResult() {
    return {
      value: this.currentK !== null ? {
        k: this.currentK,
        d: this.currentD
      } : null,
      signals: this.isWarmedUp ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp
    };
  }

  reset() {
    this.highs = [];
    this.lows = [];
    this.closes = [];
    this.rawKValues = [];
    this.kValues = [];
    this.currentK = null;
    this.currentD = null;
    this.prevK = null;
    this.prevD = null;
    this.kHistory = [];
    this.priceHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }
}

module.exports = StochasticIndicator;
