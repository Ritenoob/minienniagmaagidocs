'use strict';

/**
 * Signal Generator V2
 * 
 * Integrates all indicators + microstructure into unified scoring.
 * 
 * Score Range: -130 to +130
 * - Indicator contribution: up to ±110
 * - Microstructure contribution: up to ±20
 * 
 * @module SignalGeneratorV2
 */

const Decimal = require('decimal.js');

const STRENGTH_MULTIPLIERS = {
  'very_strong': 1.2,
  'strong': 1.0,
  'moderate': 0.7,
  'weak': 0.5,
  'extreme': 1.1
};

const SIGNAL_CLASSIFICATIONS = {
  EXTREME_BUY: 90,
  STRONG_BUY: 70,
  BUY: 50,
  BUY_WEAK: 30,
  NEUTRAL: 0,
  SELL_WEAK: -30,
  SELL: -50,
  STRONG_SELL: -70,
  EXTREME_SELL: -90
};

class SignalGeneratorV2 {
  /**
   * @param {Object} config
   * @param {boolean} [config.enhancedMode=true] - Use enhanced signals
   * @param {boolean} [config.includeMicrostructure=true] - Include microstructure
   */
  constructor(config = {}) {
    this.config = config;
    this.enhancedMode = config.enhancedMode !== false;
    this.includeMicrostructure = config.includeMicrostructure !== false;
    
    // Indicator weights (total: 160)
    this.indicatorWeights = {
      rsi: { max: 25, enabled: true },
      macd: { max: 20, enabled: true },
      williamsR: { max: 20, enabled: true },
      ao: { max: 15, enabled: true },
      emaTrend: { max: 20, enabled: true },
      stochastic: { max: 10, enabled: true },
      bollinger: { max: 10, enabled: true },
      kdj: { max: 15, enabled: true },
      obv: { max: 10, enabled: true },
      dom: { max: 15, enabled: true, liveOnly: true }
    };
    
    // Microstructure weights (total: 45, capped at 20)
    this.microstructureWeights = {
      buySellRatio: { max: 15, enabled: true },
      priceRatio: { max: 15, enabled: true },
      fundingRate: { max: 15, enabled: true }
    };
    
    // Score caps
    this.indicatorScoreCap = 110;
    this.microstructureScoreCap = 20;
    this.totalScoreCap = 130;
  }

  /**
   * Generate comprehensive signal
   * @param {Object} indicators - Indicator results
   * @param {Object} microstructure - Microstructure results
   * @returns {Object} Signal result
   */
  generate(indicators = {}, microstructure = {}) {
    const breakdown = { indicators: {}, microstructure: {} };
    let indicatorScore = 0;
    let microstructureScore = 0;
    const allSignals = [];
    
    // Process indicators
    for (const [name, config] of Object.entries(this.indicatorWeights)) {
      if (!config.enabled) continue;
      
      const data = indicators[name];
      if (!data) continue;
      
      // Skip live-only indicators in non-live mode
      if (config.liveOnly && data.value && !data.value.isLive) continue;
      
      const result = this._processIndicator(name, data, config.max);
      breakdown.indicators[name] = result;
      indicatorScore += result.contribution;
      
      if (result.signals) {
        allSignals.push(...result.signals.map(s => ({ ...s, source: name })));
      }
    }
    
    // Cap indicator score
    indicatorScore = Math.max(-this.indicatorScoreCap, Math.min(this.indicatorScoreCap, indicatorScore));
    
    // Process microstructure
    if (this.includeMicrostructure) {
      for (const [name, config] of Object.entries(this.microstructureWeights)) {
        if (!config.enabled) continue;
        
        const data = microstructure[name];
        if (!data || !data.value?.isLive) continue;
        
        const result = this._processMicrostructure(name, data, config.max);
        breakdown.microstructure[name] = result;
        microstructureScore += result.contribution;
        
        if (result.signals) {
          allSignals.push(...result.signals.map(s => ({ ...s, source: name })));
        }
      }
    }
    
    // Cap microstructure score
    microstructureScore = Math.max(-this.microstructureScoreCap, Math.min(this.microstructureScoreCap, microstructureScore));
    
    // Total
    const totalScore = Math.max(-this.totalScoreCap, Math.min(this.totalScoreCap, indicatorScore + microstructureScore));
    const confidence = this._calculateConfidence(breakdown, allSignals);
    const signalType = this._classifySignal(totalScore);
    
    return {
      score: totalScore,
      indicatorScore,
      microstructureScore,
      type: signalType,
      confidence,
      breakdown,
      signals: allSignals,
      hasMicrostructure: microstructureScore !== 0,
      timestamp: Date.now()
    };
  }

  _processIndicator(name, data, maxPoints) {
    const hasSignals = data && typeof data === 'object' && Array.isArray(data.signals);
    
    if (hasSignals && this.enhancedMode && data.signals.length > 0) {
      return this._processEnhancedSignals(name, data, maxPoints);
    }
    
    return this._processLegacySignal(name, data, maxPoints);
  }

  _processEnhancedSignals(name, data, maxPoints) {
    let contribution = 0;
    const processedSignals = [];
    
    for (const signal of data.signals) {
      const multiplier = STRENGTH_MULTIPLIERS[signal.strength] || 0.5;
      const basePoints = maxPoints * 0.35;
      let signalPoints = basePoints * multiplier;
      
      if (signal.direction === 'bullish') {
        contribution += signalPoints;
      } else if (signal.direction === 'bearish') {
        contribution -= signalPoints;
      }
      
      processedSignals.push({
        ...signal,
        points: signal.direction === 'bearish' ? -signalPoints : signalPoints
      });
    }
    
    contribution = Math.max(-maxPoints, Math.min(maxPoints, contribution));
    
    return {
      value: data.value,
      contribution,
      signals: processedSignals,
      enhanced: true
    };
  }

