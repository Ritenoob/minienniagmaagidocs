'use strict';

/**
 * Screener Configuration
 * 
 * Settings for the multi-symbol screening engine
 */

const screenerConfig = {
  // Symbols to screen (can be overridden at runtime)
  // Set to empty array [] or 'auto' to dynamically discover ALL perpetual futures
  // The CoinListManager will filter top coins by volume, spread, and liquidity
  symbols: [],  // Empty array = auto-discover all perpetual futures
  autoDiscovery: true,  // Enable automatic perpetual futures discovery
  
  // Timeframes
  primaryTimeframe: '5min',
  secondaryTimeframe: '15min',
  
  // Signal thresholds
  signalThreshold: 50,          // Minimum score to emit signal
  strongSignalThreshold: 70,    // Score for "strong" classification
  
  // Deduplication
  signalCooldownMs: 60000,      // 1 minute cooldown between same signals
  
  // Buffer sizes
  maxCandleBuffer: 1000,        // Max candles to keep per symbol/timeframe
  maxSignalHistory: 100,        // Max signals to keep in history
  
  // Indicator parameters
  indicatorParams: {
    rsi: {
      period: 14,
      oversold: 30,
      overbought: 70
    },
    macd: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    },
    williamsR: {
      period: 14,
      oversold: -80,
      overbought: -20
    },
    ao: {
      fastPeriod: 5,
      slowPeriod: 34
    },
    stochastic: {
      kPeriod: 14,
      dPeriod: 3,
      smooth: 3,
      oversold: 20,
      overbought: 80
    },
    bollinger: {
      period: 20,
      stdDev: 2
    },
    emaTrend: {
      shortPeriod: 9,
      mediumPeriod: 21,
      longPeriod: 50,
      trendPeriod: 200
    },
    kdj: {
      kPeriod: 9,
      dPeriod: 3,
      smooth: 3,
      jOversold: 20,
      jOverbought: 80
    },
    obv: {
      slopeWindow: 14,
      smoothingEma: 5
    },
    dom: {
      depthLevels: [5, 10, 25],
      imbalanceThresholdLong: 0.60,
      imbalanceThresholdShort: 0.40
    },
    atr: {
      period: 14
    }
  },
  
  // Microstructure parameters
  microstructureParams: {
    buySellRatio: {
      windowMs: 60000,
      shortWindowMs: 5000,
      longWindowMs: 300000,
      imbalanceThresholdStrong: 0.70,
      imbalanceThresholdExtreme: 0.80
    },
    priceRatio: {
      spreadThresholdWarn: 0.02,
      spreadThresholdCritical: 0.05,
      basisThresholdModerate: 0.05,
      basisThresholdExtreme: 0.15
    },
    fundingRate: {
      extremeThreshold: 0.01,
      highThreshold: 0.005,
      changeThreshold: 0.003
    }
  },
  
  // Timeframe alignment requirements
  alignment: {
    requireBothTimeframes: true,
    primaryWeight: 0.7,
    secondaryWeight: 0.3,
    maxAgeDifferenceMs: 300000  // 5 minutes max age difference
  },
  
  // Output channels
  outputs: {
    console: true,
    websocket: true,
    file: false,
    filePath: './signals.log'
  }
};

/**
 * Get config for specific symbol
 */
function getSymbolConfig(symbol, overrides = {}) {
  return {
    ...screenerConfig,
    symbols: [symbol],
    ...overrides
  };
}

/**
 * Merge environment overrides
 */
function mergeEnvConfig(config = screenerConfig) {
  const merged = { ...config };
  
  if (process.env.SYMBOLS) {
    merged.symbols = process.env.SYMBOLS.split(',');
  }
  
  if (process.env.PRIMARY_TF) {
    merged.primaryTimeframe = process.env.PRIMARY_TF;
  }
  
  if (process.env.SECONDARY_TF) {
    merged.secondaryTimeframe = process.env.SECONDARY_TF;
  }
  
  if (process.env.SIGNAL_THRESHOLD) {
    merged.signalThreshold = parseInt(process.env.SIGNAL_THRESHOLD);
  }
  
  // RSI overrides
  if (process.env.RSI_PERIOD) {
    merged.indicatorParams.rsi.period = parseInt(process.env.RSI_PERIOD);
  }
  if (process.env.RSI_OVERSOLD) {
    merged.indicatorParams.rsi.oversold = parseInt(process.env.RSI_OVERSOLD);
  }
  if (process.env.RSI_OVERBOUGHT) {
    merged.indicatorParams.rsi.overbought = parseInt(process.env.RSI_OVERBOUGHT);
  }
  
  // MACD overrides
  if (process.env.MACD_FAST) {
    merged.indicatorParams.macd.fastPeriod = parseInt(process.env.MACD_FAST);
  }
  if (process.env.MACD_SLOW) {
    merged.indicatorParams.macd.slowPeriod = parseInt(process.env.MACD_SLOW);
  }
  if (process.env.MACD_SIGNAL) {
    merged.indicatorParams.macd.signalPeriod = parseInt(process.env.MACD_SIGNAL);
  }
  
  return merged;
}

module.exports = {
  ...screenerConfig,
  getSymbolConfig,
  mergeEnvConfig
};
