'use strict';

/**
 * Volume Analyzer
 * 
 * Analyzes volume patterns for coin screening:
 * - 24h volume tracking
 * - Volume spike detection
 * - Volume trend analysis
 * - Relative volume comparison
 * - Volume breakout detection
 * 
 * @module VolumeAnalyzer
 */

class VolumeAnalyzer {
  /**
   * @param {Object} config
   * @param {number} [config.spikeThreshold=2.0] - Volume spike threshold (multiplier)
   * @param {number} [config.trendPeriod=20] - Bars for trend calculation
   * @param {number} [config.breakoutMultiplier=1.5] - Breakout volume multiplier
   * @param {number} [config.historyLength=100] - Max history bars to keep
   */
  constructor(config = {}) {
    this.spikeThreshold = config.spikeThreshold || 2.0;
    this.trendPeriod = config.trendPeriod || 20;
    this.breakoutMultiplier = config.breakoutMultiplier || 1.5;
    this.historyLength = config.historyLength || 100;
    
    // Per-symbol volume data
    this.volumeHistory = new Map();
    this.volumeStats = new Map();
    
    // 24h volume cache
    this.volume24h = new Map();
    this.turnover24h = new Map();
  }

  /**
   * Update volume data for a symbol from candle
   * @param {string} symbol
   * @param {Object} candle - { ts, open, high, low, close, volume }
   */
  update(symbol, candle) {
    const volume = parseFloat(candle.volume) || 0;
    const price = parseFloat(candle.close) || 0;
    const turnover = volume * price;
    
    // Initialize if needed
    if (!this.volumeHistory.has(symbol)) {
      this.volumeHistory.set(symbol, []);
    }
    
    const history = this.volumeHistory.get(symbol);
    
    // Add to history
    history.push({
      ts: candle.ts,
      volume,
      turnover,
      price
    });
    
    // Trim history
    if (history.length > this.historyLength) {
      history.shift();
    }
    
    // Update stats
    this._updateStats(symbol);
    
    return this.getResult(symbol);
  }

  /**
   * Update 24h volume from ticker
   * @param {string} symbol 
   * @param {Object} ticker - { vol24h, turnover24h }
   */
  updateFrom24hVolume(symbol, ticker) {
    this.volume24h.set(symbol, parseFloat(ticker.vol24h) || 0);
    this.turnover24h.set(symbol, parseFloat(ticker.turnover24h) || 0);
  }