  _processLegacySignal(name, data, maxPoints) {
    const value = typeof data === 'object' ? (data.value ?? data) : data;
    let contribution = 0;
    
    switch (name) {
      case 'rsi':
        if (value < 30) contribution = maxPoints * 0.8;
        else if (value < 40) contribution = maxPoints * 0.4;
        else if (value > 70) contribution = -maxPoints * 0.8;
        else if (value > 60) contribution = -maxPoints * 0.4;
        break;
        
      case 'williamsR':
        if (value < -80) contribution = maxPoints * 0.7;
        else if (value > -20) contribution = -maxPoints * 0.7;
        break;
        
      case 'macd':
        const histogram = typeof value === 'object' ? value.histogram : value;
        if (histogram > 0) contribution = maxPoints * 0.5;
        else if (histogram < 0) contribution = -maxPoints * 0.5;
        break;
        
      case 'ao':
        if (value > 0) contribution = maxPoints * 0.5;
        else if (value < 0) contribution = -maxPoints * 0.5;
        break;
        
      case 'kdj':
        const j = typeof value === 'object' ? value.j : value;
        if (j < 20) contribution = maxPoints * 0.7;
        else if (j > 80) contribution = -maxPoints * 0.7;
        break;
    }
    
    return { value, contribution, signals: [], enhanced: false };
  }

  _processMicrostructure(name, data, maxPoints) {
    if (!data || !data.signals || data.signals.length === 0) {
      return { value: data?.value, contribution: 0, signals: [], live: data?.value?.isLive };
    }
    
    let contribution = 0;
    const processedSignals = [];
    
    for (const signal of data.signals) {
      if (signal.direction === 'neutral') continue;
      
      // Skip scoring for AVOID_ENTRY signals but keep them
      if (signal.metadata?.warning === 'AVOID_ENTRY') {
        processedSignals.push({ ...signal, points: 0, warning: 'AVOID_ENTRY' });
        continue;
      }
      
      const multiplier = STRENGTH_MULTIPLIERS[signal.strength] || 0.5;
      const basePoints = maxPoints * 0.4;
      let signalPoints = basePoints * multiplier;
      
      if (signal.direction === 'bullish') {
        contribution += signalPoints;
      } else if (signal.direction === 'bearish') {
        contribution -= signalPoints;
      }
      
      processedSignals.push({
        ...signal,
        points: signal.direction === 'bearish' ? -signalPoints : signalPoints
      });
    }
    
    contribution = Math.max(-maxPoints, Math.min(maxPoints, contribution));
    
    return {
      value: data.value,
      contribution,
      signals: processedSignals,
      live: data.value?.isLive
    };
  }

  _calculateConfidence(breakdown, signals) {
    let bullish = 0;
    let bearish = 0;
    let totalStrength = 0;
    
    for (const signal of signals) {
      const mult = STRENGTH_MULTIPLIERS[signal.strength] || 0.5;
      if (signal.direction === 'bullish') {
        bullish++;
        totalStrength += mult;
      } else if (signal.direction === 'bearish') {
        bearish++;
        totalStrength += mult;
      }
    }
    
    const total = bullish + bearish;
    if (total === 0) return 0;
    
    const agreement = Math.abs(bullish - bearish) / total;
    const avgStrength = totalStrength / total;
    
    return Math.round(agreement * avgStrength * 100);
  }

  _classifySignal(score) {
    if (score >= SIGNAL_CLASSIFICATIONS.EXTREME_BUY) return 'EXTREME_BUY';
    if (score >= SIGNAL_CLASSIFICATIONS.STRONG_BUY) return 'STRONG_BUY';
    if (score >= SIGNAL_CLASSIFICATIONS.BUY) return 'BUY';
    if (score >= SIGNAL_CLASSIFICATIONS.BUY_WEAK) return 'BUY_WEAK';
    if (score <= SIGNAL_CLASSIFICATIONS.EXTREME_SELL) return 'EXTREME_SELL';
    if (score <= SIGNAL_CLASSIFICATIONS.STRONG_SELL) return 'STRONG_SELL';
    if (score <= SIGNAL_CLASSIFICATIONS.SELL) return 'SELL';
    if (score <= SIGNAL_CLASSIFICATIONS.SELL_WEAK) return 'SELL_WEAK';
    return 'NEUTRAL';
  }

  hasEntryWarning(result) {
    return result.signals.some(s => s.warning === 'AVOID_ENTRY');
  }

  getSummary(result) {
    return {
      score: result.score,
      type: result.type,
      confidence: result.confidence,
      indicatorScore: result.indicatorScore,
      microstructureScore: result.microstructureScore,
      signalCount: result.signals.length,
      hasMicrostructure: result.hasMicrostructure,
      entryWarning: this.hasEntryWarning(result)
    };
  }
}

module.exports = SignalGeneratorV2;
module.exports.STRENGTH_MULTIPLIERS = STRENGTH_MULTIPLIERS;
module.exports.SIGNAL_CLASSIFICATIONS = SIGNAL_CLASSIFICATIONS;
