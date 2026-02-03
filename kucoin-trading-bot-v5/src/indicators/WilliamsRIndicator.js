/**
 * Williams %R Indicator - ENHANCED with Full Signal Detection
 * 
 * Signals: Crossovers, Failure Swings, Divergence, Zone Analysis
 * Formula: %R = ((Highest High - Close) / (Highest High - Lowest Low)) * -100
 * 
 * Max Weight: 20 points
 * 
 * @module WilliamsRIndicator
 */

class WilliamsRIndicator {
  /**
   * @param {Object} config
   * @param {number} [config.period=14] - Lookback period
   * @param {number} [config.oversold=-80] - Oversold threshold
   * @param {number} [config.overbought=-20] - Overbought threshold
   * @param {number} [config.historyLength=50] - Max history for divergence
   */
  constructor(config = {}) {
    this.period = config.period || 14;
    this.oversoldLevel = config.oversold || -80;
    this.overboughtLevel = config.overbought || -20;
    
    this.highs = [];
    this.lows = [];
    this.closes = [];
    
    this.currentValue = null;
    this.prevValue = null;
    
    this.wrHistory = [];
    this.priceHistory = [];
    this.maxHistory = config.historyLength || 50;
    
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  /**
   * Update indicator with new candle
   * 
   * @param {Object} candle - { high, low, close }
   * @returns {{ value: number|null, signals: Signal[] }}
   */
  update(candle) {
    const { high, low, close } = candle;
    
    if (high === undefined || low === undefined || close === undefined) {
      return this.getResult();
    }
    
    this.candleCount++;
    this.prevValue = this.currentValue;
    
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);
    
    if (this.highs.length > this.period) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
    }
    
    if (this.highs.length < this.period) {
      return this.getResult();
    }
    
    this.isWarmedUp = true;
    
    const highestHigh = Math.max(...this.highs);
    const lowestLow = Math.min(...this.lows);
    const range = highestHigh - lowestLow;
    
    // Williams %R formula: ((HH - Close) / (HH - LL)) * -100
    this.currentValue = range === 0 ? -50 : ((highestHigh - close) / range) * -100;
    
    this.wrHistory.push(this.currentValue);
    this.priceHistory.push(close);
    
