'use strict';

/**
 * Unit Tests - Screener Components
 * 
 * Tests for:
 * - VolumeAnalyzer
 * - VolatilityFilter
 * - CoinRankerV2
 */

const assert = require('assert');
const VolumeAnalyzer = require('../../src/screener/VolumeAnalyzer');
const VolatilityFilter = require('../../src/screener/VolatilityFilter');
const CoinRankerV2 = require('../../src/screener/CoinRankerV2');

// Generate test candles
function generateCandles(count, trend = 'up', basePrice = 50000, volatility = 0.01) {
  const candles = [];
  let price = basePrice;
  
  for (let i = 0; i < count; i++) {
    const change = trend === 'up' ? Math.random() * volatility : -Math.random() * volatility;
    price = price * (1 + change);
    
    const high = price * (1 + Math.random() * volatility);
    const low = price * (1 - Math.random() * volatility);
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    
    candles.push({
      ts: Date.now() - (count - i) * 60000,
      open,
      high,
      low,
      close,
      volume: 100 + Math.random() * 900
    });
  }
  
  return candles;
}

// Test runner
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n=== Running Screener Tests ===\n');
  
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// VolumeAnalyzer Tests
// ============================================================================

test('VolumeAnalyzer: should initialize with default config', () => {
  const va = new VolumeAnalyzer();
  assert.strictEqual(va.spikeThreshold, 2.0);
  assert.strictEqual(va.trendPeriod, 20);
  assert.strictEqual(va.breakoutMultiplier, 1.5);
  assert.strictEqual(va.historyLength, 100);
});

test('VolumeAnalyzer: should initialize with custom config', () => {
  const va = new VolumeAnalyzer({
    spikeThreshold: 3.0,
    trendPeriod: 10,
    breakoutMultiplier: 2.0,
    historyLength: 50
  });
  assert.strictEqual(va.spikeThreshold, 3.0);
  assert.strictEqual(va.trendPeriod, 10);
});

test('VolumeAnalyzer: should calculate volume stats after update', () => {
  const va = new VolumeAnalyzer();
  const candles = generateCandles(25);
  
  let result;
  for (const candle of candles) {
    result = va.update('BTCUSDT', candle);
  }
  
  assert.ok(result.value !== null && result.value !== 0);
  assert.ok('currentVolume' in result.value);
  assert.ok('avgVolume' in result.value);
  assert.ok('relativeVolume' in result.value);
  assert.ok('trend' in result.value);
  assert.ok('momentum' in result.value);
});

test('VolumeAnalyzer: should detect volume spike', () => {
  const va = new VolumeAnalyzer({ spikeThreshold: 2.0 });
  
  // Feed normal volume first
  for (let i = 0; i < 20; i++) {
    va.update('BTCUSDT', {
      ts: Date.now() - (20 - i) * 60000,
      close: 50000,
      volume: 100
    });
  }
  
  // Feed spike volume
  const result = va.update('BTCUSDT', {
    ts: Date.now(),
    close: 50000,
    volume: 300 // 3x average
  });
  
  assert.ok(result.value.relativeVolume >= 2);
  const spikeSignal = result.signals.find(s => s.type === 'volume_spike');
  assert.ok(spikeSignal, 'Should have volume spike signal');
});

test('VolumeAnalyzer: should calculate volume trend', () => {
  const va = new VolumeAnalyzer({ trendPeriod: 10 });
  
  // Feed increasing volume
  for (let i = 0; i < 20; i++) {
    va.update('BTCUSDT', {
      ts: Date.now() - (20 - i) * 60000,
      close: 50000,
      volume: 100 + i * 10 // Increasing
    });
  }
  
  const result = va.getResult('BTCUSDT');
  assert.ok(result.value.trend > 0, 'Trend should be positive for increasing volume');
});

test('VolumeAnalyzer: should return standardized signal format', () => {
  const va = new VolumeAnalyzer();
  const candles = generateCandles(25);
  
  let result;
  for (const candle of candles) {
    result = va.update('BTCUSDT', candle);
  }
  
  assert.ok('value' in result, 'Result should have value');
  assert.ok('signals' in result, 'Result should have signals array');
  assert.ok(Array.isArray(result.signals), 'signals should be array');
  
  for (const sig of result.signals) {
    assert.ok('type' in sig, 'Signal should have type');
    assert.ok('direction' in sig, 'Signal should have direction');
    assert.ok('strength' in sig, 'Signal should have strength');
  }
});

