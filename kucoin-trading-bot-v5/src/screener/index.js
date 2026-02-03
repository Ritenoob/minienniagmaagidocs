'use strict';

/**
 * Screener Module - Unified Exports
 * 
 * Exports all screener components:
 * - CoinListManager: Basic coin ranking by volume/spread
 * - CoinRankerV2: Advanced ranking with microstructure integration
 * - VolumeAnalyzer: Volume spike and trend analysis
 * - VolatilityFilter: ATR-based filtering and regime detection
 * - ScreenerEngine: Real-time multi-symbol signal screening
 * 
 * @module screener
 */

const CoinListManager = require('./CoinListManager');
const CoinRankerV2 = require('./CoinRankerV2');
const VolumeAnalyzer = require('./VolumeAnalyzer');
const VolatilityFilter = require('./VolatilityFilter');
const ScreenerEngine = require('./ScreenerEngine');

/**
 * Create a complete screener suite with all analyzers
 * @param {Object} config
 * @returns {Object} Screener suite
 */
function createScreenerSuite(config = {}) {
  return {
    coinRanker: new CoinRankerV2(config.coinRanker || {}),
    volumeAnalyzer: new VolumeAnalyzer(config.volumeAnalyzer || {}),
    volatilityFilter: new VolatilityFilter(config.volatilityFilter || {})
  };
}

/**
 * Initialize the screener suite (async)
 * @param {Object} suite - Screener suite from createScreenerSuite
 * @returns {Promise<void>}
 */
async function initializeScreenerSuite(suite) {
  if (suite.coinRanker && typeof suite.coinRanker.initialize === 'function') {
    await suite.coinRanker.initialize();
  }
}

/**
 * Update screener suite with new candle data
 * 
 * Note: coinRanker is NOT updated here because it operates on a timer-based
 * refresh cycle (hourly by default) to fetch contract data from the API,
 * rather than processing individual candles. For real-time buy:sell ratio
 * updates, use coinRanker.updateBuySellRatio(symbol, ratio) directly.
 * 
 * @param {Object} suite - Screener suite
 * @param {string} symbol - Trading symbol
 * @param {Object} candle - Candle data
 * @returns {Object} Combined results
 */
function updateScreenerSuite(suite, symbol, candle) {
  const results = {};
  
  if (suite.volumeAnalyzer) {
    results.volume = suite.volumeAnalyzer.update(symbol, candle);
  }
  
  if (suite.volatilityFilter) {
    results.volatility = suite.volatilityFilter.update(symbol, candle);
  }
  
  return results;
}

/**
 * Stop all screener suite components
 * @param {Object} suite - Screener suite
 */
function stopScreenerSuite(suite) {
  if (suite.coinRanker && typeof suite.coinRanker.stop === 'function') {
    suite.coinRanker.stop();
  }
}

module.exports = {
  // Classes
  CoinListManager,
  CoinRankerV2,
  VolumeAnalyzer,
  VolatilityFilter,
  ScreenerEngine,
  
  // Helper functions
  createScreenerSuite,
  initializeScreenerSuite,
  updateScreenerSuite,
  stopScreenerSuite
};
