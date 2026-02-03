/**
 * EMA Trend - ENHANCED with Full Signal Detection
 * 
 * Signals: EMA Crosses, Golden/Death Cross, Slope Analysis, Price Distance
 * 
 * Max Weight: 20 points
 * 
 * @module EMATrend
 */

class EMATrend {
  /**
   * @param {Object} config
   * @param {number} [config.shortPeriod=9] - Short EMA period
   * @param {number} [config.mediumPeriod=21] - Medium EMA period
   * @param {number} [config.longPeriod=50] - Long EMA period
   * @param {number} [config.trendPeriod=200] - Trend EMA period
   */
  constructor(config = {}) {
    this.shortPeriod = config.shortPeriod || 9;
    this.mediumPeriod = config.mediumPeriod || 21;
    this.longPeriod = config.longPeriod || 50;
    this.trendPeriod = config.trendPeriod || 200;
    
    this.shortEMA = null;
    this.mediumEMA = null;
    this.longEMA = null;
    this.trendEMA = null;
    
    this.prevShortEMA = null;
    this.prevMediumEMA = null;
    this.prevLongEMA = null;
    this.prevTrendEMA = null;
    
    // EMA multipliers
    this.shortMult = 2 / (this.shortPeriod + 1);
    this.mediumMult = 2 / (this.mediumPeriod + 1);
    this.longMult = 2 / (this.longPeriod + 1);
    this.trendMult = 2 / (this.trendPeriod + 1);
    
    this.priceHistory = [];
    this.shortHistory = [];
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
    this.priceHistory.push(close);
    
    // Store previous values
    this.prevShortEMA = this.shortEMA;
    this.prevMediumEMA = this.mediumEMA;
    this.prevLongEMA = this.longEMA;
    this.prevTrendEMA = this.trendEMA;
    
    // Initialize EMAs with SMA when we have enough data
    if (this.candleCount === this.shortPeriod) {
      this.shortEMA = this.priceHistory.slice(-this.shortPeriod).reduce((a, b) => a + b, 0) / this.shortPeriod;
    }
    if (this.candleCount === this.mediumPeriod) {
      this.mediumEMA = this.priceHistory.slice(-this.mediumPeriod).reduce((a, b) => a + b, 0) / this.mediumPeriod;
    }
    if (this.candleCount === this.longPeriod) {
      this.longEMA = this.priceHistory.slice(-this.longPeriod).reduce((a, b) => a + b, 0) / this.longPeriod;
    }
    if (this.candleCount === this.trendPeriod) {
      this.trendEMA = this.priceHistory.slice(-this.trendPeriod).reduce((a, b) => a + b, 0) / this.trendPeriod;
      this.isWarmedUp = true;
    }
    
    // Update EMAs
    if (this.candleCount > this.shortPeriod && this.shortEMA !== null) {
      this.shortEMA = (close - this.shortEMA) * this.shortMult + this.shortEMA;
    }
    if (this.candleCount > this.mediumPeriod && this.mediumEMA !== null) {
      this.mediumEMA = (close - this.mediumEMA) * this.mediumMult + this.mediumEMA;
    }
    if (this.candleCount > this.longPeriod && this.longEMA !== null) {
      this.longEMA = (close - this.longEMA) * this.longMult + this.longEMA;
    }
    if (this.candleCount > this.trendPeriod && this.trendEMA !== null) {
      this.trendEMA = (close - this.trendEMA) * this.trendMult + this.trendEMA;
    }
    
    // Store short EMA history for slope
    if (this.shortEMA !== null) {
      this.shortHistory.push(this.shortEMA);
      if (this.shortHistory.length > this.maxHistory) {
        this.shortHistory.shift();
      }
    }
    
    // Trim price history
    if (this.priceHistory.length > this.trendPeriod + 10) {
      this.priceHistory.shift();
    }
    
    return this.getResult();
  }