    if (this.wrHistory.length > this.maxHistory) {
      this.wrHistory.shift();
      this.priceHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: Crossover Detection
   */
  getCrossover() {
    if (this.prevValue === null || this.currentValue === null) return null;
    
    // Bullish: %R crosses ABOVE oversold (-80)
    if (this.prevValue <= this.oversoldLevel && this.currentValue > this.oversoldLevel) {
      return {
        type: 'bullish_crossover',
        direction: 'bullish',
        strength: 'strong',
        message: `Williams %R crossed above ${this.oversoldLevel} (oversold reversal)`,
        metadata: { from: this.prevValue, to: this.currentValue }
      };
    }
    
    // Bearish: %R crosses BELOW overbought (-20)
    if (this.prevValue >= this.overboughtLevel && this.currentValue < this.overboughtLevel) {
      return {
        type: 'bearish_crossover',
        direction: 'bearish',
        strength: 'strong',
        message: `Williams %R crossed below ${this.overboughtLevel} (overbought reversal)`,
        metadata: { from: this.prevValue, to: this.currentValue }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Failure Swing Detection
   * A failure swing occurs when %R fails to make a new extreme
   */
  getFailureSwing() {
    if (this.wrHistory.length < 10) return null;
    
    const recent = this.wrHistory.slice(-10);
    const recentMin = Math.min(...recent);
    const recentMax = Math.max(...recent);
    const priceRecent = this.priceHistory.slice(-10);
    
    // Bullish failure swing
    // %R fails to make new low despite price making new low
    if (this.currentValue < -60 && recentMin > -95) {
      const priceDecreasing = priceRecent[0] > priceRecent[priceRecent.length - 1];
      if (priceDecreasing) {
        return {
          type: 'bullish_failure_swing',
          direction: 'bullish',
          strength: 'moderate',
          message: 'Bullish failure swing (downtrend weakening)',
          metadata: { currentWR: this.currentValue, recentMin }
        };
      }
    }
    
    // Bearish failure swing
    // %R fails to make new high despite price making new high
    if (this.currentValue > -40 && recentMax < -5) {
      const priceIncreasing = priceRecent[0] < priceRecent[priceRecent.length - 1];
      if (priceIncreasing) {
        return {
          type: 'bearish_failure_swing',
          direction: 'bearish',
          strength: 'moderate',
          message: 'Bearish failure swing (uptrend weakening)',
          metadata: { currentWR: this.currentValue, recentMax }
        };
      }
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Divergence Detection
   */
  getDivergence() {
    if (this.wrHistory.length < 20) return null;
    
    const recentWR = this.wrHistory.slice(-14);
    const recentPrices = this.priceHistory.slice(-14);
    
    // Bullish divergence
    const priceLows = this._findSwingLows(recentPrices);
    const wrLows = this._findSwingLows(recentWR);
    
    if (priceLows.length >= 2 && wrLows.length >= 2) {
      const lastPrice = recentPrices[priceLows[priceLows.length - 1]];
      const prevPrice = recentPrices[priceLows[priceLows.length - 2]];
      const lastWR = recentWR[wrLows[wrLows.length - 1]];
      const prevWR = recentWR[wrLows[wrLows.length - 2]];
      
      if (lastPrice < prevPrice && lastWR > prevWR) {
        return {
          type: 'bullish_divergence',
          direction: 'bullish',
          strength: 'very_strong',
          message: 'Bullish divergence (price lower low, %R higher low)',
          metadata: { priceLow: lastPrice, wrLow: lastWR }
        };
      }
    }
    
    // Bearish divergence
    const priceHighs = this._findSwingHighs(recentPrices);
    const wrHighs = this._findSwingHighs(recentWR);
    
    if (priceHighs.length >= 2 && wrHighs.length >= 2) {
      const lastPrice = recentPrices[priceHighs[priceHighs.length - 1]];
      const prevPrice = recentPrices[priceHighs[priceHighs.length - 2]];
      const lastWR = recentWR[wrHighs[wrHighs.length - 1]];
      const prevWR = recentWR[wrHighs[wrHighs.length - 2]];
      
      if (lastPrice > prevPrice && lastWR < prevWR) {
        return {
          type: 'bearish_divergence',
          direction: 'bearish',
          strength: 'very_strong',
          message: 'Bearish divergence (price higher high, %R lower high)',
          metadata: { priceHigh: lastPrice, wrHigh: lastWR }
        };
      }
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Zone Analysis
   */
  getZone() {
    if (this.currentValue === null) return null;
    
    if (this.currentValue < this.oversoldLevel) {
      const isExtreme = this.currentValue < -90;
      return {
        type: 'oversold_zone',
        direction: 'bullish',
        strength: isExtreme ? 'extreme' : 'moderate',
        message: `Williams %R in oversold zone (${this.currentValue.toFixed(1)})`,
        metadata: { value: this.currentValue, isExtreme }
      };
    }
    
    if (this.currentValue > this.overboughtLevel) {
      const isExtreme = this.currentValue > -10;
      return {
        type: 'overbought_zone',
        direction: 'bearish',
        strength: isExtreme ? 'extreme' : 'moderate',
        message: `Williams %R in overbought zone (${this.currentValue.toFixed(1)})`,
        metadata: { value: this.currentValue, isExtreme }
      };
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
    if (!this.isWarmedUp || this.currentValue === null) {
      return [];
    }
    
    const signals = [];
    
    const divergence = this.getDivergence();
    if (divergence) signals.push(divergence);
    
    const crossover = this.getCrossover();
    if (crossover) signals.push(crossover);
    
    const failureSwing = this.getFailureSwing();
    if (failureSwing) signals.push(failureSwing);
    
    const zone = this.getZone();
    if (zone) signals.push(zone);
    
    return signals;
  }

  getResult() {
    return {
      value: this.currentValue,
      signals: this.isWarmedUp && this.currentValue !== null ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp
    };
  }

  reset() {
    this.highs = [];
    this.lows = [];
    this.closes = [];
    this.currentValue = null;
    this.prevValue = null;
    this.wrHistory = [];
    this.priceHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }
}

module.exports = WilliamsRIndicator;
