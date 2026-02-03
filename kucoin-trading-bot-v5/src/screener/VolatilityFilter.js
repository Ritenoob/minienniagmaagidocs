'use strict';

/**
 * Volatility Filter - ATR-based filtering
 * 
 * Provides volatility analysis for coin screening:
 * - ATR (Average True Range) calculation
 * - Volatility regime detection (low/medium/high)
 * - Volatility-based position sizing suggestions
 * - Volatility breakout detection
 * - Historical volatility comparison
 * 
 * @module VolatilityFilter
 */

const Decimal = require('decimal.js');

class VolatilityFilter {
  /**
   * @param {Object} config
   * @param {number} [config.atrPeriod=14] - ATR calculation period
   * @param {number} [config.volatilityPeriod=20] - Volatility analysis period
   * @param {number} [config.lowVolThreshold=0.5] - Low volatility percentile
   * @param {number} [config.highVolThreshold=1.5] - High volatility percentile
   * @param {number} [config.historyLength=100] - Max history bars to keep
   */
  constructor(config = {}) {
    this.atrPeriod = config.atrPeriod || 14;
    this.volatilityPeriod = config.volatilityPeriod || 20;
    this.lowVolThreshold = config.lowVolThreshold || 0.5;
    this.highVolThreshold = config.highVolThreshold || 1.5;
    this.historyLength = config.historyLength || 100;
    
    // Per-symbol data
    this.candleHistory = new Map();
    this.atrHistory = new Map();
    this.volatilityStats = new Map();
  }

  /**
   * Update volatility data for a symbol from candle
   * @param {string} symbol
   * @param {Object} candle - { ts, open, high, low, close, volume }
   */
  update(symbol, candle) {
    const high = parseFloat(candle.high) || 0;
    const low = parseFloat(candle.low) || 0;
    const close = parseFloat(candle.close) || 0;
    
    // Initialize if needed
    if (!this.candleHistory.has(symbol)) {
      this.candleHistory.set(symbol, []);
      this.atrHistory.set(symbol, []);
    }
    
    const history = this.candleHistory.get(symbol);
    
    // Get previous close
    const prevClose = history.length > 0 
      ? history[history.length - 1].close 
      : close;
    
    // Calculate True Range
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    // Add to history
    history.push({
      ts: candle.ts,
      open: parseFloat(candle.open) || 0,
      high,
      low,
      close,
      tr
    });
    
    // Trim history
    if (history.length > this.historyLength) {
      history.shift();
    }
    
    // Calculate ATR
    this._updateATR(symbol);
    
    // Update volatility stats
    this._updateStats(symbol);
    
    return this.getResult(symbol);
  }

  /**
   * Calculate ATR using Wilder's smoothing
   */
  _updateATR(symbol) {
    const history = this.candleHistory.get(symbol);
    const atrHist = this.atrHistory.get(symbol);
    
    if (history.length < this.atrPeriod) return;
    
    let atr;
    
    if (atrHist.length === 0) {
      // Initial ATR is simple average
      const trValues = history.slice(-this.atrPeriod).map(c => c.tr);
      atr = trValues.reduce((a, b) => a + b, 0) / this.atrPeriod;
    } else {
      // Wilder's smoothing
      const prevATR = atrHist[atrHist.length - 1];
      const currentTR = history[history.length - 1].tr;
      atr = ((prevATR * (this.atrPeriod - 1)) + currentTR) / this.atrPeriod;
    }
    
    atrHist.push(atr);
    
    // Trim ATR history
    if (atrHist.length > this.historyLength) {
      atrHist.shift();
    }
  }

