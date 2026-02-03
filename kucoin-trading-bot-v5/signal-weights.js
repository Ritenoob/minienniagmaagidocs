'use strict';

/**
 * Signal Weights Configuration
 * 
 * Defines the scoring weights for all indicators and microstructure analyzers.
 * Total possible: 205 points (capped at 130 for signal generation)
 */

const INDICATOR_WEIGHTS = {
  // Momentum Oscillators (70 points)
  rsi: {
    maxWeight: 25,
    enabled: true,
    signalTypes: {
      crossover: 1.0,      // Crossing oversold/overbought levels
      divergence: 1.2,     // Price/RSI divergence (highest priority)
      momentum: 0.7,       // Slope-based momentum
      zone: 0.5            // Being in oversold/overbought zone
    }
  },
  
  williamsR: {
    maxWeight: 20,
    enabled: true,
    signalTypes: {
      crossover: 1.0,
      failureSwing: 0.8,
      divergence: 1.2,
      zone: 0.5
    }
  },
  
  stochastic: {
    maxWeight: 10,
    enabled: true,
    signalTypes: {
      kdCross: 1.0,
      zone: 0.6,
      divergence: 1.2
    }
  },
  
  kdj: {
    maxWeight: 15,
    enabled: true,
    signalTypes: {
      jLine: 1.0,          // J-line extreme readings
      kdCross: 0.8,
      divergence: 1.2
    }
  },
  
  // Trend Indicators (40 points)
  macd: {
    maxWeight: 20,
    enabled: true,
    signalTypes: {
      signalCross: 1.0,    // MACD crossing signal line
      zeroCross: 1.0,      // MACD crossing zero
      histogram: 0.7,      // Histogram analysis
      divergence: 1.2
    }
  },
  
  emaTrend: {
    maxWeight: 20,
    enabled: true,
    signalTypes: {
      emaCross: 1.0,       // Short EMA crossing long EMA
      goldenCross: 1.2,    // 50 EMA crossing 200 EMA
      deathCross: 1.2,
      trendDirection: 0.6  // Price above/below trend EMA
    }
  },
  
  // Pattern Recognition (25 points)
  ao: {
    maxWeight: 15,
    enabled: true,
    signalTypes: {
      zeroCross: 1.0,
      saucer: 0.8,
      twinPeaks: 1.0,
      divergence: 1.2
    }
  },
  
  bollinger: {
    maxWeight: 10,
    enabled: true,
    signalTypes: {
      bandTouch: 0.6,
      squeeze: 0.8,
      breakout: 1.0
    }
  },
  
  // Volume Analysis (25 points)
  obv: {
    maxWeight: 10,
    enabled: true,
    signalTypes: {
      slope: 0.7,
      breakout: 1.0,
      divergence: 1.2
    }
  },
  
  dom: {
    maxWeight: 15,
    enabled: true,
    liveOnly: true,        // Only active in live/paper mode
    signalTypes: {
      imbalance: 1.0,
      wall: 0.8,
      microprice: 0.5
    }
  }
};

const MICROSTRUCTURE_WEIGHTS = {
  buySellRatio: {
    maxWeight: 15,
    enabled: true,
    liveOnly: true,
    signalTypes: {
      flowImbalance: 1.0,
      absorption: 0.8,
      exhaustion: 1.0,
      deltaMomentum: 0.6
    }
  },
  
  priceRatio: {
    maxWeight: 15,
    enabled: true,
    liveOnly: true,
    signalTypes: {
      basis: 0.8,          // Futures premium/discount
      spread: 0.6,         // Bid/ask spread warnings
      convergence: 0.7,
      bidAskImbalance: 0.4
    }
  },
  
  fundingRate: {
    maxWeight: 15,
    enabled: true,
    liveOnly: true,
    signalTypes: {
      extremeRate: 1.0,
      rateChange: 0.7,
      predictedRate: 0.6,
      fundingTiming: 0.8
    }
  }
};