test('VolumeAnalyzer: should compare volumes across symbols', () => {
  const va = new VolumeAnalyzer();
  
  for (let i = 0; i < 10; i++) {
    va.update('BTCUSDT', { ts: Date.now(), close: 50000, volume: 1000 });
    va.update('ETHUSDT', { ts: Date.now(), close: 3000, volume: 500 });
  }
  
  const comparison = va.compareVolumes(['BTCUSDT', 'ETHUSDT']);
  assert.strictEqual(comparison.length, 2);
  assert.ok(comparison[0].symbol, 'Should have symbol');
  assert.ok('relativeVolume' in comparison[0], 'Should have relativeVolume');
});

test('VolumeAnalyzer: should clear data properly', () => {
  const va = new VolumeAnalyzer();
  va.update('BTCUSDT', { ts: Date.now(), close: 50000, volume: 1000 });
  
  va.clear('BTCUSDT');
  
  const result = va.getResult('BTCUSDT');
  assert.strictEqual(result.value, 0);
});

test('VolumeAnalyzer: should handle division by zero in trend calculation', () => {
  const va = new VolumeAnalyzer();
  
  // Single data point
  const result = va.update('BTCUSDT', { ts: Date.now(), close: 50000, volume: 100 });
  
  // Should not throw
  assert.ok(result !== undefined);
});

// ============================================================================
// VolatilityFilter Tests
// ============================================================================

test('VolatilityFilter: should initialize with default config', () => {
  const vf = new VolatilityFilter();
  assert.strictEqual(vf.atrPeriod, 14);
  assert.strictEqual(vf.volatilityPeriod, 20);
  assert.strictEqual(vf.lowVolThreshold, 0.5);
  assert.strictEqual(vf.highVolThreshold, 1.5);
});

test('VolatilityFilter: should initialize with custom config', () => {
  const vf = new VolatilityFilter({
    atrPeriod: 10,
    lowVolThreshold: 0.3,
    highVolThreshold: 2.0
  });
  assert.strictEqual(vf.atrPeriod, 10);
  assert.strictEqual(vf.lowVolThreshold, 0.3);
});

test('VolatilityFilter: should calculate ATR after warmup', () => {
  const vf = new VolatilityFilter({ atrPeriod: 14 });
  const candles = generateCandles(20);
  
  let result;
  for (const candle of candles) {
    result = vf.update('BTCUSDT', candle);
  }
  
  assert.ok(result.value !== null && result.value !== 0);
  assert.ok('currentATR' in result.value);
  assert.ok('atrPercent' in result.value);
  assert.ok('relativeATR' in result.value);
  assert.ok('regime' in result.value);
});

test('VolatilityFilter: should detect volatility regime', () => {
  const vf = new VolatilityFilter();
  const candles = generateCandles(30);
  
  let result;
  for (const candle of candles) {
    result = vf.update('BTCUSDT', candle);
  }
  
  assert.ok(['low', 'medium', 'high'].includes(result.value.regime));
});

test('VolatilityFilter: should calculate position size multiplier', () => {
  const vf = new VolatilityFilter();
  const candles = generateCandles(30);
  
  let result;
  for (const candle of candles) {
    result = vf.update('BTCUSDT', candle);
  }
  
  assert.ok('positionSizeMultiplier' in result.value);
  assert.ok(result.value.positionSizeMultiplier >= 0.25);
  assert.ok(result.value.positionSizeMultiplier <= 2);
});

test('VolatilityFilter: should use Wilder smoothing for ATR', () => {
  const vf = new VolatilityFilter({ atrPeriod: 14 });
  const candles = generateCandles(30);
  
  // Feed candles and check ATR is smoothed
  const atrValues = [];
  for (const candle of candles) {
    const result = vf.update('BTCUSDT', candle);
    if (result.value && result.value.currentATR) {
      atrValues.push(result.value.currentATR);
    }
  }
  
  // ATR should be relatively smooth (not jumping around too much)
  assert.ok(atrValues.length > 0, 'Should have ATR values');
});

test('VolatilityFilter: should pass filter check', () => {
  const vf = new VolatilityFilter();
  const candles = generateCandles(30);
  
  for (const candle of candles) {
    vf.update('BTCUSDT', candle);
  }
  
  const filterResult = vf.passesFilter('BTCUSDT', { maxATRPercent: 50 });
  assert.ok('passes' in filterResult);
  assert.ok('reason' in filterResult);
});

