#!/usr/bin/env node
'use strict';

/**
 * System Verification Script
 * Tests all components of the trading bot
 */

const assert = require('assert');
const Decimal = require('decimal.js');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║     KuCoin Futures Trading Bot - System Verification v5.0     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

// ============================================
// Test DecimalMath
// ============================================
console.log('\n[1/8] Testing DecimalMath...');
const DecimalMath = require('../src/lib/DecimalMath');

test('DecimalMath: add', () => {
  assert.strictEqual(DecimalMath.add(0.1, 0.2), '0.3');
});

test('DecimalMath: multiply', () => {
  assert.strictEqual(DecimalMath.multiply(0.1, 0.2), '0.02');
});

test('DecimalMath: divide', () => {
  assert.strictEqual(DecimalMath.divide(1, 3, 8), '0.33333333');
});

test('DecimalMath: floor step', () => {
  const result = DecimalMath.floorToStep(1.2567, 0.01);
  assert.strictEqual(result, '1.25');
});

// ============================================
// Test All Indicators
// ============================================
console.log('\n[2/8] Testing Indicators...');
const indicators = require('../src/indicators');

test('Indicators: createIndicatorSuite', () => {
  const suite = indicators.createIndicatorSuite();
  assert(suite.rsi, 'RSI should exist');
  assert(suite.macd, 'MACD should exist');
  assert(suite.williamsR, 'WilliamsR should exist');
  assert(suite.ao, 'AO should exist');
  assert(suite.stochastic, 'Stochastic should exist');
  assert(suite.bollinger, 'Bollinger should exist');
  assert(suite.emaTrend, 'EMATrend should exist');
  assert(suite.kdj, 'KDJ should exist');
  assert(suite.obv, 'OBV should exist');
  assert(suite.dom, 'DOM should exist');
  assert(suite.atr, 'ATR should exist');
});

test('Indicators: RSI calculation', () => {
  const rsi = new indicators.RSIIndicator({ period: 14 });
  // Feed 20 candles
  for (let i = 0; i < 20; i++) {
    const close = 100 + (i % 3 === 0 ? 2 : -1);
    rsi.update({ close });
  }
  const result = rsi.getResult();
  assert(result.value !== null, 'RSI should have value');
  assert(result.value >= 0 && result.value <= 100, 'RSI should be 0-100');
});

