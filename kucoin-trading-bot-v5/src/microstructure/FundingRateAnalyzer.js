'use strict';

/**
 * Funding Rate Analyzer
 * 
 * Tracks perpetual futures funding rates to detect:
 * - Extreme funding (crowded trades)
 * - Funding rate changes (momentum shifts)
 * - Predicted funding (next period)
 * 
 * Funding Mechanics:
 * - Positive: Longs pay shorts (bullish bias → reversal risk)
 * - Negative: Shorts pay longs (bearish bias → reversal risk)
 * - KuCoin interval: Every 8 hours
 * 
 * ⚠️ LIVE-ONLY: Requires real-time funding data
 * 
 * @module FundingRateAnalyzer
 */

const Decimal = require('decimal.js');

class FundingRateAnalyzer {
  /**
   * @param {Object} config
   * @param {number} [config.extremeThreshold=0.01] - Extreme threshold (0.01%)
   * @param {number} [config.highThreshold=0.005] - High threshold (0.005%)
   * @param {number} [config.changeThreshold=0.003] - Change threshold
   * @param {number} [config.fundingInterval=28800000] - 8 hours in ms
   * @param {number} [config.maxWeight=15] - Max signal weight
   */
  constructor(config = {}) {
    this.extremeThreshold = config.extremeThreshold || 0.01;
    this.highThreshold = config.highThreshold || 0.005;
    this.changeThreshold = config.changeThreshold || 0.003;
    this.fundingInterval = config.fundingInterval || 8 * 60 * 60 * 1000;
    this.maxWeight = config.maxWeight || 15;
    this.maxHistory = config.maxHistory || 100;
    
    // Current rates (stored as percentages)
    this.currentFundingRate = null;
    this.predictedFundingRate = null;
    this.lastFundingTime = null;
    this.nextFundingTime = null;
    
    // History
    this.fundingHistory = [];
    
    // Live mode
    this.liveOnlyValidation = true;
    this.isLiveMode = false;
  }

  enableLiveMode() {
    this.isLiveMode = true;
  }

  disableLiveMode() {
    this.isLiveMode = false;
  }

  /**
   * Update with funding data
   * @param {Object} fundingData - {currentRate, predictedRate, lastFundingTime, nextFundingTime}
   * @returns {Object} Result
   */
  update(fundingData) {
    if (!this.isLiveMode) return this.getResult();
    
    const prevRate = this.currentFundingRate;
    
    // Convert to percentage if needed (API returns decimals like 0.0001)
    if (fundingData.currentRate !== undefined) {
      const rate = new Decimal(fundingData.currentRate);
      this.currentFundingRate = rate.abs().lt(1) ? rate.mul(100).toNumber() : rate.toNumber();
    }
    
    if (fundingData.predictedRate !== undefined) {
      const rate = new Decimal(fundingData.predictedRate);
      this.predictedFundingRate = rate.abs().lt(1) ? rate.mul(100).toNumber() : rate.toNumber();
    }
    
    if (fundingData.lastFundingTime) this.lastFundingTime = fundingData.lastFundingTime;
    if (fundingData.nextFundingTime) this.nextFundingTime = fundingData.nextFundingTime;
    
    // Store history
    if (this.currentFundingRate !== null) {
      this.fundingHistory.push({
        ts: Date.now(),
        rate: this.currentFundingRate,
        predicted: this.predictedFundingRate,
        change: prevRate !== null ? this.currentFundingRate - prevRate : 0
      });
      
      if (this.fundingHistory.length > this.maxHistory) {
        this.fundingHistory.shift();
      }
    }
    
    return this.getResult();
  }

  getTimeUntilFunding() {
    if (!this.nextFundingTime) return null;
    return Math.max(0, this.nextFundingTime - Date.now());
  }

  isFundingImminent() {
    const timeUntil = this.getTimeUntilFunding();
    return timeUntil !== null && timeUntil < 60 * 60 * 1000;
  }