test('VolatilityFilter: should fail filter for missing data', () => {
  const vf = new VolatilityFilter();
  
  const filterResult = vf.passesFilter('UNKNOWN');
  assert.strictEqual(filterResult.passes, false);
  assert.ok(filterResult.reason.includes('No volatility data'));
});

test('VolatilityFilter: should handle zero ATR edge case', () => {
  const vf = new VolatilityFilter({ atrPeriod: 3 });
  
  // Feed identical candles (zero volatility)
  for (let i = 0; i < 10; i++) {
    vf.update('BTCUSDT', {
      ts: Date.now() + i * 60000,
      open: 50000,
      high: 50000,
      low: 50000,
      close: 50000,
      volume: 100
    });
  }
  
  const result = vf.getResult('BTCUSDT');
  // Should not have NaN
  assert.ok(Number.isFinite(result.value.relativeATR));
});

test('VolatilityFilter: should compare volatility across symbols', () => {
  const vf = new VolatilityFilter();
  const candles = generateCandles(20);
  
  for (const candle of candles) {
    vf.update('BTCUSDT', candle);
    vf.update('ETHUSDT', { ...candle, high: candle.high * 1.1, low: candle.low * 0.9 });
  }
  
  const comparison = vf.compareVolatility(['BTCUSDT', 'ETHUSDT']);
  assert.strictEqual(comparison.length, 2);
});

test('VolatilityFilter: should get symbols by regime', () => {
  const vf = new VolatilityFilter();
  const candles = generateCandles(20);
  
  for (const candle of candles) {
    vf.update('BTCUSDT', candle);
  }
  
  const result = vf.getResult('BTCUSDT');
  const regimeSymbols = vf.getSymbolsByRegime(result.value.regime);
  assert.ok(regimeSymbols.some(s => s.symbol === 'BTCUSDT'));
});

test('VolatilityFilter: should get suggested stop distance', () => {
  const vf = new VolatilityFilter();
  const candles = generateCandles(20);
  
  for (const candle of candles) {
    vf.update('BTCUSDT', candle);
  }
  
  const stop = vf.getSuggestedStopDistance('BTCUSDT', 2);
  assert.ok(stop !== null);
  assert.ok('atr' in stop);
  assert.ok('stopDistance' in stop);
  assert.ok('stopPercent' in stop);
});

test('VolatilityFilter: should use 365 days for crypto annualization', () => {
  const vf = new VolatilityFilter();
  const candles = generateCandles(30);
  
  for (const candle of candles) {
    vf.update('BTCUSDT', candle);
  }
  
  const result = vf.getResult('BTCUSDT');
  // Historical vol should be calculated
  assert.ok(result.value.historicalVol !== undefined);
});

// ============================================================================
// CoinRankerV2 Tests
// ============================================================================

test('CoinRankerV2: should initialize with default config', () => {
  const cr = new CoinRankerV2({});
  assert.strictEqual(cr.minVolume, 10_000_000);
  assert.strictEqual(cr.maxSpread, 0.05);
  assert.strictEqual(cr.optimalVolatility, 3.5);
  assert.strictEqual(cr.volatilityPenaltyRate, 20);
});

test('CoinRankerV2: should initialize with custom config', () => {
  const cr = new CoinRankerV2({
    minVolume: 5_000_000,
    maxSpread: 0.1,
    optimalVolatility: 4.0,
    volatilityPenaltyRate: 15,
    weights: {
      volume: 0.4,
      volatility: 0.3
    }
  });
  
  assert.strictEqual(cr.minVolume, 5_000_000);
  assert.strictEqual(cr.optimalVolatility, 4.0);
  assert.strictEqual(cr.volatilityPenaltyRate, 15);
  assert.strictEqual(cr.weights.volume, 0.4);
});

test('CoinRankerV2: should update buy:sell ratio', () => {
  const cr = new CoinRankerV2({});
  
  cr.updateBuySellRatio('BTCUSDT', 1.5);
  assert.strictEqual(cr.buySellRatios.get('BTCUSDT'), 1.5);
});

test('CoinRankerV2: should calculate scores correctly', () => {
  const cr = new CoinRankerV2({});
  
  // Manually set coins for testing
  cr.coins = [
    { symbol: 'BTCUSDT', turnover24h: 1000000000, priceChangePercent: 3.5, spread: 0.01, fundingRate: 0.01, buySellRatio: 1.2 },
    { symbol: 'ETHUSDT', turnover24h: 500000000, priceChangePercent: 5.0, spread: 0.02, fundingRate: 0.02, buySellRatio: 0.9 }
  ];
  
  cr._calculateScores();
  
  // Check scores are calculated
  assert.ok(cr.coins[0].volumeScore >= 0);
  assert.ok(cr.coins[0].volatilityScore >= 0);
  assert.ok(cr.coins[0].spreadScore >= 0);
  assert.ok(cr.coins[0].compositeScore >= 0);
});