test('Indicators: MACD calculation', () => {
  const macd = new indicators.MACDIndicator({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
  for (let i = 0; i < 35; i++) {
    const close = 100 + Math.sin(i / 5) * 5;
    macd.update({ close });
  }
  const result = macd.getResult();
  assert(result.value !== null, 'MACD should have value');
  assert(typeof result.value.macd === 'number', 'MACD line should exist');
});

test('Indicators: updateAll', () => {
  const suite = indicators.createIndicatorSuite();
  const candle = { open: 100, high: 105, low: 98, close: 103, volume: 1000 };
  for (let i = 0; i < 60; i++) {
    indicators.updateAll(suite, candle);
  }
  const results = indicators.updateAll(suite, candle);
  assert(results.rsi, 'RSI result should exist');
  assert(results.macd, 'MACD result should exist');
  assert(results.atr, 'ATR result should exist');
});

test('Indicators: signal detection', () => {
  const rsi = new indicators.RSIIndicator({ period: 14, oversold: 30 });
  // Push to oversold
  for (let i = 0; i < 20; i++) {
    rsi.update({ close: 100 - i * 2 });
  }
  const result = rsi.getResult();
  assert(result.value < 30, 'RSI should be oversold');
  assert(result.signals.length > 0, 'Should have signals in oversold zone');
});

// ============================================
// Test Microstructure Analyzers
// ============================================
console.log('\n[3/8] Testing Microstructure Analyzers...');
const microstructure = require('../src/microstructure');

test('Microstructure: createMicrostructureSuite', () => {
  const suite = microstructure.createMicrostructureSuite();
  assert(suite.buySellRatio, 'BuySellRatio should exist');
  assert(suite.priceRatio, 'PriceRatio should exist');
  assert(suite.fundingRate, 'FundingRate should exist');
});

test('BuySellRatioAnalyzer: trade processing', () => {
  const analyzer = new microstructure.BuySellRatioAnalyzer();
  analyzer.enableLiveMode();
  
  // Process some trades
  for (let i = 0; i < 60; i++) {
    analyzer.processTrade({
      side: i % 3 === 0 ? 'sell' : 'buy',
      size: 1,
      price: 50000
    });
  }
  
  const result = analyzer.getResult();
  assert(result.value.isLive === true, 'Should be in live mode');
  assert(result.value.ratio !== null, 'Should have ratio');
  assert(result.value.ratio >= 0 && result.value.ratio <= 1, 'Ratio should be 0-1');
});

test('PriceRatioAnalyzer: price updates', () => {
  const analyzer = new microstructure.PriceRatioAnalyzer();
  analyzer.enableLiveMode();
  
  analyzer.update({
    bid: 50000,
    ask: 50010,
    index: 50005,
    mark: 50008,
    last: 50006
  });
  
  const result = analyzer.getResult();
  assert(result.value.isLive === true, 'Should be in live mode');
  assert(result.value.spread !== null, 'Should have spread');
  assert(result.value.basis !== null, 'Should have basis');
});

test('FundingRateAnalyzer: funding updates', () => {
  const analyzer = new microstructure.FundingRateAnalyzer();
  analyzer.enableLiveMode();
  
  analyzer.update({
    currentRate: 0.0001,
    predictedRate: 0.00015,
    nextFundingTime: Date.now() + 3600000
  });
  
  const result = analyzer.getResult();
  assert(result.value.isLive === true, 'Should be in live mode');
  assert(result.value.currentRate !== null, 'Should have current rate');
});

test('Microstructure: live-only validation', () => {
  const analyzer = new microstructure.BuySellRatioAnalyzer();
  // Not in live mode
  analyzer.processTrade({ side: 'buy', size: 1, price: 50000 });
  const result = analyzer.getResult();
  assert(result.signals.length === 0, 'Should have no signals when not live');
});

// ============================================
// Test SignalGeneratorV2
// ============================================
console.log('\n[4/8] Testing SignalGeneratorV2...');
const SignalGeneratorV2 = require('../src/lib/SignalGeneratorV2');

test('SignalGeneratorV2: score range', () => {
  const sg = new SignalGeneratorV2({ enhancedMode: true, includeMicrostructure: true });
  
  // Max bullish scenario
  const bullish = sg.generate(
    {
      rsi: { value: 15, signals: [{ type: 'bullish_divergence', direction: 'bullish', strength: 'very_strong' }] },
      macd: { value: { macd: 0.5 }, signals: [{ type: 'bullish_signal_crossover', direction: 'bullish', strength: 'strong' }] }
    },
    {
      buySellRatio: { value: { ratio: 0.8, isLive: true }, signals: [{ type: 'bullish_flow_imbalance', direction: 'bullish', strength: 'strong' }] }
    }
  );
  
  assert(bullish.score >= -130 && bullish.score <= 130, `Score ${bullish.score} should be in range`);
  assert(bullish.score > 0, 'Should be positive for bullish signals');
});

test('SignalGeneratorV2: signal classification', () => {
  const sg = new SignalGeneratorV2({ enhancedMode: true });
  
  const signals = [
    { score: 95, expectedType: 'EXTREME_BUY' },
    { score: 75, expectedType: 'STRONG_BUY' },
    { score: 55, expectedType: 'BUY' },
    { score: 35, expectedType: 'BUY_WEAK' },
    { score: 0, expectedType: 'NEUTRAL' },
    { score: -35, expectedType: 'SELL_WEAK' },
    { score: -55, expectedType: 'SELL' },
    { score: -75, expectedType: 'STRONG_SELL' },
    { score: -95, expectedType: 'EXTREME_SELL' }
  ];
  
  for (const { score, expectedType } of signals) {
    const type = sg._classifySignal(score);
    assert(type === expectedType, `Score ${score} should be ${expectedType}, got ${type}`);
  }
});

test('SignalGeneratorV2: confidence calculation', () => {
  const sg = new SignalGeneratorV2({ enhancedMode: true });
  
  const result = sg.generate({
    rsi: { value: 25, signals: [{ direction: 'bullish', strength: 'strong' }] },
    macd: { value: { macd: 0.1 }, signals: [{ direction: 'bullish', strength: 'moderate' }] },
    williamsR: { value: -85, signals: [{ direction: 'bullish', strength: 'strong' }] }
  }, {});
  
  assert(result.confidence >= 0 && result.confidence <= 100, 'Confidence should be 0-100');
});

// ============================================
// Test PositionManager
// ============================================
console.log('\n[5/8] Testing PositionManager...');
const PositionManager = require('../src/lib/PositionManager');

test('PositionManager: instantiation', () => {
  const pm = new PositionManager({
    maxRiskPercent: 2,
    maxPositions: 3,
    defaultLeverage: 10
  });
  
  assert(pm.positions instanceof Map, 'Should have positions map');
  assert(pm.maxRiskPercent.toNumber() === 2, 'Should have risk percent');
  assert(pm.maxPositions === 3, 'Should have max positions');
});

test('PositionManager: position size calculation', () => {
  const pm = new PositionManager({ maxRiskPercent: 2, defaultLeverage: 10 });
  pm.balance = new Decimal(10000);  // Set balance directly for testing
  
  const contract = { multiplier: 0.001, lotSize: 1, maxOrderQty: 1000000 };
  const sizing = pm.calculatePositionSize(50000, 10, contract, 2);
  
  assert(typeof sizing.size === 'number', 'Size should be a number');
  assert(sizing.size >= 0, 'Size should be non-negative');
  assert(typeof sizing.notional === 'number', 'Notional should be a number');
  assert(typeof sizing.margin === 'number', 'Margin should be a number');
});

test('PositionManager: break-even calculation', () => {
  const pm = new PositionManager({ defaultLeverage: 10, useMaker: false });
  
  const be = pm.calculateBreakEvenROI(10, 0.1);
  assert(typeof be === 'number', 'Break-even should be a number');
  assert(be > 0, 'Break-even should be positive');
  // At 10x with 0.06% taker both ways: (0.06 + 0.06) * 10 = 1.2% + 0.1 buffer
  assert(be >= 1.2, `Break-even ${be} should be >= 1.2%`);
});

test('PositionManager: stop loss calculation', () => {
  const pm = new PositionManager({ defaultLeverage: 10 });
  
  // calculateStopLoss(entry, leverage, slROI, side)
  const slLong = pm.calculateStopLoss(50000, 10, 3, 'long');
  const slShort = pm.calculateStopLoss(50000, 10, 3, 'short');
  
  assert(slLong < 50000, 'Long SL should be below entry');
  assert(slShort > 50000, 'Short SL should be above entry');
  
  // At 10x, 3% ROI SL = 0.3% price move
  const expectedMove = 50000 * 0.003;
  assert(Math.abs(50000 - slLong - expectedMove) < 1, 'Long SL calculation error');
});

test('PositionManager: take profit calculation', () => {
  const pm = new PositionManager({ defaultLeverage: 10 });
  
  // calculateTakeProfit(entry, leverage, tpROI, side)
  const tpLong = pm.calculateTakeProfit(50000, 10, 6, 'long');
  const tpShort = pm.calculateTakeProfit(50000, 10, 6, 'short');
  
  assert(tpLong > 50000, 'Long TP should be above entry');
  assert(tpShort < 50000, 'Short TP should be below entry');
});

test('PositionManager: liquidation price', () => {
  const pm = new PositionManager({ defaultLeverage: 10 });
  
  // calculateLiquidationPrice(entry, leverage, maintMargin, side)
  const liqLong = pm.calculateLiquidationPrice(50000, 10, 0.005, 'long');
  const liqShort = pm.calculateLiquidationPrice(50000, 10, 0.005, 'short');
  
  assert(liqLong < 50000, 'Long liquidation should be below entry');
  assert(liqShort > 50000, 'Short liquidation should be above entry');
});

// ============================================
// Test BacktestEngine
// ============================================
console.log('\n[6/8] Testing BacktestEngine...');
const BacktestEngine = require('../src/backtest/BacktestEngine');

test('BacktestEngine: basic backtest', () => {
  const engine = new BacktestEngine({
    leverage: 5,
    riskPercent: 2,
    signalThreshold: 50,
    slROI: 3,
    tpROI: 6
  });
  
  // Generate test candles with trend
  const candles = [];
  for (let i = 0; i < 200; i++) {
    const trend = i < 100 ? 1 : -1;
    const base = 50000 + i * 10 * trend;
    candles.push({
      ts: Date.now() + i * 300000,
      open: base,
      high: base + 50,
      low: base - 50,
      close: base + 30 * trend,
      volume: 1000 + Math.random() * 500
    });
  }
  
  const results = engine.run(candles);
  
  assert(results !== undefined, 'Should return results');
  assert(results.summary !== undefined, 'Should have summary');
  assert(typeof results.summary.totalReturn === 'string' || typeof results.summary.totalReturn === 'number', 'Should have totalReturn');
  assert(Array.isArray(results.trades), 'Should have trades array');
});

test('BacktestEngine: no microstructure signals', () => {
  const engine = new BacktestEngine({});
  
  // Verify microstructure is disabled in signalGenerator
  assert(engine.signalGenerator.includeMicrostructure === false, 'Microstructure should be disabled in backtest');
});

// ============================================
// Test PaperTradingEngine
// ============================================
console.log('\n[7/8] Testing PaperTradingEngine...');
const PaperTradingEngine = require('../src/optimizer/PaperTradingEngine');

test('PaperTradingEngine: initialization', () => {
  const engine = new PaperTradingEngine({
    initialBalance: 10000,
    leverage: 5,
    riskPercent: 2,
    signalThreshold: 50
  });
  
  assert(engine.balance.equals(new Decimal(10000)), 'Initial balance should be set');
  assert(engine.positions.size === 0, 'Should start with no positions');
  assert(engine.running === false, 'Should start stopped');
});

test('PaperTradingEngine: includes microstructure', () => {
  const engine = new PaperTradingEngine({});
  
  // Check signalGenerator config
  assert(engine.signalGenerator.includeMicrostructure === true, 'Microstructure should be enabled in paper trading');
});

test('PaperTradingEngine: start/stop', () => {
  const engine = new PaperTradingEngine({});
  
  engine.start();
  assert(engine.running === true, 'Should be running after start');
  
  engine.stop();
  assert(engine.running === false, 'Should be stopped after stop');
});

// ============================================
// Test Integration
// ============================================
console.log('\n[8/8] Testing Integration...');

test('Full signal pipeline', () => {
  // Create all components
  const suite = indicators.createIndicatorSuite();
  indicators.enableLiveMode(suite);
  
  const micro = microstructure.createMicrostructureSuite();
  microstructure.enableLiveMode(micro);
  
  const sg = new SignalGeneratorV2({ enhancedMode: true, includeMicrostructure: true });
  
  // Feed data
  for (let i = 0; i < 60; i++) {
    const candle = {
      open: 50000 + i * 10,
      high: 50050 + i * 10,
      low: 49950 + i * 10,
      close: 50030 + i * 10,
      volume: 1000
    };
    
    indicators.updateAll(suite, candle);
    
    micro.buySellRatio.processTrade({ side: i % 3 === 0 ? 'sell' : 'buy', size: 1, price: candle.close });
    micro.priceRatio.update({ bid: candle.close - 5, ask: candle.close + 5, index: candle.close, mark: candle.close + 2, last: candle.close });
    micro.fundingRate.update({ currentRate: 0.0001, predictedRate: 0.00012, nextFundingTime: Date.now() + 3600000 });
  }
  
  // Get results
  const indicatorResults = {};
  for (const [name, ind] of Object.entries(suite)) {
    if (typeof ind.getResult === 'function') {
      indicatorResults[name] = ind.getResult();
    }
  }
  
  const microResults = {
    buySellRatio: micro.buySellRatio.getResult(),
    priceRatio: micro.priceRatio.getResult(),
    fundingRate: micro.fundingRate.getResult()
  };
  
  // Generate signal
  const signal = sg.generate(indicatorResults, microResults);
  
  assert(signal.score !== undefined, 'Signal should have score');
  assert(signal.type !== undefined, 'Signal should have type');
  assert(signal.confidence !== undefined, 'Signal should have confidence');
  assert(signal.hasMicrostructure === true, 'Should have microstructure');
});

// ============================================
// Summary
// ============================================
console.log('\n════════════════════════════════════════════════════════════════');
console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  console.log('\n📊 System Components:');
  console.log('   • 11 Technical Indicators (RSI, MACD, Williams%R, AO, Stochastic, Bollinger, EMA, KDJ, OBV, DOM, ATR)');
  console.log('   • 3 Microstructure Analyzers (Buy:Sell Ratio, Price Ratio, Funding Rate)');
  console.log('   • Signal Score Range: -130 to +130');
  console.log('   • Position Management with ROI-based SL/TP');
  console.log('   • Backtesting (deterministic, no microstructure)');
  console.log('   • Paper Trading (live simulation with microstructure)');
  console.log('\n🚀 Ready for deployment!');
  process.exit(0);
}
