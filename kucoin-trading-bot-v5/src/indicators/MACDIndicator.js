/**
 * MACD Indicator - ENHANCED with Full Signal Detection
 * 
 * Signals: Signal Line Cross, Zero Line Cross, Histogram Analysis, Divergence
 * Formula: EMA-based (verified)
 * 
 * Signal Priority:
 * 1. DIVERGENCE           → very_strong (×1.2)
 * 2. SIGNAL_CROSS         → strong (×1.0)
 * 3. ZERO_CROSS           → strong (×1.0)
 * 4. HISTOGRAM            → moderate (×0.7)
 * 
 * Max Weight: 20 points
 * 
 * @module MACDIndicator
 */

const Decimal = require('decimal.js');

class MACDIndicator {
  /**
   * @param {Object} config
   * @param {number} [config.fastPeriod=12] - Fast EMA period
   * @param {number} [config.slowPeriod=26] - Slow EMA period
   * @param {number} [config.signalPeriod=9] - Signal line period
   * @param {number} [config.historyLength=50] - Max history for divergence
   */
  constructor(config = {}) {
    this.fastPeriod = config.fastPeriod || 12;
    this.slowPeriod = config.slowPeriod || 26;
    this.signalPeriod = config.signalPeriod || 9;
    
    // EMA states
    this.fastEMA = null;
    this.slowEMA = null;
    this.signalEMA = null;
    
    // EMA multipliers
    this.fastMultiplier = 2 / (this.fastPeriod + 1);
    this.slowMultiplier = 2 / (this.slowPeriod + 1);
    this.signalMultiplier = 2 / (this.signalPeriod + 1);
    
    // For initial SMA calculation
    this.priceCount = 0;
    this.priceSum = 0;
    this.prices = [];
    
    // Current values
    this.currentMACD = null;
    this.currentSignal = null;
    this.currentHistogram = null;
    
    // Previous values for crossover detection
    this.prevMACD = null;
    this.prevSignal = null;
    this.prevHistogram = null;
    
    // History for signal detection
    this.macdHistory = [];
    this.histogramHistory = [];
    this.priceHistory = [];
    this.maxHistory = config.historyLength || 50;
    
    // Warm-up tracking
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  /**
   * Update indicator with new candle data
   * 
   * @param {Object|number} candle - Candle object with { close } or just close price
   * @returns {{ value: Object|null, signals: Array<Signal> }}
   */
  update(candle) {
    const close = typeof candle === 'number' ? candle : candle.close;
    
    if (close === undefined || close === null || isNaN(close)) {
      return this.getResult();
    }
    
    this.candleCount++;
    this.priceCount++;
    this.priceSum += close;
    this.prices.push(close);
    
    // Store previous values for crossover detection
    this.prevMACD = this.currentMACD;
    this.prevSignal = this.currentSignal;
    this.prevHistogram = this.currentHistogram;
    
    // Initialize EMAs with SMA when we have enough data
    if (this.priceCount === this.slowPeriod) {
      this.slowEMA = this.priceSum / this.slowPeriod;
      
      // Calculate initial fast EMA from recent prices
      const fastSum = this.prices.slice(-this.fastPeriod).reduce((a, b) => a + b, 0);
      this.fastEMA = fastSum / this.fastPeriod;
    } else if (this.priceCount > this.slowPeriod) {
      // EMA calculation using standard formula
      this.fastEMA = (close - this.fastEMA) * this.fastMultiplier + this.fastEMA;
      this.slowEMA = (close - this.slowEMA) * this.slowMultiplier + this.slowEMA;
      
      // Calculate MACD line
      this.currentMACD = this.fastEMA - this.slowEMA;
      
      // Store MACD for signal line calculation
      this.macdHistory.push(this.currentMACD);
      
      // Signal line (EMA of MACD)
      if (this.signalEMA === null && this.macdHistory.length >= this.signalPeriod) {
        // Initialize with SMA
        this.signalEMA = this.macdHistory.slice(-this.signalPeriod).reduce((a, b) => a + b, 0) / this.signalPeriod;
        this.isWarmedUp = true;
      } else if (this.signalEMA !== null) {
        this.signalEMA = (this.currentMACD - this.signalEMA) * this.signalMultiplier + this.signalEMA;
      }
      
      this.currentSignal = this.signalEMA;
      
      // Histogram
      if (this.currentMACD !== null && this.currentSignal !== null) {
        this.currentHistogram = this.currentMACD - this.currentSignal;
        this.histogramHistory.push(this.currentHistogram);
      }
      
      // Trim histories
      if (this.macdHistory.length > this.maxHistory) {
        this.macdHistory.shift();
      }
      if (this.histogramHistory.length > this.maxHistory) {
        this.histogramHistory.shift();
      }
    }
    
    // Price history for divergence detection
    this.priceHistory.push(close);
    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory.shift();
    }
    
    // Trim prices array for memory
    if (this.prices.length > this.slowPeriod) {
      this.prices.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: Signal Line Crossover
   * 
   * @returns {Signal|null}
   */
  getSignalCrossover() {
    if (this.prevMACD === null || this.prevSignal === null) return null;
    if (this.currentMACD === null || this.currentSignal === null) return null;
    
    // Bullish: MACD crosses ABOVE signal line
    if (this.prevMACD <= this.prevSignal && this.currentMACD > this.currentSignal) {
      const crossoverStrength = Math.abs(this.currentMACD - this.currentSignal);
      return {
        type: 'bullish_signal_crossover',
        direction: 'bullish',
        strength: 'strong',
        message: 'MACD crossed above signal line (bullish crossover)',
        metadata: { 
          macd: this.currentMACD, 
          signal: this.currentSignal,
          crossoverStrength
        }
      };
    }
    
    // Bearish: MACD crosses BELOW signal line
    if (this.prevMACD >= this.prevSignal && this.currentMACD < this.currentSignal) {
      const crossoverStrength = Math.abs(this.currentMACD - this.currentSignal);
      return {
        type: 'bearish_signal_crossover',
        direction: 'bearish',
        strength: 'strong',
        message: 'MACD crossed below signal line (bearish crossover)',
        metadata: { 
          macd: this.currentMACD, 
          signal: this.currentSignal,
          crossoverStrength
        }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Zero Line Crossover
   * 
   * @returns {Signal|null}
   */
  getZeroCrossover() {
    if (this.prevMACD === null || this.currentMACD === null) return null;
    
    // Bullish: MACD crosses ABOVE zero
    if (this.prevMACD <= 0 && this.currentMACD > 0) {
      return {
        type: 'bullish_zero_crossover',
        direction: 'bullish',
        strength: 'strong',
        message: 'MACD crossed above zero line (trend confirmation)',
        metadata: { 
          macd: this.currentMACD,
          prevMACD: this.prevMACD
        }
      };
    }
    
    // Bearish: MACD crosses BELOW zero
    if (this.prevMACD >= 0 && this.currentMACD < 0) {
      return {
        type: 'bearish_zero_crossover',
        direction: 'bearish',
        strength: 'strong',
        message: 'MACD crossed below zero line (trend confirmation)',
        metadata: { 
          macd: this.currentMACD,
          prevMACD: this.prevMACD
        }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Histogram Analysis
   * Detects momentum acceleration/deceleration
   * 
   * @returns {Signal|null}
   */
  getHistogramSignal() {
    if (this.histogramHistory.length < 3) return null;
    
    const recent = this.histogramHistory.slice(-3);
    
    // Bullish momentum accelerating (positive bars getting larger)
    if (recent[0] > 0 && recent[1] > recent[0] && recent[2] > recent[1]) {
      return {
        type: 'bullish_momentum_accelerating',
        direction: 'bullish',
        strength: 'moderate',
        message: 'MACD histogram expanding (bullish momentum accelerating)',
        metadata: { histogram: recent }
      };
    }
    
    // Bearish momentum accelerating (negative bars getting larger/more negative)
    if (recent[0] < 0 && recent[1] < recent[0] && recent[2] < recent[1]) {
      return {
        type: 'bearish_momentum_accelerating',
        direction: 'bearish',
        strength: 'moderate',
        message: 'MACD histogram expanding (bearish momentum accelerating)',
        metadata: { histogram: recent }
      };
    }
    
    // Bullish momentum weakening (positive bars shrinking - potential reversal warning)
    if (recent[0] > 0 && recent[1] < recent[0] && recent[2] < recent[1] && recent[2] > 0) {
      return {
        type: 'bullish_momentum_weakening',
        direction: 'bearish',
        strength: 'weak',
        message: 'MACD histogram contracting (bullish momentum weakening)',
        metadata: { histogram: recent }
      };
    }
    
    // Bearish momentum weakening (negative bars shrinking - potential reversal warning)
    if (recent[0] < 0 && recent[1] > recent[0] && recent[2] > recent[1] && recent[2] < 0) {
      return {
        type: 'bearish_momentum_weakening',
        direction: 'bullish',
        strength: 'weak',
        message: 'MACD histogram contracting (bearish momentum weakening)',
        metadata: { histogram: recent }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Divergence Detection
   * 
   * @returns {Signal|null}
   */
  getDivergence() {
    if (this.macdHistory.length < 20 || this.priceHistory.length < 20) {
      return null;
    }

    const recentMACD = this.macdHistory.slice(-14);
    const recentPrices = this.priceHistory.slice(-14);
    
    // Check for bullish divergence
    const priceLows = this._findSwingLows(recentPrices);
    const macdLows = this._findSwingLows(recentMACD);
    
    if (priceLows.length >= 2 && macdLows.length >= 2) {
      const lastPriceLow = recentPrices[priceLows[priceLows.length - 1]];
      const prevPriceLow = recentPrices[priceLows[priceLows.length - 2]];
      const lastMACDLow = recentMACD[macdLows[macdLows.length - 1]];
      const prevMACDLow = recentMACD[macdLows[macdLows.length - 2]];
      
      // Bullish divergence: Price lower low, MACD higher low
      if (lastPriceLow < prevPriceLow && lastMACDLow > prevMACDLow) {
        return {
          type: 'bullish_divergence',
          direction: 'bullish',
          strength: 'very_strong',
          message: 'Bullish MACD divergence (price lower low, MACD higher low)',
          metadata: { 
            priceLow: lastPriceLow, 
            macdLow: lastMACDLow,
            divergenceStrength: Math.abs(lastMACDLow - prevMACDLow)
          }
        };
      }
    }
    
    // Check for bearish divergence
    const priceHighs = this._findSwingHighs(recentPrices);
    const macdHighs = this._findSwingHighs(recentMACD);
    
    if (priceHighs.length >= 2 && macdHighs.length >= 2) {
      const lastPriceHigh = recentPrices[priceHighs[priceHighs.length - 1]];
      const prevPriceHigh = recentPrices[priceHighs[priceHighs.length - 2]];
      const lastMACDHigh = recentMACD[macdHighs[macdHighs.length - 1]];
      const prevMACDHigh = recentMACD[macdHighs[macdHighs.length - 2]];
      
      // Bearish divergence: Price higher high, MACD lower high
      if (lastPriceHigh > prevPriceHigh && lastMACDHigh < prevMACDHigh) {
        return {
          type: 'bearish_divergence',
          direction: 'bearish',
          strength: 'very_strong',
          message: 'Bearish MACD divergence (price higher high, MACD lower high)',
          metadata: { 
            priceHigh: lastPriceHigh, 
            macdHigh: lastMACDHigh,
            divergenceStrength: Math.abs(lastMACDHigh - prevMACDHigh)
          }
        };
      }
    }
    
    return null;
  }

  /**
   * Find swing lows in data array
   * @private
   */
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

  /**
   * Find swing highs in data array
   * @private
   */
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

  /**
   * Get all active signals
   * 
   * @returns {Signal[]}
   */
  getSignals() {
    if (!this.isWarmedUp || this.currentMACD === null) {
      return [];
    }
    
    const signals = [];
    
    const divergence = this.getDivergence();
    if (divergence) signals.push(divergence);
    
    const signalCross = this.getSignalCrossover();
    if (signalCross) signals.push(signalCross);
    
    const zeroCross = this.getZeroCrossover();
    if (zeroCross) signals.push(zeroCross);
    
    const histogram = this.getHistogramSignal();
    if (histogram) signals.push(histogram);
    
    return signals;
  }

  /**
   * Get current result with value and signals
   * 
   * @returns {{ value: Object|null, signals: Signal[] }}
   */
  getResult() {
    return {
      value: this.currentMACD !== null ? {
        macd: this.currentMACD,
        signal: this.currentSignal,
        histogram: this.currentHistogram
      } : null,
      signals: this.isWarmedUp && this.currentMACD !== null ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp,
      candleCount: this.candleCount
    };
  }

  /**
   * Reset indicator state
   */
  reset() {
    this.fastEMA = null;
    this.slowEMA = null;
    this.signalEMA = null;
    this.priceCount = 0;
    this.priceSum = 0;
    this.prices = [];
    this.currentMACD = null;
    this.currentSignal = null;
    this.currentHistogram = null;
    this.prevMACD = null;
    this.prevSignal = null;
    this.prevHistogram = null;
    this.macdHistory = [];
    this.histogramHistory = [];
    this.priceHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  /**
   * Get indicator configuration
   */
  getConfig() {
    return {
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
      maxHistory: this.maxHistory
    };
  }
}

module.exports = MACDIndicator;
