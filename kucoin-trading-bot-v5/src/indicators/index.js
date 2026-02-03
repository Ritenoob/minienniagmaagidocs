'use strict';

/**
 * Indicator Suite - Unified Exports
 * 
 * All 11 technical indicators with enhanced signal detection
 */

const RSIIndicator = require('./RSIIndicator');
const MACDIndicator = require('./MACDIndicator');
const WilliamsRIndicator = require('./WilliamsRIndicator');
const AwesomeOscillator = require('./AwesomeOscillator');
const StochasticIndicator = require('./StochasticIndicator');
const BollingerBands = require('./BollingerBands');
const EMATrend = require('./EMATrend');
const KDJIndicator = require('./KDJIndicator');
const OBVIndicator = require('./OBVIndicator');
const DOMAnalyzer = require('./DOMAnalyzer');
const ATRIndicator = require('./ATRIndicator');

/**
 * Default indicator configurations
 */
const DEFAULT_CONFIGS = {
  rsi: { period: 14, oversold: 30, overbought: 70 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  williamsR: { period: 14, oversold: -80, overbought: -20 },
  ao: { fastPeriod: 5, slowPeriod: 34 },
  stochastic: { kPeriod: 14, dPeriod: 3, smooth: 3, oversold: 20, overbought: 80 },
  bollinger: { period: 20, stdDev: 2 },
  emaTrend: { shortPeriod: 9, mediumPeriod: 21, longPeriod: 50, trendPeriod: 200 },
  kdj: { kPeriod: 9, dPeriod: 3, jOversold: 20, jOverbought: 80 },
  obv: { slopeWindow: 14, smoothingEma: 5 },
  dom: { depthLevels: [5, 10, 25], imbalanceThresholdLong: 0.60, imbalanceThresholdShort: 0.40 },
  atr: { period: 14 }
};

/**
 * Weight distribution for signal scoring
 */
const INDICATOR_WEIGHTS = {
  rsi: { max: 25, enabled: true },
  macd: { max: 20, enabled: true },
  williamsR: { max: 20, enabled: true },
  ao: { max: 15, enabled: true },
  emaTrend: { max: 20, enabled: true },
  stochastic: { max: 10, enabled: true },
  bollinger: { max: 10, enabled: true },
  kdj: { max: 15, enabled: true },
  obv: { max: 10, enabled: true },
  dom: { max: 15, enabled: true, liveOnly: true },
  atr: { max: 0, enabled: true, utility: true }  // ATR is utility, not signal
};

/**
 * Create indicator suite instance
 * @param {Object} configs - Per-indicator configs
 * @returns {Object} Indicator instances
 */
function createIndicatorSuite(configs = {}) {
  return {
    rsi: new RSIIndicator({ ...DEFAULT_CONFIGS.rsi, ...configs.rsi }),
    macd: new MACDIndicator({ ...DEFAULT_CONFIGS.macd, ...configs.macd }),
    williamsR: new WilliamsRIndicator({ ...DEFAULT_CONFIGS.williamsR, ...configs.williamsR }),
    ao: new AwesomeOscillator({ ...DEFAULT_CONFIGS.ao, ...configs.ao }),
    stochastic: new StochasticIndicator({ ...DEFAULT_CONFIGS.stochastic, ...configs.stochastic }),
    bollinger: new BollingerBands({ ...DEFAULT_CONFIGS.bollinger, ...configs.bollinger }),
    emaTrend: new EMATrend({ ...DEFAULT_CONFIGS.emaTrend, ...configs.emaTrend }),
    kdj: new KDJIndicator({ ...DEFAULT_CONFIGS.kdj, ...configs.kdj }),
    obv: new OBVIndicator({ ...DEFAULT_CONFIGS.obv, ...configs.obv }),
    dom: new DOMAnalyzer({ ...DEFAULT_CONFIGS.dom, ...configs.dom }),
    atr: new ATRIndicator({ ...DEFAULT_CONFIGS.atr, ...configs.atr })
  };
}

/**
 * Update all indicators with candle data
 * @param {Object} suite - Indicator suite
 * @param {Object} candle - OHLCV candle
 * @param {Object} [orderBook] - Order book for DOM
 * @returns {Object} All indicator results
 */
function updateAll(suite, candle, orderBook = null) {
  const results = {};
  
  // Update price-based indicators
  results.rsi = suite.rsi.update(candle);
  results.macd = suite.macd.update(candle);
  results.williamsR = suite.williamsR.update(candle);
  results.ao = suite.ao.update(candle);
  results.stochastic = suite.stochastic.update(candle);
  results.bollinger = suite.bollinger.update(candle);
  results.emaTrend = suite.emaTrend.update(candle);
  results.kdj = suite.kdj.update(candle);
  results.obv = suite.obv.update(candle);
  results.atr = suite.atr.update(candle);
  
  // Update DOM only if order book provided
  if (orderBook) {
    results.dom = suite.dom.update(orderBook);
  }
  
  return results;
}

/**
 * Reset all indicators
 * @param {Object} suite - Indicator suite
 */
function resetAll(suite) {
  for (const indicator of Object.values(suite)) {
    if (typeof indicator.reset === 'function') {
      indicator.reset();
    }
  }
}

/**
 * Enable live mode on DOM analyzer
 * @param {Object} suite - Indicator suite
 */
function enableLiveMode(suite) {
  if (suite.dom && typeof suite.dom.enableLiveMode === 'function') {
    suite.dom.enableLiveMode();
  }
}

/**
 * Disable live mode on DOM analyzer
 * @param {Object} suite - Indicator suite
 */
function disableLiveMode(suite) {
  if (suite.dom && typeof suite.dom.disableLiveMode === 'function') {
    suite.dom.disableLiveMode();
  }
}

module.exports = {
  // Individual classes
  RSIIndicator,
  MACDIndicator,
  WilliamsRIndicator,
  AwesomeOscillator,
  StochasticIndicator,
  BollingerBands,
  EMATrend,
  KDJIndicator,
  OBVIndicator,
  DOMAnalyzer,
  ATRIndicator,
  
  // Configuration
  DEFAULT_CONFIGS,
  INDICATOR_WEIGHTS,
  
  // Factory functions
  createIndicatorSuite,
  updateAll,
  resetAll,
  enableLiveMode,
  disableLiveMode
};