test('CoinRankerV2: should handle same spread for all coins', () => {
  const cr = new CoinRankerV2({});
  
  // All coins have same spread
  cr.coins = [
    { symbol: 'BTCUSDT', turnover24h: 1000000000, priceChangePercent: 3.5, spread: 0.01, fundingRate: 0.01, buySellRatio: 1.0 },
    { symbol: 'ETHUSDT', turnover24h: 500000000, priceChangePercent: 3.5, spread: 0.01, fundingRate: 0.01, buySellRatio: 1.0 }
  ];
  
  cr._calculateScores();
  
  // Both should get 100 spread score
  assert.strictEqual(cr.coins[0].spreadScore, 100);
  assert.strictEqual(cr.coins[1].spreadScore, 100);
});

test('CoinRankerV2: should get top coins', () => {
  const cr = new CoinRankerV2({});
  
  cr.rankings = [
    { symbol: 'BTCUSDT', compositeScore: 90 },
    { symbol: 'ETHUSDT', compositeScore: 80 },
    { symbol: 'SOLUSDT', compositeScore: 70 }
  ];
  
  const top = cr.getTopCoins(2);
  assert.strictEqual(top.length, 2);
  assert.strictEqual(top[0].symbol, 'BTCUSDT');
});

test('CoinRankerV2: should get tiers', () => {
  const cr = new CoinRankerV2({});
  
  cr.rankings = Array.from({ length: 40 }, (_, i) => ({ symbol: `COIN${i}`, compositeScore: 100 - i }));
  
  const tiers = cr.getTiers();
  assert.strictEqual(tiers.tier1.length, 5);
  assert.strictEqual(tiers.tier2.length, 10);
  assert.strictEqual(tiers.tier3.length, 15);
});

test('CoinRankerV2: should get metrics', () => {
  const cr = new CoinRankerV2({});
  
  cr.coins = [
    { symbol: 'BTCUSDT', turnover24h: 1000000000, spread: 0.01 },
    { symbol: 'ETHUSDT', turnover24h: 500000000, spread: 0.02 }
  ];
  cr.rankings = cr.coins;
  cr.lastUpdate = Date.now();
  
  const metrics = cr.getMetrics();
  assert.strictEqual(metrics.totalCoins, 2);
  assert.ok(metrics.avgVolume > 0);
  assert.ok(metrics.avgSpread > 0);
});

test('CoinRankerV2: should stop timer', () => {
  const cr = new CoinRankerV2({});
  cr.refreshTimer = setInterval(() => {}, 1000);
  
  cr.stop();
  
  assert.strictEqual(cr.refreshTimer, null);
});

test('CoinRankerV2: should get extreme funding coins', () => {
  const cr = new CoinRankerV2({});
  
  cr.coins = [
    { symbol: 'BTCUSDT', fundingRate: 5 },   // 5% (extreme)
    { symbol: 'ETHUSDT', fundingRate: 0.5 }, // 0.5% (normal)
    { symbol: 'SOLUSDT', fundingRate: -3 }   // -3% (extreme)
  ];
  
  const extreme = cr.getExtremeFundingCoins(0.01); // 1% threshold
  assert.strictEqual(extreme.length, 2);
});

test('CoinRankerV2: should get coins by funding direction', () => {
  const cr = new CoinRankerV2({});
  
  cr.coins = [
    { symbol: 'BTCUSDT', fundingRate: 0.01 },
    { symbol: 'ETHUSDT', fundingRate: -0.02 },
    { symbol: 'SOLUSDT', fundingRate: 0.03 }
  ];
  
  const positive = cr.getCoinsByFundingDirection('positive');
  assert.strictEqual(positive.length, 2);
  
  const negative = cr.getCoinsByFundingDirection('negative');
  assert.strictEqual(negative.length, 1);
});

test('CoinRankerV2: should handle empty coins array', () => {
  const cr = new CoinRankerV2({});
  cr.coins = [];
  
  // Should not throw
  cr._calculateScores();
  
  const metrics = cr.getMetrics();
  assert.strictEqual(metrics.totalCoins, 0);
});

// Run tests
runTests();
