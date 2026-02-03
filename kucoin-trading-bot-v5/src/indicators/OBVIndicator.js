/**
 * On-Balance Volume (OBV) - ENHANCED with Full Signal Detection
 * 
 * Signals: Slope Analysis, Breakout, Divergence
 * 
 * Formula:
 * if Close > Close_prev: OBV = OBV_prev + Volume
 * if Close < Close_prev: OBV = OBV_prev - Volume
 * if Close = Close_prev: OBV = OBV_prev
 * 
 * Max Weight: 10 points
 * 
 * @module OBVIndicator
 */

class OBVIndicator {
  /**
   * @param {Object} config
   * @param {number} [config.slopeWindow=14] - Window for slope calculation
   * @param {number} [config.smoothingEma=5] - EMA smoothing for signal
   * @param {number} [config.zScoreCap=2.0] - Z-score cap for normalization
   */
  constructor(config = {}) {
    this.slopeWindow = config.slopeWindow || 14;
    this.smoothingEma = config.smoothingEma || 5;
    this.zScoreCap = config.zScoreCap || 2.0;
    
    this.currentOBV = 0;
    this.prevClose = null;
    
    this.obvHistory = [];
    this.priceHistory = [];
    this.slopeHistory = [];
    this.maxHistory = config.historyLength || 100;
    
    this.candleCount = 0;
    this.isWarmedUp = false;
  }

