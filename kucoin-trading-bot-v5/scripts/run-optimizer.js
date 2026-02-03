'use strict';

/**
 * Strategy Optimizer Runner
 * Tests multiple parameter combinations to find optimal settings
 */

require('dotenv').config();
const BacktestEngine = require('../src/backtest/BacktestEngine');
const KuCoinClient = require('../src/lib/KuCoinClient');

const CONFIG = {
  symbol: process.argv[2] || 'XBTUSDTM',
  granularity: process.argv[3] || '5',
  days: parseInt(process.argv[4] || '30')
};

// Parameter grid
const PARAM_GRID = {
  leverage: [3, 5, 10],
  signalThreshold: [40, 50, 60],
  slROI: [2, 3, 5],
  tpROI: [4, 6, 9]
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Strategy Optimizer                                        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Symbol: ${CONFIG.symbol.padEnd(48)}║`);
  console.log(`║  Period: ${CONFIG.days} days${''.padEnd(47)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const client = new KuCoinClient({});

  // Fetch data once
  const to = Date.now();
  const from = to - (CONFIG.days * 24 * 60 * 60 * 1000);

  console.log('📥 Fetching historical data...');
  const rawCandles = await client.getKlines(CONFIG.symbol, CONFIG.granularity, from, to);

  if (!rawCandles || rawCandles.length === 0) {
    console.error('❌ No data returned');
    process.exit(1);
  }

  const candles = rawCandles.map(c => ({
    ts: c[0],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5])
  }));

  console.log(`✅ Loaded ${candles.length} candles\n`);

  // Generate combinations
  const combinations = [];
  for (const leverage of PARAM_GRID.leverage) {
    for (const threshold of PARAM_GRID.signalThreshold) {
      for (const sl of PARAM_GRID.slROI) {
        for (const tp of PARAM_GRID.tpROI) {
          if (tp > sl) { // TP must be > SL
            combinations.push({ leverage, signalThreshold: threshold, slROI: sl, tpROI: tp });
          }
        }
      }
    }
  }

  console.log(`🔬 Testing ${combinations.length} parameter combinations...\n`);

  const results = [];

  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    
    const engine = new BacktestEngine({
      ...params,
      riskPercent: 2,
      initialBalance: 10000
    });

    const result = engine.run(candles);
    
    // Calculate composite score
    const sharpe = parseFloat(result.summary.sharpeRatio) || 0;
    const pf = parseFloat(result.summary.profitFactor) || 0;
    const dd = parseFloat(result.summary.maxDrawdown) || 100;
    const score = sharpe * pf * (1 - dd / 100);

    results.push({
      params,
      trades: result.summary.totalTrades,
      winRate: result.summary.winRate,
      return: result.summary.totalReturn,
      sharpe: result.summary.sharpeRatio,
      maxDD: result.summary.maxDrawdown,
      pf: result.summary.profitFactor,
      score
    });

    // Progress
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r   Progress: ${i + 1}/${combinations.length}`);
    }
  }

  console.log('\n');

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  // Display top 10
  console.log('════════════════════════════════════════════════════════════');
  console.log('                    TOP 10 CONFIGURATIONS                    ');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('Rank  Lev  Thresh  SL   TP   Trades  WinRate  Return   Sharpe  MaxDD');
  console.log('────────────────────────────────────────────────────────────────────');

  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    const p = r.params;
    console.log(
      `${(i + 1).toString().padStart(2)}.   ` +
      `${p.leverage.toString().padStart(2)}x  ` +
      `${p.signalThreshold.toString().padStart(4)}    ` +
      `${p.slROI.toString().padStart(2)}%  ` +
      `${p.tpROI.toString().padStart(2)}%  ` +
      `${r.trades.toString().padStart(5)}   ` +
      `${r.winRate.padStart(6)}%  ` +
      `${r.return.padStart(7)}%  ` +
      `${r.sharpe.padStart(6)}  ` +
      `${r.maxDD.padStart(5)}%`
    );
  }

  console.log('\n════════════════════════════════════════════════════════════');
  
  if (results.length > 0) {
    console.log('\n🏆 RECOMMENDED CONFIGURATION:');
    const best = results[0].params;
    console.log(`   LEVERAGE=${best.leverage}`);
    console.log(`   SIGNAL_THRESHOLD=${best.signalThreshold}`);
    console.log(`   SL_ROI=${best.slROI}`);
    console.log(`   TP_ROI=${best.tpROI}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
