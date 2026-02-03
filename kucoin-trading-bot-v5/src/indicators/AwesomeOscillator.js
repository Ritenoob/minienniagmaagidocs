/**
 * Awesome Oscillator - ENHANCED with Bill Williams Patterns
 * 
 * Signals: Zero Cross, Saucer, Twin Peaks, Divergence
 * Formula: AO = SMA(Median Price, 5) - SMA(Median Price, 34)
 * 
 * Max Weight: 15 points
 * 
 * @module AwesomeOscillator
 */

class AwesomeOscillator {
  /**
   * @param {Object} config
   * @param {number} [config.fastPeriod=5] - Fast SMA period
   * @param {number} [config.slowPeriod=34] - Slow SMA period
   * @param {number} [config.historyLength=50] - Max history
   */
  constructor(config = {}) {
    this.fastPeriod = config.fastPeriod || 5;
    this.slowPeriod = config.slowPeriod || 34;
    
    this.fastWindow = [];
    this.slowWindow = [];
    this.fastSum = 0;
    this.slowSum = 0;
    
    this.currentAO = null;
    this.prevAO = null;
    
    this.aoHistory = [];
    this.priceHistory = [];
    this.maxHistory = config.historyLength || 50;
    
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  /**
   * Update with new candle
   * @param {Object} candle - { high, low, close }
   */
  update(candle) {
    const { high, low, close } = candle;
    
    if (high === undefined || low === undefined) {
      return this.getResult();
    }
    
    this.candleCount++;
    this.prevAO = this.currentAO;
    
    // Median price
    const median = (high + low) / 2;
    
    // Update fast SMA window
    this.fastWindow.push(median);
    this.fastSum += median;
    if (this.fastWindow.length > this.fastPeriod) {
      this.fastSum -= this.fastWindow.shift();
    }
    
    // Update slow SMA window
    this.slowWindow.push(median);
    this.slowSum += median;
    if (this.slowWindow.length > this.slowPeriod) {
      this.slowSum -= this.slowWindow.shift();
    }
    
    if (this.slowWindow.length < this.slowPeriod) {
      return this.getResult();
    }
    
    this.isWarmedUp = true;
    
    const fastSMA = this.fastSum / this.fastPeriod;
    const slowSMA = this.slowSum / this.slowPeriod;
    this.currentAO = fastSMA - slowSMA;
    
    this.aoHistory.push(this.currentAO);
    this.priceHistory.push(close || median);
    
    if (this.aoHistory.length > this.maxHistory) {
      this.aoHistory.shift();
      this.priceHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: Zero Line Cross
   */
  getZeroLineCross() {
    if (this.prevAO === null || this.currentAO === null) return null;
    
    if (this.prevAO <= 0 && this.currentAO > 0) {
      return {
        type: 'bullish_zero_cross',
        direction: 'bullish',
        strength: 'strong',
        message: 'AO crossed above zero line (bullish momentum)',
        metadata: { prevAO: this.prevAO, currentAO: this.currentAO }
      };
    }
    
    if (this.prevAO >= 0 && this.currentAO < 0) {
      return {
        type: 'bearish_zero_cross',
        direction: 'bearish',
        strength: 'strong',
        message: 'AO crossed below zero line (bearish momentum)',
        metadata: { prevAO: this.prevAO, currentAO: this.currentAO }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Saucer Pattern (Bill Williams)
   * Three bars where middle bar is lowest/highest
   */
  getSaucerPattern() {
    if (this.aoHistory.length < 3) return null;
    
    const [bar1, bar2, bar3] = this.aoHistory.slice(-3);
    
    // Bullish saucer: above zero, bar2 lower than bar1, bar3 higher than bar2
    if (bar1 > 0 && bar2 > 0 && bar3 > 0 && bar2 < bar1 && bar3 > bar2) {
      return {
        type: 'bullish_saucer',
        direction: 'bullish',
        strength: 'moderate',
        message: 'Bullish saucer pattern (continuation signal)',
        metadata: { bars: [bar1, bar2, bar3] }
      };
    }
    
    // Bearish saucer: below zero, bar2 higher than bar1, bar3 lower than bar2
    if (bar1 < 0 && bar2 < 0 && bar3 < 0 && bar2 > bar1 && bar3 < bar2) {
      return {
        type: 'bearish_saucer',
        direction: 'bearish',
        strength: 'moderate',
        message: 'Bearish saucer pattern (continuation signal)',
        metadata: { bars: [bar1, bar2, bar3] }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Twin Peaks Pattern (Bill Williams)
   * Two peaks on same side of zero with second peak closer to zero
   */
  getTwinPeaks() {
    if (this.aoHistory.length < 10) return null;
    
    const recent = this.aoHistory.slice(-10);
    const peaks = this._findPeaks(recent);
    const troughs = this._findTroughs(recent);
    
    // Bullish twin peaks: two troughs below zero, second higher (closer to zero)
    if (troughs.length >= 2) {
      const trough1 = recent[troughs[troughs.length - 2]];
      const trough2 = recent[troughs[troughs.length - 1]];
      
      if (trough1 < 0 && trough2 < 0 && trough2 > trough1) {
        // Verify there's a bar above zero between troughs or current bar heading up
        return {
          type: 'bullish_twin_peaks',
          direction: 'bullish',
          strength: 'strong',
          message: 'Bullish twin peaks (higher low below zero)',
          metadata: { trough1, trough2 }
        };
      }
    }
    
    // Bearish twin peaks: two peaks above zero, second lower (closer to zero)
    if (peaks.length >= 2) {
      const peak1 = recent[peaks[peaks.length - 2]];
      const peak2 = recent[peaks[peaks.length - 1]];
      
      if (peak1 > 0 && peak2 > 0 && peak2 < peak1) {
        return {
          type: 'bearish_twin_peaks',
          direction: 'bearish',
          strength: 'strong',
          message: 'Bearish twin peaks (lower high above zero)',
          metadata: { peak1, peak2 }
        };
      }
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Divergence Detection
   */
  getDivergence() {
    if (this.aoHistory.length < 20 || this.priceHistory.length < 20) {
      return null;
    }

    const recentAO = this.aoHistory.slice(-14);
    const recentPrice = this.priceHistory.slice(-14);
    
    // Bullish divergence
    const priceLows = this._findTroughs(recentPrice);
    const aoLows = this._findTroughs(recentAO);
    
    if (priceLows.length >= 2 && aoLows.length >= 2) {
      const lastPrice = recentPrice[priceLows[priceLows.length - 1]];
      const prevPrice = recentPrice[priceLows[priceLows.length - 2]];
      const lastAO = recentAO[aoLows[aoLows.length - 1]];
      const prevAO = recentAO[aoLows[aoLows.length - 2]];
      
      if (lastPrice < prevPrice && lastAO > prevAO) {
        return {
          type: 'bullish_divergence',
          direction: 'bullish',
          strength: 'very_strong',
          message: 'Bullish AO divergence (price lower low, AO higher low)',
          metadata: { priceLow: lastPrice, aoLow: lastAO }
        };
      }
    }
    
    // Bearish divergence
    const priceHighs = this._findPeaks(recentPrice);
    const aoHighs = this._findPeaks(recentAO);
    
    if (priceHighs.length >= 2 && aoHighs.length >= 2) {
      const lastPrice = recentPrice[priceHighs[priceHighs.length - 1]];
      const prevPrice = recentPrice[priceHighs[priceHighs.length - 2]];
      const lastAO = recentAO[aoHighs[aoHighs.length - 1]];
      const prevAO = recentAO[aoHighs[aoHighs.length - 2]];
      
      if (lastPrice > prevPrice && lastAO < prevAO) {
        return {
          type: 'bearish_divergence',
          direction: 'bearish',
          strength: 'very_strong',
          message: 'Bearish AO divergence (price higher high, AO lower high)',
          metadata: { priceHigh: lastPrice, aoHigh: lastAO }
        };
      }
    }
    
    return null;
  }

  _findPeaks(data) {
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i-1] && data[i] > data[i+1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  _findTroughs(data) {
    const troughs = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] < data[i-1] && data[i] < data[i+1]) {
        troughs.push(i);
      }
    }
    return troughs;
  }

  getSignals() {
    if (!this.isWarmedUp || this.currentAO === null) {
      return [];
    }
    
    const signals = [];
    
    const divergence = this.getDivergence();
    if (divergence) signals.push(divergence);
    
    const zeroCross = this.getZeroLineCross();
    if (zeroCross) signals.push(zeroCross);
    
    const twinPeaks = this.getTwinPeaks();
    if (twinPeaks) signals.push(twinPeaks);
    
    const saucer = this.getSaucerPattern();
    if (saucer) signals.push(saucer);
    
    return signals;
  }

  getResult() {
    return {
      value: this.currentAO,
      signals: this.isWarmedUp && this.currentAO !== null ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp
    };
  }

  reset() {
    this.fastWindow = [];
    this.slowWindow = [];
    this.fastSum = 0;
    this.slowSum = 0;
    this.currentAO = null;
    this.prevAO = null;
    this.aoHistory = [];
    this.priceHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }
}

module.exports = AwesomeOscillator;