  /**
   * Calculate volume statistics for a symbol
   */
  _updateStats(symbol) {
    const history = this.volumeHistory.get(symbol);
    if (!history || history.length === 0) return;
    
    const volumes = history.map(h => h.volume);
    const recentVolumes = volumes.slice(-this.trendPeriod);
    
    // Calculate averages
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const allTimeAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    
    // Standard deviation
    const squaredDiffs = recentVolumes.map(v => Math.pow(v - avgVolume, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const stdDev = Math.sqrt(variance);
    
    // Volume trend (slope of linear regression)
    const trend = this._calculateTrend(recentVolumes);
    
    // Current volume relative to average
    const currentVolume = volumes[volumes.length - 1];
    const relativeVolume = avgVolume > 0 ? currentVolume / avgVolume : 1;
    
    // Spike detection
    const isSpike = relativeVolume >= this.spikeThreshold;
    const isBreakout = relativeVolume >= this.breakoutMultiplier;
    
    // Volume momentum (recent vs older)
    const recentWindow = 5;
    const olderWindow = 20;

    // Recent average over the last up to 5 volumes
    const recentSlice = volumes.slice(-recentWindow);
    const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / Math.min(recentWindow, volumes.length);

    // Older average: window before the recent window (up to 20 bars back).
    // If there are not enough older bars, fall back to recentAvg so momentum = 1.
    let olderAvg;
    if (volumes.length > recentWindow) {
      const start = Math.max(0, volumes.length - olderWindow);
      const end = volumes.length - recentWindow;
      const olderSlice = volumes.slice(start, end);
      olderAvg = olderSlice.length > 0
        ? olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length
        : recentAvg;
    } else {
      olderAvg = recentAvg;
    }
    const momentum = olderAvg > 0 ? recentAvg / olderAvg : 1;
    
    this.volumeStats.set(symbol, {
      currentVolume,
      avgVolume,
      allTimeAvg,
      stdDev,
      trend,
      relativeVolume,
      isSpike,
      isBreakout,
      momentum,
      volume24h: this.volume24h.get(symbol) || 0,
      turnover24h: this.turnover24h.get(symbol) || 0,
      lastUpdate: Date.now()
    });
  }

  /**
   * Calculate linear trend of volume
   */
  _calculateTrend(volumes) {
    if (volumes.length < 2) return 0;
    
    const n = volumes.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += volumes[i];
      sumXY += i * volumes[i];
      sumX2 += i * i;
    }
    
    const denominator = n * sumX2 - sumX * sumX;
    
    // Safeguard against division by zero
    if (denominator === 0) return 0;
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    
    // Normalize to percentage of average
    const avg = sumY / n;
    return avg > 0 ? (slope / avg) * 100 : 0;
  }

  /**
   * Get volume analysis result for a symbol
   */
  getResult(symbol) {
    const stats = this.volumeStats.get(symbol);
    
    if (!stats) {
      return {
        value: 0,
        signals: []
      };
    }
    
    const signals = [];
    
    // Volume spike signal
    if (stats.isSpike) {
      signals.push({
        type: 'volume_spike',
        direction: 'neutral',
        strength: stats.relativeVolume >= 3 ? 'very_strong' : 'strong',
        message: `Volume spike detected (${stats.relativeVolume.toFixed(1)}x average)`,
        metadata: {
          relativeVolume: stats.relativeVolume,
          threshold: this.spikeThreshold
        }
      });
    }
    
    // Volume breakout signal
    if (stats.isBreakout && !stats.isSpike) {
      signals.push({
        type: 'volume_breakout',
        direction: 'neutral',
        strength: 'moderate',
        message: `Volume breakout (${stats.relativeVolume.toFixed(1)}x average)`,
        metadata: {
          relativeVolume: stats.relativeVolume
        }
      });
    }
    
    // Rising volume trend
    if (stats.trend > 5) {
      signals.push({
        type: 'rising_volume',
        direction: 'bullish',
        strength: stats.trend > 10 ? 'strong' : 'moderate',
        message: `Rising volume trend (+${stats.trend.toFixed(1)}% per bar)`,
        metadata: { trend: stats.trend }
      });
    }
    
    // Falling volume trend
    if (stats.trend < -5) {
      signals.push({
        type: 'falling_volume',
        direction: 'bearish',
        strength: stats.trend < -10 ? 'strong' : 'moderate',
        message: `Falling volume trend (${stats.trend.toFixed(1)}% per bar)`,
        metadata: { trend: stats.trend }
      });
    }
    
    // Volume momentum
    if (stats.momentum > 1.5) {
      signals.push({
        type: 'volume_momentum_bullish',
        direction: 'bullish',
        strength: 'moderate',
        message: `Volume momentum increasing (${stats.momentum.toFixed(2)}x)`,
        metadata: { momentum: stats.momentum }
      });
    } else if (stats.momentum < 0.67) {
      signals.push({
        type: 'volume_momentum_bearish',
        direction: 'bearish',
        strength: 'moderate',
        message: `Volume momentum decreasing (${stats.momentum.toFixed(2)}x)`,
        metadata: { momentum: stats.momentum }
      });
    }
    
    // Low volume warning
    if (stats.relativeVolume < 0.5) {
      signals.push({
        type: 'low_volume_warning',
        direction: 'neutral',
        strength: 'weak',
        message: `Low volume warning (${(stats.relativeVolume * 100).toFixed(0)}% of average)`,
        metadata: { relativeVolume: stats.relativeVolume }
      });
    }
    
    return {
      value: {
        currentVolume: stats.currentVolume,
        avgVolume: stats.avgVolume,
        relativeVolume: stats.relativeVolume,
        trend: stats.trend,
        momentum: stats.momentum,
        volume24h: stats.volume24h,
        turnover24h: stats.turnover24h
      },
      signals
    };
  }

  /**
   * Compare volume across multiple symbols
   * @param {string[]} symbols 
   * @returns {Array} Sorted by relative volume
   */
  compareVolumes(symbols) {
    const results = [];
    
    for (const symbol of symbols) {
      const stats = this.volumeStats.get(symbol);
      if (stats) {
        results.push({
          symbol,
          relativeVolume: stats.relativeVolume,
          volume24h: stats.volume24h,
          turnover24h: stats.turnover24h,
          trend: stats.trend,
          isSpike: stats.isSpike
        });
      }
    }
    
    return results.sort((a, b) => b.relativeVolume - a.relativeVolume);
  }

  /**
   * Get symbols with volume spikes
   */
  getSpikeSymbols() {
    const spikes = [];
    
    for (const [symbol, stats] of this.volumeStats) {
      if (stats.isSpike) {
        spikes.push({
          symbol,
          relativeVolume: stats.relativeVolume,
          volume24h: stats.volume24h
        });
      }
    }
    
    return spikes.sort((a, b) => b.relativeVolume - a.relativeVolume);
  }

  /**
   * Get volume ranking for all tracked symbols
   */
  getVolumeRanking() {
    const ranking = [];
    
    for (const [symbol, stats] of this.volumeStats) {
      ranking.push({
        symbol,
        turnover24h: stats.turnover24h,
        volume24h: stats.volume24h,
        relativeVolume: stats.relativeVolume,
        trend: stats.trend
      });
    }
    
    return ranking.sort((a, b) => b.turnover24h - a.turnover24h);
  }

  /**
   * Clear data for a symbol
   */
  clear(symbol) {
    this.volumeHistory.delete(symbol);
    this.volumeStats.delete(symbol);
    this.volume24h.delete(symbol);
    this.turnover24h.delete(symbol);
  }

  /**
   * Clear all data
   */
  clearAll() {
    this.volumeHistory.clear();
    this.volumeStats.clear();
    this.volume24h.clear();
    this.turnover24h.clear();
  }
}

module.exports = VolumeAnalyzer;