  /**
   * SIGNAL 1: Extreme Rate
   */
  getExtremeRateSignal() {
    if (!this.isLiveMode || this.currentFundingRate === null) return null;
    
    // Extreme positive
    if (this.currentFundingRate >= this.extremeThreshold) {
      return {
        type: 'extreme_positive_funding',
        direction: 'bearish',
        strength: 'very_strong',
        message: `EXTREME positive funding: ${this.currentFundingRate.toFixed(4)}%`,
        metadata: {
          rate: this.currentFundingRate,
          predicted: this.predictedFundingRate,
          interpretation: 'Longs overcrowded',
          liveOnly: true
        }
      };
    }
    
    // Extreme negative
    if (this.currentFundingRate <= -this.extremeThreshold) {
      return {
        type: 'extreme_negative_funding',
        direction: 'bullish',
        strength: 'very_strong',
        message: `EXTREME negative funding: ${this.currentFundingRate.toFixed(4)}%`,
        metadata: {
          rate: this.currentFundingRate,
          predicted: this.predictedFundingRate,
          interpretation: 'Shorts overcrowded',
          liveOnly: true
        }
      };
    }
    
    // High positive
    if (this.currentFundingRate >= this.highThreshold) {
      return {
        type: 'high_positive_funding',
        direction: 'bearish',
        strength: 'strong',
        message: `High positive funding: ${this.currentFundingRate.toFixed(4)}%`,
        metadata: { rate: this.currentFundingRate, liveOnly: true }
      };
    }
    
    // High negative
    if (this.currentFundingRate <= -this.highThreshold) {
      return {
        type: 'high_negative_funding',
        direction: 'bullish',
        strength: 'strong',
        message: `High negative funding: ${this.currentFundingRate.toFixed(4)}%`,
        metadata: { rate: this.currentFundingRate, liveOnly: true }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 2: Rate Change
   */
  getRateChangeSignal() {
    if (!this.isLiveMode || this.fundingHistory.length < 5) return null;
    
    const recent = this.fundingHistory.slice(-5);
    const oldRate = recent[0].rate;
    const newRate = recent[recent.length - 1].rate;
    const change = newRate - oldRate;
    
    if (change > this.changeThreshold) {
      return {
        type: 'funding_increasing',
        direction: 'bearish',
        strength: 'moderate',
        message: `Funding increasing: ${oldRate.toFixed(4)}% → ${newRate.toFixed(4)}%`,
        metadata: { change, oldRate, newRate, liveOnly: true }
      };
    }
    
    if (change < -this.changeThreshold) {
      return {
        type: 'funding_decreasing',
        direction: 'bullish',
        strength: 'moderate',
        message: `Funding decreasing: ${oldRate.toFixed(4)}% → ${newRate.toFixed(4)}%`,
        metadata: { change, oldRate, newRate, liveOnly: true }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 3: Predicted Rate
   */
  getPredictedRateSignal() {
    if (!this.isLiveMode || this.predictedFundingRate === null || this.currentFundingRate === null) {
      return null;
    }
    
    const diff = this.predictedFundingRate - this.currentFundingRate;
    
    if (diff > this.changeThreshold) {
      return {
        type: 'predicted_funding_increasing',
        direction: 'bearish',
        strength: 'moderate',
        message: `Predicted funding higher: ${this.currentFundingRate.toFixed(4)}% → ${this.predictedFundingRate.toFixed(4)}%`,
        metadata: { current: this.currentFundingRate, predicted: this.predictedFundingRate, diff, liveOnly: true }
      };
    }
    
    if (diff < -this.changeThreshold) {
      return {
        type: 'predicted_funding_decreasing',
        direction: 'bullish',
        strength: 'moderate',
        message: `Predicted funding lower: ${this.currentFundingRate.toFixed(4)}% → ${this.predictedFundingRate.toFixed(4)}%`,
        metadata: { current: this.currentFundingRate, predicted: this.predictedFundingRate, diff, liveOnly: true }
      };
    }
    
    return null;
  }

  /**
   * SIGNAL 4: Funding Timing
   */
  getFundingTimingSignal() {
    if (!this.isLiveMode) return null;
    
    const timeUntil = this.getTimeUntilFunding();
    if (timeUntil === null) return null;
    
    if (timeUntil < 30 * 60 * 1000 && Math.abs(this.currentFundingRate) >= this.highThreshold) {
      return {
        type: 'funding_imminent_extreme',
        direction: this.currentFundingRate > 0 ? 'bearish' : 'bullish',
        strength: 'strong',
        message: `Funding in ${Math.round(timeUntil / 60000)} min @ ${this.currentFundingRate > 0 ? '+' : ''}${this.currentFundingRate.toFixed(4)}%`,
        metadata: {
          timeUntilMs: timeUntil,
          rate: this.currentFundingRate,
          warning: this.currentFundingRate > 0 ? 'Longs will pay' : 'Shorts will pay',
          liveOnly: true
        }
      };
    }
    
    return null;
  }

  getSignals() {
    if (!this.isLiveMode) return [];
    
    const signals = [];
    
    const extreme = this.getExtremeRateSignal();
    if (extreme) signals.push(extreme);
    
    const change = this.getRateChangeSignal();
    if (change) signals.push(change);
    
    const predicted = this.getPredictedRateSignal();
    if (predicted) signals.push(predicted);
    
    const timing = this.getFundingTimingSignal();
    if (timing) signals.push(timing);
    
    return signals;
  }

  getResult() {
    const timeUntil = this.getTimeUntilFunding();
    
    return {
      value: {
        currentRate: this.currentFundingRate,
        predictedRate: this.predictedFundingRate,
        lastFundingTime: this.lastFundingTime,
        nextFundingTime: this.nextFundingTime,
        timeUntilFundingMs: timeUntil,
        timeUntilFundingMin: timeUntil ? Math.round(timeUntil / 60000) : null,
        isImminent: this.isFundingImminent(),
        isLive: this.isLiveMode
      },
      signals: this.getSignals(),
      warning: this.isLiveMode ? null : 'Funding rate signals disabled (not live mode)'
    };
  }

  getAnnualizedRate() {
    if (this.currentFundingRate === null) return null;
    return this.currentFundingRate * 3 * 365;
  }

  reset() {
    this.currentFundingRate = null;
    this.predictedFundingRate = null;
    this.lastFundingTime = null;
    this.nextFundingTime = null;
    this.fundingHistory = [];
  }
}

module.exports = FundingRateAnalyzer;