// Strength multipliers for signal quality
const STRENGTH_MULTIPLIERS = {
  very_strong: 1.2,      // Divergence, golden/death cross
  strong: 1.0,           // Standard crossovers, breakouts
  moderate: 0.7,         // Zone signals, momentum
  weak: 0.5,             // Level signals
  extreme: 1.1           // Extreme overbought/oversold
};

// Score caps
const SCORE_CAPS = {
  indicatorMax: 110,      // Maximum from indicators
  microstructureMax: 20,  // Maximum from microstructure (reduced to prevent over-reliance)
  totalMax: 130           // Maximum total score
};

// Signal classifications
const SIGNAL_CLASSIFICATIONS = {
  EXTREME_BUY: { min: 90, label: 'EXTREME_BUY', description: 'Maximum confidence long' },
  STRONG_BUY: { min: 70, label: 'STRONG_BUY', description: 'High confidence long' },
  BUY: { min: 50, label: 'BUY', description: 'Standard long signal' },
  BUY_WEAK: { min: 30, label: 'BUY_WEAK', description: 'Low confidence long' },
  NEUTRAL: { min: -30, max: 30, label: 'NEUTRAL', description: 'No action' },
  SELL_WEAK: { max: -30, label: 'SELL_WEAK', description: 'Low confidence short' },
  SELL: { max: -50, label: 'SELL', description: 'Standard short signal' },
  STRONG_SELL: { max: -70, label: 'STRONG_SELL', description: 'High confidence short' },
  EXTREME_SELL: { max: -90, label: 'EXTREME_SELL', description: 'Maximum confidence short' }
};

/**
 * Calculate total possible weight
 */
function getTotalPossibleWeight() {
  let total = 0;
  
  for (const ind of Object.values(INDICATOR_WEIGHTS)) {
    if (ind.enabled) total += ind.maxWeight;
  }
  
  for (const micro of Object.values(MICROSTRUCTURE_WEIGHTS)) {
    if (micro.enabled) total += micro.maxWeight;
  }
  
  return total;
}

/**
 * Get enabled indicators
 */
function getEnabledIndicators() {
  return Object.entries(INDICATOR_WEIGHTS)
    .filter(([, config]) => config.enabled)
    .map(([name]) => name);
}

/**
 * Get live-only components
 */
function getLiveOnlyComponents() {
  const liveOnly = [];
  
  for (const [name, config] of Object.entries(INDICATOR_WEIGHTS)) {
    if (config.liveOnly) liveOnly.push(name);
  }
  
  for (const [name, config] of Object.entries(MICROSTRUCTURE_WEIGHTS)) {
    if (config.liveOnly) liveOnly.push(name);
  }
  
  return liveOnly;
}

/**
 * Classify score into signal type
 */
function classifyScore(score) {
  if (score >= 90) return SIGNAL_CLASSIFICATIONS.EXTREME_BUY;
  if (score >= 70) return SIGNAL_CLASSIFICATIONS.STRONG_BUY;
  if (score >= 50) return SIGNAL_CLASSIFICATIONS.BUY;
  if (score >= 30) return SIGNAL_CLASSIFICATIONS.BUY_WEAK;
  if (score <= -90) return SIGNAL_CLASSIFICATIONS.EXTREME_SELL;
  if (score <= -70) return SIGNAL_CLASSIFICATIONS.STRONG_SELL;
  if (score <= -50) return SIGNAL_CLASSIFICATIONS.SELL;
  if (score <= -30) return SIGNAL_CLASSIFICATIONS.SELL_WEAK;
  return SIGNAL_CLASSIFICATIONS.NEUTRAL;
}

module.exports = {
  INDICATOR_WEIGHTS,
  MICROSTRUCTURE_WEIGHTS,
  STRENGTH_MULTIPLIERS,
  SCORE_CAPS,
  SIGNAL_CLASSIFICATIONS,
  getTotalPossibleWeight,
  getEnabledIndicators,
  getLiveOnlyComponents,
  classifyScore
};
