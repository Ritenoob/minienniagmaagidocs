'use strict';

/**
 * Market Microstructure Analyzers
 * 
 * Live-only analysis modules for real-time market signals.
 * These cannot be backtested with historical OHLCV data.
 */

const BuySellRatioAnalyzer = require('./BuySellRatioAnalyzer');
const PriceRatioAnalyzer = require('./PriceRatioAnalyzer');
const FundingRateAnalyzer = require('./FundingRateAnalyzer');

const MICROSTRUCTURE_WEIGHTS = {
  buySellRatio: { max: 15, enabled: true, liveOnly: true },
  priceRatio: { max: 15, enabled: true, liveOnly: true },
  fundingRate: { max: 15, enabled: true, liveOnly: true }
};

/**
 * Create microstructure analyzer suite
 * @param {Object} configs
 * @returns {Object}
 */
function createMicrostructureSuite(configs = {}) {
  return {
    buySellRatio: new BuySellRatioAnalyzer(configs.buySellRatio || {}),
    priceRatio: new PriceRatioAnalyzer(configs.priceRatio || {}),
    fundingRate: new FundingRateAnalyzer(configs.fundingRate || {})
  };
}

/**
 * Enable live mode on all analyzers
 * @param {Object} suite
 */
function enableLiveMode(suite) {
  for (const analyzer of Object.values(suite)) {
    if (typeof analyzer.enableLiveMode === 'function') {
      analyzer.enableLiveMode();
    }
  }
}

/**
 * Disable live mode on all analyzers
 * @param {Object} suite
 */
function disableLiveMode(suite) {
  for (const analyzer of Object.values(suite)) {
    if (typeof analyzer.disableLiveMode === 'function') {
      analyzer.disableLiveMode();
    }
  }
}

/**
 * Reset all analyzers
 * @param {Object} suite
 */
function resetAll(suite) {
  for (const analyzer of Object.values(suite)) {
    if (typeof analyzer.reset === 'function') {
      analyzer.reset();
    }
  }
}

module.exports = {
  BuySellRatioAnalyzer,
  PriceRatioAnalyzer,
  FundingRateAnalyzer,
  MICROSTRUCTURE_WEIGHTS,
  createMicrostructureSuite,
  enableLiveMode,
  disableLiveMode,
  resetAll
};