  /**
   * Update volatility statistics
   */
  _updateStats(symbol) {
    const history = this.candleHistory.get(symbol);
    const atrHist = this.atrHistory.get(symbol);
    
    if (atrHist.length === 0) return;
    
    const currentATR = atrHist[atrHist.length - 1];
    const currentPrice = history[history.length - 1].close;
    
    // ATR as percentage of price
    const atrPercent = currentPrice > 0 ? (currentATR / currentPrice) * 100 : 0;
    
    // Average ATR over period
    const recentATRs = atrHist.slice(-this.volatilityPeriod);
    const avgATR = recentATRs.reduce((a, b) => a + b, 0) / recentATRs.length;
    
    // Relative ATR (current vs average)
    let relativeATR;
    if (avgATR === 0 && currentATR === 0) {
      // Avoid 0/0 -> NaN; treat as neutral volatility
      relativeATR = 1;
    } else if (avgATR > 0) {
      relativeATR = currentATR / avgATR;
    } else {
      // Fallback for unexpected non-positive avgATR
      relativeATR = 1;
    }

    // Ensure relativeATR is a finite number
    if (!Number.isFinite(relativeATR)) {
      relativeATR = 1;
    }
    
    // Historical volatility (standard deviation of returns)
    const returns = [];
    for (let i = 1; i < history.length; i++) {
      const ret = (history[i].close - history[i - 1].close) / history[i - 1].close;
      returns.push(ret);
    }
    
    let historicalVol = 0;
    if (returns.length > 1) {
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const squaredDiffs = returns.map(r => Math.pow(r - avgReturn, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
      historicalVol = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized
    }
    
    // Volatility regime
    let regime;
    if (relativeATR < this.lowVolThreshold) {
      regime = 'low';
    } else if (relativeATR > this.highVolThreshold) {
      regime = 'high';
    } else {
      regime = 'medium';
    }
    
    // ATR trend
    const atrTrend = this._calculateATRTrend(atrHist);
    
    // Volatility contraction/expansion
    const isContracting = atrTrend < -5 && regime !== 'high';
    const isExpanding = atrTrend > 5 && regime !== 'low';
    
    // Position size suggestion (inverse of volatility)
    // Higher volatility = smaller position
    const basePositionMultiplier = 1 / Math.max(relativeATR, 0.5);
    const positionSizeMultiplier = Math.min(2, Math.max(0.25, basePositionMultiplier));
    
    this.volatilityStats.set(symbol, {
      currentATR,
      atrPercent,
      avgATR,
      relativeATR,
      historicalVol,
      regime,
      atrTrend,
      isContracting,
      isExpanding,
      positionSizeMultiplier,
      lastPrice: currentPrice,
      lastUpdate: Date.now()
    });
  }

  /**
   * Calculate ATR trend
   */
  _calculateATRTrend(atrHist) {
    if (atrHist.length < 5) return 0;
    
    const recent = atrHist.slice(-5);
    const n = recent.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recent[i];
      sumXY += i * recent[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avg = sumY / n;
    
    return avg > 0 ? (slope / avg) * 100 : 0;
  }

  /**
   * Get volatility analysis result for a symbol
   */
  getResult(symbol) {
    const stats = this.volatilityStats.get(symbol);
    
    if (!stats) {
      return {
        value: 0,
        signals: []
      };
    }
    
    const signals = [];
    
    // High volatility regime
    if (stats.regime === 'high') {
      signals.push({
        type: 'high_volatility',
        direction: 'neutral',
        strength: stats.relativeATR >= 2 ? 'very_strong' : 'strong',
        message: `High volatility regime (ATR ${stats.relativeATR.toFixed(2)}x average)`,
        metadata: {
          relativeATR: stats.relativeATR,
          regime: stats.regime,
          atrPercent: stats.atrPercent
        }
      });
    }
    
    // Low volatility regime (potential squeeze)
    if (stats.regime === 'low') {
      signals.push({
        type: 'low_volatility',
        direction: 'neutral',
        strength: stats.relativeATR <= 0.3 ? 'strong' : 'moderate',
        message: `Low volatility regime - potential squeeze (ATR ${stats.relativeATR.toFixed(2)}x average)`,
        metadata: {
          relativeATR: stats.relativeATR,
          regime: stats.regime,
          atrPercent: stats.atrPercent
        }
      });
    }
    
    // Volatility expansion
    if (stats.isExpanding) {
      signals.push({
        type: 'volatility_expansion',
        direction: 'neutral',
        strength: 'moderate',
        message: `Volatility expanding (+${stats.atrTrend.toFixed(1)}% trend)`,
        metadata: {
          atrTrend: stats.atrTrend
        }
      });
    }
    
    // Volatility contraction (squeeze building)
    if (stats.isContracting) {
      signals.push({
        type: 'volatility_contraction',
        direction: 'neutral',
        strength: 'moderate',
        message: `Volatility contracting (${stats.atrTrend.toFixed(1)}% trend) - squeeze building`,
        metadata: {
          atrTrend: stats.atrTrend
        }
      });
    }
    
    // Position sizing recommendation
    if (stats.positionSizeMultiplier < 0.5) {
      signals.push({
        type: 'reduce_position_size',
        direction: 'neutral',
        strength: 'strong',
        message: `High volatility - reduce position size to ${(stats.positionSizeMultiplier * 100).toFixed(0)}%`,
        metadata: {
          positionSizeMultiplier: stats.positionSizeMultiplier
        }
      });
    } else if (stats.positionSizeMultiplier > 1.5) {
      signals.push({
        type: 'increase_position_size',
        direction: 'neutral',
        strength: 'moderate',
        message: `Low volatility - can increase position size to ${(stats.positionSizeMultiplier * 100).toFixed(0)}%`,
        metadata: {
          positionSizeMultiplier: stats.positionSizeMultiplier
        }
      });
    }
    
    return {
      value: {
        currentATR: stats.currentATR,
        atrPercent: stats.atrPercent,
        avgATR: stats.avgATR,
        relativeATR: stats.relativeATR,
        historicalVol: stats.historicalVol,
        regime: stats.regime,
        atrTrend: stats.atrTrend,
        positionSizeMultiplier: stats.positionSizeMultiplier
      },
      signals
    };
  }

  /**
   * Check if symbol passes volatility filter
   * @param {string} symbol 
   * @param {Object} options
   * @returns {Object} { passes, reason }
   */
  passesFilter(symbol, options = {}) {
    const stats = this.volatilityStats.get(symbol);
    
    if (!stats) {
      return { passes: false, reason: 'No volatility data available' };
    }
    
    const minATRPercent = options.minATRPercent || 0.5;
    const maxATRPercent = options.maxATRPercent || 10;
    const allowHighVol = options.allowHighVol !== false;
    const allowLowVol = options.allowLowVol !== false;
    
    // Check ATR percentage bounds
    if (stats.atrPercent < minATRPercent) {
      return { passes: false, reason: `ATR too low (${stats.atrPercent.toFixed(2)}% < ${minATRPercent}%)` };
    }
    
    if (stats.atrPercent > maxATRPercent) {
      return { passes: false, reason: `ATR too high (${stats.atrPercent.toFixed(2)}% > ${maxATRPercent}%)` };
    }
    
    // Check regime
    if (!allowHighVol && stats.regime === 'high') {
      return { passes: false, reason: 'High volatility regime not allowed' };
    }
    
    if (!allowLowVol && stats.regime === 'low') {
      return { passes: false, reason: 'Low volatility regime not allowed' };
    }
    
    return { passes: true, reason: 'Passes volatility filter' };
  }

  /**
   * Compare volatility across symbols
   * @param {string[]} symbols 
   * @returns {Array} Sorted by relative ATR
   */
  compareVolatility(symbols) {
    const results = [];
    
    for (const symbol of symbols) {
      const stats = this.volatilityStats.get(symbol);
      if (stats) {
        results.push({
          symbol,
          relativeATR: stats.relativeATR,
          atrPercent: stats.atrPercent,
          regime: stats.regime,
          historicalVol: stats.historicalVol,
          positionSizeMultiplier: stats.positionSizeMultiplier
        });
      }
    }
    
    return results.sort((a, b) => b.relativeATR - a.relativeATR);
  }

  /**
   * Get symbols by volatility regime
   */
  getSymbolsByRegime(regime) {
    const symbols = [];
    
    for (const [symbol, stats] of this.volatilityStats) {
      if (stats.regime === regime) {
        symbols.push({
          symbol,
          relativeATR: stats.relativeATR,
          atrPercent: stats.atrPercent
        });
      }
    }
    
    return symbols;
  }

  /**
   * Get suggested stop-loss distance based on ATR
   * @param {string} symbol 
   * @param {number} [atrMultiplier=2] - ATR multiplier for stop
   * @returns {Object|null}
   */
  getSuggestedStopDistance(symbol, atrMultiplier = 2) {
    const stats = this.volatilityStats.get(symbol);
    
    if (!stats) return null;
    
    return {
      atr: stats.currentATR,
      stopDistance: stats.currentATR * atrMultiplier,
      stopPercent: stats.atrPercent * atrMultiplier,
      regime: stats.regime
    };
  }

  /**
   * Clear data for a symbol
   */
  clear(symbol) {
    this.candleHistory.delete(symbol);
    this.atrHistory.delete(symbol);
    this.volatilityStats.delete(symbol);
  }

  /**
   * Clear all data
   */
  clearAll() {
    this.candleHistory.clear();
    this.atrHistory.clear();
    this.volatilityStats.clear();
  }
}

module.exports = VolatilityFilter;