  update(candle) {
    const { close, volume } = candle;
    
    if (close === undefined || volume === undefined) {
      return this.getResult();
    }
    
    this.candleCount++;
    
    // Calculate OBV
    if (this.prevClose !== null) {
      if (close > this.prevClose) {
        this.currentOBV += volume;
      } else if (close < this.prevClose) {
        this.currentOBV -= volume;
      }
      // If equal, OBV stays the same
    }
    
    this.prevClose = close;
    
    this.obvHistory.push(this.currentOBV);
    this.priceHistory.push(close);
    
    // Calculate slope when we have enough data
    if (this.obvHistory.length >= this.slopeWindow) {
      const recentOBV = this.obvHistory.slice(-this.slopeWindow);
      const slope = (recentOBV[recentOBV.length - 1] - recentOBV[0]) / this.slopeWindow;
      this.slopeHistory.push(slope);
      this.isWarmedUp = true;
    }
    
    // Trim histories
    if (this.obvHistory.length > this.maxHistory) {
      this.obvHistory.shift();
    }
    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory.shift();
    }
    if (this.slopeHistory.length > this.maxHistory) {
      this.slopeHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: Slope Analysis
   * Uses z-score normalization for cross-asset comparison
   */
  getSlopeSignal() {
    if (this.slopeHistory.length < 5) return null;
    
    const currentSlope = this.slopeHistory[this.slopeHistory.length - 1];
    const avgSlope = this.slopeHistory.reduce((a, b) => a + b, 0) / this.slopeHistory.length;
    const variance = this.slopeHistory.reduce((sum, s) => sum + Math.pow(s - avgSlope, 2), 0) / this.slopeHistory.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return null;
    
    const zScore = (currentSlope - avgSlope) / stdDev;
    const cappedZScore = Math.max(-this.zScoreCap, Math.min(this.zScoreCap, zScore));
    
    // Strong bullish volume flow
    if (cappedZScore > 1) {
      return {
        type: 'bullish_obv_slope',
        direction: 'bullish',
        strength: cappedZScore > 1.5 ? 'strong' : 'moderate',
        message: `OBV slope strongly positive (z-score: ${cappedZScore.toFixed(2)})`,
        metadata: { slope: currentSlope, zScore: cappedZScore }
      };
    }
    
    // Strong bearish volume flow
    if (cappedZScore < -1) {
      return {
        type: 'bearish_obv_slope',
        direction: 'bearish',
        strength: cappedZScore < -1.5 ? 'strong' : 'moderate',
        message: `OBV slope strongly negative (z-score: ${cappedZScore.toFixed(2)})`,
        metadata: { slope: currentSlope, zScore: cappedZScore }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: OBV Breakout
   * Detects when OBV breaks to new highs/lows
   */
  getBreakout() {
    if (this.obvHistory.length < 20) return null;
    
    const recent = this.obvHistory.slice(-20);
    const currentOBV = recent[recent.length - 1];
    const maxOBV = Math.max(...recent.slice(0, -1));
    const minOBV = Math.min(...recent.slice(0, -1));
    
    // OBV breakout to new highs (volume accumulation)
    if (currentOBV > maxOBV) {
      return {
        type: 'bullish_obv_breakout',
        direction: 'bullish',
        strength: 'strong',
        message: 'OBV broke to new 20-period high (volume accumulation)',
        metadata: { currentOBV, prevHigh: maxOBV }
      };
    }
    
    // OBV breakdown to new lows (volume distribution)
    if (currentOBV < minOBV) {
      return {
        type: 'bearish_obv_breakdown',
        direction: 'bearish',
        strength: 'strong',
        message: 'OBV broke to new 20-period low (volume distribution)',
        metadata: { currentOBV, prevLow: minOBV }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Divergence Detection
   */
  getDivergence() {
    if (this.obvHistory.length < 20 || this.priceHistory.length < 20) {
      return null;
    }

    const recentOBV = this.obvHistory.slice(-14);
    const recentPrices = this.priceHistory.slice(-14);
    
    // Bullish divergence: price lower low, OBV higher low
    const priceLows = this._findSwingLows(recentPrices);
    const obvLows = this._findSwingLows(recentOBV);
    
    if (priceLows.length >= 2 && obvLows.length >= 2) {
      const lastPrice = recentPrices[priceLows[priceLows.length - 1]];
      const prevPrice = recentPrices[priceLows[priceLows.length - 2]];
      const lastOBV = recentOBV[obvLows[obvLows.length - 1]];
      const prevOBV = recentOBV[obvLows[obvLows.length - 2]];
      
      if (lastPrice < prevPrice && lastOBV > prevOBV) {
        return {
          type: 'bullish_divergence',
          direction: 'bullish',
          strength: 'very_strong',
          message: 'Bullish OBV divergence (price lower low, OBV higher low)',
          metadata: { priceLow: lastPrice, obvLow: lastOBV }
        };
      }
    }
    
    // Bearish divergence: price higher high, OBV lower high
    const priceHighs = this._findSwingHighs(recentPrices);
    const obvHighs = this._findSwingHighs(recentOBV);
    
    if (priceHighs.length >= 2 && obvHighs.length >= 2) {
      const lastPrice = recentPrices[priceHighs[priceHighs.length - 1]];
      const prevPrice = recentPrices[priceHighs[priceHighs.length - 2]];
      const lastOBV = recentOBV[obvHighs[obvHighs.length - 1]];
      const prevOBV = recentOBV[obvHighs[obvHighs.length - 2]];
      
      if (lastPrice > prevPrice && lastOBV < prevOBV) {
        return {
          type: 'bearish_divergence',
          direction: 'bearish',
          strength: 'very_strong',
          message: 'Bearish OBV divergence (price higher high, OBV lower high)',
          metadata: { priceHigh: lastPrice, obvHigh: lastOBV }
        };
      }
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Price/OBV Confirmation
   * Checks if price trend is confirmed by volume
   */
  getConfirmation() {
    if (this.obvHistory.length < 10 || this.priceHistory.length < 10) {
      return null;
    }
    
    const recentPrices = this.priceHistory.slice(-10);
    const recentOBV = this.obvHistory.slice(-10);
    
    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0] * 100;
    const obvChange = recentOBV[recentOBV.length - 1] - recentOBV[0];
    
    // Price rising with OBV rising = bullish confirmation
    if (priceChange > 1 && obvChange > 0) {
      return {
        type: 'bullish_confirmation',
        direction: 'bullish',
        strength: 'moderate',
        message: 'Price rise confirmed by OBV',
        metadata: { priceChange, obvTrend: 'rising' }
      };
    }
    
    // Price falling with OBV falling = bearish confirmation
    if (priceChange < -1 && obvChange < 0) {
      return {
        type: 'bearish_confirmation',
        direction: 'bearish',
        strength: 'moderate',
        message: 'Price decline confirmed by OBV',
        metadata: { priceChange, obvTrend: 'falling' }
      };
    }
    
    // Price rising but OBV falling = weak rally (warning)
    if (priceChange > 1 && obvChange < 0) {
      return {
        type: 'weak_rally',
        direction: 'bearish',
        strength: 'weak',
        message: 'Price rising without volume support (weak rally)',
        metadata: { priceChange, obvTrend: 'falling' }
      };
    }
    
    // Price falling but OBV rising = accumulation (bullish)
    if (priceChange < -1 && obvChange > 0) {
      return {
        type: 'accumulation',
        direction: 'bullish',
        strength: 'weak',
        message: 'Accumulation detected (OBV rising while price falls)',
        metadata: { priceChange, obvTrend: 'rising' }
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
    if (!this.isWarmedUp) return [];
    
    const signals = [];
    
    const divergence = this.getDivergence();
    if (divergence) signals.push(divergence);
    
    const breakout = this.getBreakout();
    if (breakout) signals.push(breakout);
    
    const slope = this.getSlopeSignal();
    if (slope) signals.push(slope);
    
    const confirmation = this.getConfirmation();
    if (confirmation) signals.push(confirmation);
    
    return signals;
  }

  getResult() {
    return {
      value: this.currentOBV,
      signals: this.isWarmedUp ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp
    };
  }

  reset() {
    this.currentOBV = 0;
    this.prevClose = null;
    this.obvHistory = [];
    this.priceHistory = [];
    this.slopeHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }
}

module.exports = OBVIndicator;
