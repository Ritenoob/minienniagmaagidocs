/**
 * KDJ Indicator - Stochastic Variant with J-Line
 * 
 * Signals: J-Line Extremes, K/D Crossover, Divergence
 * 
 * Formula:
 * RSV = (Close - Lowest Low) / (Highest High - Lowest Low) × 100
 * K = (2/3) × K_prev + (1/3) × RSV
 * D = (2/3) × D_prev + (1/3) × K
 * J = 3K - 2D
 * 
 * Max Weight: 15 points
 * 
 * @module KDJIndicator
 */

class KDJIndicator {
  /**
   * @param {Object} config
   * @param {number} [config.kPeriod=9] - K period
   * @param {number} [config.dPeriod=3] - D smoothing
   * @param {number} [config.jOversold=20] - J oversold threshold
   * @param {number} [config.jOverbought=80] - J overbought threshold
   */
  constructor(config = {}) {
    this.kPeriod = config.kPeriod || 9;
    this.dPeriod = config.dPeriod || 3;
    this.jOversold = config.jOversold || 20;
    this.jOverbought = config.jOverbought || 80;
    
    this.highs = [];
    this.lows = [];
    this.closes = [];
    
    // KDJ values with initial smoothing
    this.currentK = 50;
    this.currentD = 50;
    this.currentJ = 50;
    
    this.prevK = null;
    this.prevD = null;
    this.prevJ = null;
    
    this.jHistory = [];
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
    this.prevJ = this.currentJ;
    
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
    
    // RSV (Raw Stochastic Value)
    const rsv = range === 0 ? 50 : ((close - lowestLow) / range) * 100;
    
    // K, D, J with standard KDJ smoothing
    // K = (2/3) × K_prev + (1/3) × RSV
    this.currentK = (2/3) * this.currentK + (1/3) * rsv;
    
    // D = (2/3) × D_prev + (1/3) × K
    this.currentD = (2/3) * this.currentD + (1/3) * this.currentK;
    
    // J = 3K - 2D (can go below 0 or above 100)
    this.currentJ = 3 * this.currentK - 2 * this.currentD;
    
    this.isWarmedUp = true;
    
    this.jHistory.push(this.currentJ);
    this.priceHistory.push(close);
    
    if (this.jHistory.length > this.maxHistory) {
      this.jHistory.shift();
      this.priceHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: J-Line Extremes
   * J-line can go below 0 and above 100, making it very sensitive
   */
  getJLineSignal() {
    if (!this.isWarmedUp) return null;
    
    // Extreme oversold (J < 0)
    if (this.currentJ < 0) {
      return {
        type: 'j_extreme_oversold',
        direction: 'bullish',
        strength: 'extreme',
        message: `KDJ J-line extremely oversold (J: ${this.currentJ.toFixed(1)})`,
        metadata: { k: this.currentK, d: this.currentD, j: this.currentJ }
      };
    }
    
    // Oversold (J < jOversold)
    if (this.currentJ < this.jOversold) {
      return {
        type: 'j_oversold',
        direction: 'bullish',
        strength: 'strong',
        message: `KDJ J-line oversold (J: ${this.currentJ.toFixed(1)})`,
        metadata: { k: this.currentK, d: this.currentD, j: this.currentJ }
      };
    }
    
    // Extreme overbought (J > 100)
    if (this.currentJ > 100) {
      return {
        type: 'j_extreme_overbought',
        direction: 'bearish',
        strength: 'extreme',
        message: `KDJ J-line extremely overbought (J: ${this.currentJ.toFixed(1)})`,
        metadata: { k: this.currentK, d: this.currentD, j: this.currentJ }
      };
    }
    
    // Overbought (J > jOverbought)
    if (this.currentJ > this.jOverbought) {
      return {
        type: 'j_overbought',
        direction: 'bearish',
        strength: 'strong',
        message: `KDJ J-line overbought (J: ${this.currentJ.toFixed(1)})`,
        metadata: { k: this.currentK, d: this.currentD, j: this.currentJ }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: K/D Crossover
   */
  getKDCrossover() {
    if (this.prevK === null || this.prevD === null) return null;
    
    // Bullish: K crosses above D
    if (this.prevK <= this.prevD && this.currentK > this.currentD) {
      const inOversold = this.currentJ < 50;
      return {
        type: 'bullish_kd_cross',
        direction: 'bullish',
        strength: inOversold ? 'strong' : 'moderate',
        message: `KDJ K crossed above D ${inOversold ? '(in oversold)' : ''}`,
        metadata: { k: this.currentK, d: this.currentD, j: this.currentJ }
      };
    }
    
    // Bearish: K crosses below D
    if (this.prevK >= this.prevD && this.currentK < this.currentD) {
      const inOverbought = this.currentJ > 50;
      return {
        type: 'bearish_kd_cross',
        direction: 'bearish',
        strength: inOverbought ? 'strong' : 'moderate',
        message: `KDJ K crossed below D ${inOverbought ? '(in overbought)' : ''}`,
        metadata: { k: this.currentK, d: this.currentD, j: this.currentJ }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Divergence Detection
   */
  getDivergence() {
    if (this.jHistory.length < 20) return null;
    
    const recentJ = this.jHistory.slice(-14);
    const recentPrices = this.priceHistory.slice(-14);
    
    // Bullish divergence
    const priceLows = this._findSwingLows(recentPrices);
    const jLows = this._findSwingLows(recentJ);
    
    if (priceLows.length >= 2 && jLows.length >= 2) {
      const lastPrice = recentPrices[priceLows[priceLows.length - 1]];
      const prevPrice = recentPrices[priceLows[priceLows.length - 2]];
      const lastJ = recentJ[jLows[jLows.length - 1]];
      const prevJ = recentJ[jLows[jLows.length - 2]];
      
      if (lastPrice < prevPrice && lastJ > prevJ) {
        return {
          type: 'bullish_divergence',
          direction: 'bullish',
          strength: 'very_strong',
          message: 'Bullish KDJ divergence (price lower low, J higher low)',
          metadata: { priceLow: lastPrice, jLow: lastJ }
        };
      }
    }
    
    // Bearish divergence
    const priceHighs = this._findSwingHighs(recentPrices);
    const jHighs = this._findSwingHighs(recentJ);
    
    if (priceHighs.length >= 2 && jHighs.length >= 2) {
      const lastPrice = recentPrices[priceHighs[priceHighs.length - 1]];
      const prevPrice = recentPrices[priceHighs[priceHighs.length - 2]];
      const lastJ = recentJ[jHighs[jHighs.length - 1]];
      const prevJ = recentJ[jHighs[jHighs.length - 2]];
      
      if (lastPrice > prevPrice && lastJ < prevJ) {
        return {
          type: 'bearish_divergence',
          direction: 'bearish',
          strength: 'very_strong',
          message: 'Bearish KDJ divergence (price higher high, J lower high)',
          metadata: { priceHigh: lastPrice, jHigh: lastJ }
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
    
    const jSignal = this.getJLineSignal();
    if (jSignal) signals.push(jSignal);
    
    const crossover = this.getKDCrossover();
    if (crossover) signals.push(crossover);
    
    return signals;
  }

  getResult() {
    return {
      value: this.isWarmedUp ? {
        k: this.currentK,
        d: this.currentD,
        j: this.currentJ
      } : null,
      signals: this.isWarmedUp ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp
    };
  }

  reset() {
    this.highs = [];
    this.lows = [];
    this.closes = [];
    this.currentK = 50;
    this.currentD = 50;
    this.currentJ = 50;
    this.prevK = null;
    this.prevD = null;
    this.prevJ = null;
    this.jHistory = [];
    this.priceHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }
}

module.exports = KDJIndicator;
