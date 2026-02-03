'use strict';

/**
 * System Health Check
 * Verifies all components are working correctly
 */

require('dotenv').config();

const checks = [];
let passed = 0;
let failed = 0;

function check(name, fn) {
  checks.push({ name, fn });
}

async function runChecks() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  System Health Check                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  for (const { name, fn } of checks) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Module checks
check('Indicators module loads', () => {
  require('../src/indicators');
});

check('Microstructure module loads', () => {
  require('../src/microstructure');
});

check('SignalGeneratorV2 loads', () => {
  require('../src/lib/SignalGeneratorV2');
});

check('PositionManager loads', () => {
  require('../src/lib/PositionManager');
});

check('DecimalMath loads', () => {
  require('../src/lib/DecimalMath');
});

check('KuCoinClient loads', () => {
  require('../src/lib/KuCoinClient');
});

check('BacktestEngine loads', () => {
  require('../src/backtest/BacktestEngine');
});

check('PaperTradingEngine loads', () => {
  require('../src/optimizer/PaperTradingEngine');
});

check('CoinListManager loads', () => {
  require('../src/screener/CoinListManager');
});

check('ScreenerEngine loads', () => {
  require('../src/screener/ScreenerEngine');
});

// Functional checks
check('Indicator suite creates', () => {
  const { createIndicatorSuite } = require('../src/indicators');
  const suite = createIndicatorSuite();
  if (!suite.rsi || !suite.macd) throw new Error('Missing indicators');
});

check('Microstructure suite creates', () => {
  const { createMicrostructureSuite } = require('../src/microstructure');
  const suite = createMicrostructureSuite();
  if (!suite.buySellRatio || !suite.priceRatio) throw new Error('Missing analyzers');
});

check('Signal generation works', () => {
  const SignalGeneratorV2 = require('../src/lib/SignalGeneratorV2');
  const sg = new SignalGeneratorV2({ enhancedMode: true });
  const result = sg.generate({}, {});
  if (typeof result.score !== 'number') throw new Error('Invalid score');
});

check('DecimalMath calculations', () => {
  const { add, multiply, divide, floorToStep } = require('../src/lib/DecimalMath');
  if (add('1.1', '2.2') !== '3.3') throw new Error('add failed');
  if (multiply('2', '3') !== '6') throw new Error('multiply failed');
  if (divide('10', '4') !== '2.5') throw new Error('divide failed');
  if (floorToStep('10.567', '0.01') !== '10.56') throw new Error('floorToStep failed');
});

check('Position sizing works', () => {
  const PositionManager = require('../src/lib/PositionManager');
  const Decimal = require('decimal.js');
  const pm = new PositionManager({ maxRiskPercent: 2 });
  pm.balance = new Decimal(10000);
  const result = pm.calculatePositionSize(50000, 5, { multiplier: 0.001, lotSize: 1, maxOrderQty: 1000000 });
  if (typeof result.size !== 'number' || result.size <= 0) throw new Error('Invalid size');
});

check('Backtest engine runs', () => {
  const BacktestEngine = require('../src/backtest/BacktestEngine');
  const engine = new BacktestEngine({ leverage: 5, signalThreshold: 50 });
  const candles = [];
  for (let i = 0; i < 100; i++) {
    candles.push({
      ts: Date.now() - (100 - i) * 300000,
      open: 50000 + Math.random() * 1000,
      high: 51000 + Math.random() * 500,
      low: 49500 + Math.random() * 500,
      close: 50000 + Math.random() * 1000,
      volume: 1000000
    });
  }
  const result = engine.run(candles);
  if (!result.summary) throw new Error('No summary');
});

// Network checks (non-critical in restricted environments)
check('KuCoin API reachable', async () => {
  const axios = require('axios');
  try {
    const res = await axios.get('https://api-futures.kucoin.com/api/v1/timestamp', { timeout: 5000 });
    if (res.data.code !== '200000') throw new Error('API error');
  } catch (err) {
    if (err.response?.status === 403 || err.code === 'ENOTFOUND') {
      console.log('   (Network restricted - skipping)');
      return; // Don't fail in restricted environments
    }
    throw err;
  }
});

runChecks();
