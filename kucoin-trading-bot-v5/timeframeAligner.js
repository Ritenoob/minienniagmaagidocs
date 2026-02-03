'use strict';

/**
 * Timeframe Aligner
 * 
 * Validates and aligns signals across multiple timeframes
 * for higher-confidence entries.
 */

const { SCORE_CAPS, classifyScore } = require('./signal-weights');

class TimeframeAligner {
  constructor(config = {}) {
    this.primaryWeight = config.primaryWeight || 0.7;
    this.secondaryWeight = config.secondaryWeight || 0.3;
    this.requireBothTimeframes = config.requireBothTimeframes !== false;
    this.maxAgeDifferenceMs = config.maxAgeDifferenceMs || 300000;
    this.minConfirmationScore = config.minConfirmationScore || 20;
  }

  /**
   * Check if signals from two timeframes are aligned
   * 
   * @param {Object} primaryResult - Signal result from primary timeframe
   * @param {Object} secondaryResult - Signal result from secondary timeframe
   * @param {Object} config - Optional configuration overrides
   * @returns {Object|null} - Aligned signal or null if not aligned
   */
  checkAlignment(primaryResult, secondaryResult, config = {}) {
    const primaryWeight = config.primaryWeight || this.primaryWeight;
    const secondaryWeight = config.secondaryWeight || this.secondaryWeight;
    
    // Check if we have valid results
    if (!primaryResult || !secondaryResult) {
      if (this.requireBothTimeframes) {
        return null;
      }
      // Use only available result
      const result = primaryResult || secondaryResult;
      if (!result) return null;
      
      return this._createResult(result, result.score, 'single_timeframe');
    }

    const primaryScore = this._extractScore(primaryResult);
    const secondaryScore = this._extractScore(secondaryResult);
    
    // Check if both are valid
    if (primaryScore === null || secondaryScore === null) {
      return null;
    }

    // Check direction alignment
    const primaryDirection = this._getDirection(primaryScore);
    const secondaryDirection = this._getDirection(secondaryScore);
    
    // Both neutral - no signal
    if (primaryDirection === 'neutral' && secondaryDirection === 'neutral') {
      return null;
    }
    
    // Conflicting signals - no trade
    if (primaryDirection !== 'neutral' && secondaryDirection !== 'neutral' && 
        primaryDirection !== secondaryDirection) {
      return null;
    }
    
    // Calculate weighted score
    const weightedScore = (primaryScore * primaryWeight) + (secondaryScore * secondaryWeight);
    
    // Check minimum confirmation
    if (Math.abs(weightedScore) < this.minConfirmationScore) {
      return null;
    }
    
    // Create aligned result
    const direction = primaryDirection !== 'neutral' ? primaryDirection : secondaryDirection;
    
    return this._createResult(primaryResult, weightedScore, 'aligned', {
      primaryScore,
      secondaryScore,
      direction,
      alignment: this._calculateAlignmentQuality(primaryScore, secondaryScore)
    });
  }

  /**
   * Extract score from various result formats
   */
  _extractScore(result) {
    if (result === null || result === undefined) return null;
    if (typeof result === 'number') return result;
    if (typeof result.score === 'number') return result.score;
    return null;
  }

  /**
   * Get direction from score
   */
  _getDirection(score) {
    if (score >= 20) return 'bullish';
    if (score <= -20) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate alignment quality (0-100)
   */
  _calculateAlignmentQuality(primary, secondary) {
    const primaryDir = this._getDirection(primary);
    const secondaryDir = this._getDirection(secondary);
    
    // Perfect alignment - same direction
    if (primaryDir === secondaryDir && primaryDir !== 'neutral') {
      const avgStrength = (Math.abs(primary) + Math.abs(secondary)) / 2;
      return Math.min(100, avgStrength);
    }
    
    // One neutral, one directional
    if (primaryDir !== secondaryDir) {
      const stronger = Math.max(Math.abs(primary), Math.abs(secondary));
      return stronger * 0.6;
    }
    
    return 0;
  }

  /**
   * Create result object
   */
  _createResult(sourceResult, score, source, metadata = {}) {
    const classification = classifyScore(score);
    
    return {
      score: Math.round(score * 100) / 100,
      type: classification.label,
      direction: metadata.direction || this._getDirection(score),
      source,
      alignment: metadata.alignment || 100,
      indicators: sourceResult.breakdown?.indicators || sourceResult.indicators || {},
      microstructure: sourceResult.breakdown?.microstructure || sourceResult.microstructure || {},
      signals: sourceResult.signals || [],
      metadata: {
        primaryScore: metadata.primaryScore,
        secondaryScore: metadata.secondaryScore,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Validate timeframe order (secondary should be higher)
   */
  static validateTimeframes(primary, secondary) {
    const order = ['1min', '5min', '15min', '30min', '1hour', '4hour', '1day', '1week'];
    const primaryIdx = order.indexOf(primary);
    const secondaryIdx = order.indexOf(secondary);
    
    if (primaryIdx === -1 || secondaryIdx === -1) {
      return { valid: false, error: 'Unknown timeframe' };
    }
    
    if (secondaryIdx <= primaryIdx) {
      return { 
        valid: false, 
        error: 'Secondary timeframe must be higher than primary',
        suggestion: `Use ${order[primaryIdx + 1] || '15min'} as secondary`
      };
    }
    
    return { valid: true };
  }

  /**
   * Get recommended timeframe pair
   */
  static getRecommendedPair(style = 'scalping') {
    const pairs = {
      scalping: { primary: '1min', secondary: '5min' },
      intraday: { primary: '5min', secondary: '15min' },
      swing: { primary: '15min', secondary: '1hour' },
      position: { primary: '1hour', secondary: '4hour' }
    };
    
    return pairs[style] || pairs.intraday;
  }
}

// Singleton for convenience
const defaultAligner = new TimeframeAligner();

module.exports = {
  TimeframeAligner,
  checkAlignment: (p, s, c) => defaultAligner.checkAlignment(p, s, c),
  validateTimeframes: TimeframeAligner.validateTimeframes,
  getRecommendedPair: TimeframeAligner.getRecommendedPair
};
