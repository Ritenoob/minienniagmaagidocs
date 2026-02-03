/**
 * RSI Indicator - ENHANCED with Full Signal Detection
 * 
 * Signals: Crossovers, Divergence, Momentum, Zone Analysis
 * Formula: Wilder Smoothing (verified)
 * 
 * Signal Priority:
 * 1. DIVERGENCE       → very_strong (×1.2)
 * 2. CROSSOVER        → strong (×1.0)
 * 3. MOMENTUM         → moderate (×0.7)
 * 4. ZONE             → moderate/extreme (×0.7/×1.1)
 * 
 * Max Weight: 25 points
 * 
 * @module RSIIndicator
 */

const Decimal = require('decimal.js');

class RSIIndicator {
  /**
   * @param {Object} config
   * @param {number} [config.period=14] - RSI period
   * @param {number} [config.oversold=30] - Oversold threshold
   * @param {number} [config.overbought=70] - Overbought threshold
   * @param {number} [config.historyLength=50] - Max history for divergence detection
   */
  constructor(config = {}) {
    this.period = config.period || 14;
    this.oversold = config.oversold || 30;
    this.overbought = config.overbought || 70;
    
    // Wilder smoothing state
    this.gains = [];
    this.losses = [];
    this.avgGain = null;
    this.avgLoss = null;
    
    // Current values
    this.currentValue = null;
    this.prevValue = null;
    this.prevClose = null;
    
    // History for signal detection
    this.rsiHistory = [];
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
   * @returns {{ value: number|null, signals: Array<Signal> }}
   */
  update(candle) {
    const close = typeof candle === 'number' ? candle : candle.close;
    
    if (close === undefined || close === null || isNaN(close)) {
      return this.getResult();
    }
    
    this.candleCount++;
    
    if (this.prevClose === null) {
      this.prevClose = close;
      this.priceHistory.push(close);
      return this.getResult();
    }

    // Store previous value for crossover detection
    this.prevValue = this.currentValue;
    
    // Calculate change
    const change = new Decimal(close).sub(this.prevClose).toNumber();
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    this.gains.push(gain);
    this.losses.push(loss);
    
    // Calculate RSI using Wilder smoothing
    if (this.gains.length <= this.period) {
      // Accumulation phase - use SMA for initial average
      if (this.gains.length === this.period) {
        this.avgGain = this.gains.reduce((a, b) => a + b, 0) / this.period;
        this.avgLoss = this.losses.reduce((a, b) => a + b, 0) / this.period;
        this.isWarmedUp = true;
      }
    } else {
      // Wilder smoothing: avgGain = ((prevAvgGain * (period-1)) + currentGain) / period
      this.avgGain = ((this.avgGain * (this.period - 1)) + gain) / this.period;
      this.avgLoss = ((this.avgLoss * (this.period - 1)) + loss) / this.period;
      
      // Trim arrays to prevent memory growth
      this.gains.shift();
      this.losses.shift();
    }
    
    // Calculate RSI value
    if (this.avgGain !== null) {
      if (this.avgLoss === 0) {
        this.currentValue = 100;
      } else {
        const rs = this.avgGain / this.avgLoss;
        this.currentValue = 100 - (100 / (1 + rs));
      }
      
      // Update history
      this.rsiHistory.push(this.currentValue);
      this.priceHistory.push(close);
      
      if (this.rsiHistory.length > this.maxHistory) {
        this.rsiHistory.shift();
        this.priceHistory.shift();
      }
    }
    
    this.prevClose = close;
    return this.getResult();
  }

  /**
   * SIGNAL 1: Crossover Detection
   * Detects when RSI crosses key thresholds (30/70)
   * 
   * @returns {Signal|null}
   */
  getCrossover() {
    if (this.prevValue === null || this.currentValue === null) return null;
    
    // Bullish: RSI crosses ABOVE oversold (30)
    if (this.prevValue <= this.oversold && this.currentValue > this.oversold) {
      return {
        type: 'bullish_crossover',
        direction: 'bullish',
        strength: 'strong',
        message: `RSI crossed above ${this.oversold} (oversold reversal)`,
        metadata: { 
          from: this.prevValue, 
          to: this.currentValue,
          threshold: this.oversold
        }
      };
    }
    
    // Bearish: RSI crosses BELOW overbought (70)
    if (this.prevValue >= this.overbought && this.currentValue < this.overbought) {
      return {
        type: 'bearish_crossover',
        direction: 'bearish',
        strength: 'strong',
        message: `RSI crossed below ${this.overbought} (overbought reversal)`,
        metadata: { 
          from: this.prevValue, 
          to: this.currentValue,
          threshold: this.overbought
        }
      };
    }
    
    // Midline crossovers (50 level)
    if (this.prevValue <= 50 && this.currentValue > 50) {
      return {
        type: 'bullish_midline_cross',
        direction: 'bullish',
        strength: 'moderate',
        message: 'RSI crossed above 50 (bullish momentum)',
        metadata: { from: this.prevValue, to: this.currentValue }
      };
    }
    
    if (this.prevValue >= 50 && this.currentValue < 50) {
      return {
        type: 'bearish_midline_cross',
        direction: 'bearish',
        strength: 'moderate',
        message: 'RSI crossed below 50 (bearish momentum)',
        metadata: { from: this.prevValue, to: this.currentValue }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Momentum Detection
   * Detects strong momentum shifts based on RSI slope
   * 
   * @returns {Signal|null}
   */
  getMomentum() {
    if (this.rsiHistory.length < 5) return null;
    
    const recent = this.rsiHistory.slice(-5);
    const slope = (recent[4] - recent[0]) / 4;
    
    // Strong bullish momentum (rising RSI from lower levels)
    if (slope > 3 && this.currentValue < 60) {
      return {
        type: 'bullish_momentum',
        direction: 'bullish',
        strength: 'moderate',
        message: `RSI momentum accelerating (slope: ${slope.toFixed(2)})`,
        metadata: { 
          slope,
          recentValues: recent,
          currentValue: this.currentValue
        }
      };
    }
    
    // Strong bearish momentum (falling RSI from higher levels)
    if (slope < -3 && this.currentValue > 40) {
      return {
        type: 'bearish_momentum',
        direction: 'bearish',
        strength: 'moderate',
        message: `RSI momentum decelerating (slope: ${slope.toFixed(2)})`,
        metadata: { 
          slope,
          recentValues: recent,
          currentValue: this.currentValue
        }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Divergence Detection (HIGHEST PRIORITY)
   * Detects when price and RSI diverge - strongest reversal signal
   * 
   * @returns {Signal|null}
   */
  getDivergence() {
    if (this.rsiHistory.length < 20 || this.priceHistory.length < 20) {
      return null;
    }

    const recentBars = 14;
    const recentRSI = this.rsiHistory.slice(-recentBars);
    const recentPrices = this.priceHistory.slice(-recentBars);
    
    // Find swing lows for bullish divergence
    const priceLows = this._findSwingLows(recentPrices);
    const rsiLows = this._findSwingLows(recentRSI);
    
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = recentPrices[priceLows[priceLows.length - 1]];
      const prevPriceLow = recentPrices[priceLows[priceLows.length - 2]];
      const lastRSILow = recentRSI[rsiLows[rsiLows.length - 1]];
      const prevRSILow = recentRSI[rsiLows[rsiLows.length - 2]];
      
      // BULLISH DIVERGENCE: Price makes lower low, RSI makes higher low
      if (lastPriceLow < prevPriceLow && lastRSILow > prevRSILow) {
        const divergenceStrength = Math.abs(lastRSILow - prevRSILow);
        return {
          type: 'bullish_divergence',
          direction: 'bullish',
          strength: 'very_strong',
          message: 'Bullish divergence (price lower low, RSI higher low)',
          metadata: { 
            priceLow: lastPriceLow,
            prevPriceLow,
            rsiLow: lastRSILow,
            prevRSILow,
            divergenceStrength
          }
        };
      }
    }
    
    // Find swing highs for bearish divergence
    const priceHighs = this._findSwingHighs(recentPrices);
    const rsiHighs = this._findSwingHighs(recentRSI);
    
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = recentPrices[priceHighs[priceHighs.length - 1]];
      const prevPriceHigh = recentPrices[priceHighs[priceHighs.length - 2]];
      const lastRSIHigh = recentRSI[rsiHighs[rsiHighs.length - 1]];
      const prevRSIHigh = recentRSI[rsiHighs[rsiHighs.length - 2]];
      
      // BEARISH DIVERGENCE: Price makes higher high, RSI makes lower high
      if (lastPriceHigh > prevPriceHigh && lastRSIHigh < prevRSIHigh) {
        const divergenceStrength = Math.abs(lastRSIHigh - prevRSIHigh);
        return {
          type: 'bearish_divergence',
          direction: 'bearish',
          strength: 'very_strong',
          message: 'Bearish divergence (price higher high, RSI lower high)',
          metadata: {
            priceHigh: lastPriceHigh,
            prevPriceHigh,
            rsiHigh: lastRSIHigh,
            prevRSIHigh,
            divergenceStrength
          }
        };
      }
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Zone Analysis
   * Detects when RSI is in overbought/oversold zones
   * 
   * @returns {Signal|null}
   */
  getZone() {
    if (this.currentValue === null) return null;
    
    // Oversold zone (bullish signal)
    if (this.currentValue < this.oversold) {
      const isExtreme = this.currentValue < 20;
      return {
        type: 'oversold_zone',
        direction: 'bullish',
        strength: isExtreme ? 'extreme' : 'moderate',
        message: `RSI in oversold zone (${this.currentValue.toFixed(1)})`,
        metadata: { 
          value: this.currentValue, 
          threshold: this.oversold,
          isExtreme
        }
      };
    }
    
    // Overbought zone (bearish signal)
    if (this.currentValue > this.overbought) {
      const isExtreme = this.currentValue > 80;
      return {
        type: 'overbought_zone',
        direction: 'bearish',
        strength: isExtreme ? 'extreme' : 'moderate',
        message: `RSI in overbought zone (${this.currentValue.toFixed(1)})`,
        metadata: { 
          value: this.currentValue, 
          threshold: this.overbought,
          isExtreme
        }
      };
    }
    
    return null;
  }

  /**
   * Find swing lows in data array
   * A swing low is a value lower than 2 bars on each side
   * 
   * @private
   * @param {number[]} data 
   * @returns {number[]} Array of indices
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
   * A swing high is a value higher than 2 bars on each side
   * 
   * @private
   * @param {number[]} data 
   * @returns {number[]} Array of indices
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
    if (!this.isWarmedUp || this.currentValue === null) {
      return [];
    }
    
    const signals = [];
    
    // Check each signal type (ordered by priority)
    const divergence = this.getDivergence();
    if (divergence) signals.push(divergence);
    
    const crossover = this.getCrossover();
    if (crossover) signals.push(crossover);
    
    const momentum = this.getMomentum();
    if (momentum) signals.push(momentum);
    
    const zone = this.getZone();
    if (zone) signals.push(zone);
    
    return signals;
  }

  /**
   * Get current result with value and signals
   * 
   * @returns {{ value: number|null, signals: Signal[] }}
   */
  getResult() {
    return {
      value: this.currentValue,
      signals: this.isWarmedUp && this.currentValue !== null ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp,
      candleCount: this.candleCount
    };
  }

  /**
   * Reset indicator state
   */
  reset() {
    this.gains = [];
    this.losses = [];
    this.avgGain = null;
    this.avgLoss = null;
    this.currentValue = null;
    this.prevValue = null;
    this.prevClose = null;
    this.rsiHistory = [];
    this.priceHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  /**
   * Get indicator configuration
   * 
   * @returns {Object}
   */
  getConfig() {
    return {
      period: this.period,
      oversold: this.oversold,
      overbought: this.overbought,
      maxHistory: this.maxHistory
    };
  }
}

module.exports = RSIIndicator;