  /**
   * SIGNAL 1: Short/Long EMA Cross
   */
  getEMACross() {
    if (this.prevShortEMA === null || this.prevLongEMA === null) return null;
    if (this.shortEMA === null || this.longEMA === null) return null;
    
    // Bullish: Short EMA crosses ABOVE Long EMA
    if (this.prevShortEMA <= this.prevLongEMA && this.shortEMA > this.longEMA) {
      return {
        type: 'bullish_ema_cross',
        direction: 'bullish',
        strength: 'strong',
        message: `EMA ${this.shortPeriod} crossed above EMA ${this.longPeriod}`,
        metadata: { short: this.shortEMA, long: this.longEMA }
      };
    }
    
    // Bearish: Short EMA crosses BELOW Long EMA
    if (this.prevShortEMA >= this.prevLongEMA && this.shortEMA < this.longEMA) {
      return {
        type: 'bearish_ema_cross',
        direction: 'bearish',
        strength: 'strong',
        message: `EMA ${this.shortPeriod} crossed below EMA ${this.longPeriod}`,
        metadata: { short: this.shortEMA, long: this.longEMA }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Golden/Death Cross (50/200 EMA)
   */
  getGoldenDeathCross() {
    if (this.prevLongEMA === null || this.trendEMA === null) return null;
    if (this.longEMA === null || this.prevTrendEMA === null) return null;
    
    // Golden Cross: 50 EMA crosses above 200 EMA
    if (this.prevLongEMA <= this.prevTrendEMA && this.longEMA > this.trendEMA) {
      return {
        type: 'golden_cross',
        direction: 'bullish',
        strength: 'very_strong',
        message: `Golden Cross: EMA ${this.longPeriod} crossed above EMA ${this.trendPeriod}`,
        metadata: { ema50: this.longEMA, ema200: this.trendEMA }
      };
    }
    
    // Death Cross: 50 EMA crosses below 200 EMA
    if (this.prevLongEMA >= this.prevTrendEMA && this.longEMA < this.trendEMA) {
      return {
        type: 'death_cross',
        direction: 'bearish',
        strength: 'very_strong',
        message: `Death Cross: EMA ${this.longPeriod} crossed below EMA ${this.trendPeriod}`,
        metadata: { ema50: this.longEMA, ema200: this.trendEMA }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Trend Direction
   */
  getTrendDirection() {
    if (this.trendEMA === null || this.priceHistory.length === 0) return null;
    
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    const distance = ((currentPrice - this.trendEMA) / this.trendEMA) * 100;
    
    // Bullish trend: Price above 200 EMA and short > long
    if (currentPrice > this.trendEMA && this.shortEMA > this.longEMA) {
      return {
        type: 'bullish_trend',
        direction: 'bullish',
        strength: Math.abs(distance) > 5 ? 'strong' : 'moderate',
        message: `Bullish trend (${distance.toFixed(1)}% above EMA ${this.trendPeriod})`,
        metadata: { distance, aligned: true }
      };
    }
    
    // Bearish trend: Price below 200 EMA and short < long
    if (currentPrice < this.trendEMA && this.shortEMA < this.longEMA) {
      return {
        type: 'bearish_trend',
        direction: 'bearish',
        strength: Math.abs(distance) > 5 ? 'strong' : 'moderate',
        message: `Bearish trend (${Math.abs(distance).toFixed(1)}% below EMA ${this.trendPeriod})`,
        metadata: { distance, aligned: true }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 4: EMA Slope (Momentum)
   */
  getSlope() {
    if (this.shortHistory.length < 5) return null;
    
    const recent = this.shortHistory.slice(-5);
    const slope = (recent[4] - recent[0]) / recent[0] * 100; // Percentage slope
    
    if (slope > 0.5) {
      return {
        type: 'bullish_slope',
        direction: 'bullish',
        strength: slope > 1 ? 'moderate' : 'weak',
        message: `EMA slope rising (${slope.toFixed(2)}%)`,
        metadata: { slope }
      };
    }
    
    if (slope < -0.5) {
      return {
        type: 'bearish_slope',
        direction: 'bearish',
        strength: slope < -1 ? 'moderate' : 'weak',
        message: `EMA slope falling (${slope.toFixed(2)}%)`,
        metadata: { slope }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 5: Price Distance from EMA (Mean Reversion)
   */
  getPriceDistance() {
    if (this.mediumEMA === null || this.priceHistory.length === 0) return null;
    
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    const distance = ((currentPrice - this.mediumEMA) / this.mediumEMA) * 100;
    
    // Extended above EMA (potential pullback)
    if (distance > 3) {
      return {
        type: 'extended_above_ema',
        direction: 'bearish',
        strength: distance > 5 ? 'moderate' : 'weak',
        message: `Price extended ${distance.toFixed(1)}% above EMA ${this.mediumPeriod}`,
        metadata: { distance, ema: this.mediumEMA }
      };
    }
    
    // Extended below EMA (potential bounce)
    if (distance < -3) {
      return {
        type: 'extended_below_ema',
        direction: 'bullish',
        strength: distance < -5 ? 'moderate' : 'weak',
        message: `Price extended ${Math.abs(distance).toFixed(1)}% below EMA ${this.mediumPeriod}`,
        metadata: { distance, ema: this.mediumEMA }
      };
    }
    
    return null;
  }

  getSignals() {
    if (!this.isWarmedUp) return [];
    
    const signals = [];
    
    const goldenDeath = this.getGoldenDeathCross();
    if (goldenDeath) signals.push(goldenDeath);
    
    const emaCross = this.getEMACross();
    if (emaCross) signals.push(emaCross);
    
    const trend = this.getTrendDirection();
    if (trend) signals.push(trend);
    
    const slope = this.getSlope();
    if (slope) signals.push(slope);
    
    const distance = this.getPriceDistance();
    if (distance) signals.push(distance);
    
    return signals;
  }

  getResult() {
    return {
      value: this.shortEMA !== null ? {
        short: this.shortEMA,
        medium: this.mediumEMA,
        long: this.longEMA,
        trend: this.trendEMA
      } : null,
      signals: this.isWarmedUp ? this.getSignals() : [],
      isWarmedUp: this.isWarmedUp
    };
  }

  reset() {
    this.shortEMA = null;
    this.mediumEMA = null;
    this.longEMA = null;
    this.trendEMA = null;
    this.prevShortEMA = null;
    this.prevMediumEMA = null;
    this.prevLongEMA = null;
    this.prevTrendEMA = null;
    this.priceHistory = [];
    this.shortHistory = [];
    this.candleCount = 0;
    this.isWarmedUp = false;
  }
}

module.exports = EMATrend;
