'use strict';

/**
 * Standalone Backtest Runner
 * Usage: node scripts/run-backtest.js [symbol] [granularity] [days]
 */

require('dotenv').config();
const BacktestEngine = require('../src/backtest/BacktestEngine');
const KuCoinClient = require('../src/lib/KuCoinClient');

const CONFIG = {
  symbol: process.argv[2] || 'XBTUSDTM',
  granularity: process.argv[3] || '5',
  days: parseInt(process.argv[4] || '30'),
  leverage: parseInt(process.env.LEVERAGE || '5'),
  riskPercent: parseFloat(process.env.RISK_PERCENT || '2'),
  signalThreshold: parseInt(process.env.SIGNAL_THRESHOLD || '50'),
  slROI: parseFloat(process.env.SL_ROI || '3'),
  tpROI: parseFloat(process.env.TP_ROI || '6')
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Backtest Runner                                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Symbol: ${CONFIG.symbol.padEnd(48)}║`);
  console.log(`║  Timeframe: ${CONFIG.granularity}min${''.padEnd(44)}║`);
  console.log(`║  Period: ${CONFIG.days} days${''.padEnd(43)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const client = new KuCoinClient({});
  
  // Calculate time range
  const to = Date.now();
  const from = to - (CONFIG.days * 24 * 60 * 60 * 1000);

  console.log('📥 Fetching historical data...');
  
  const rawCandles = await client.getKlines(
    CONFIG.symbol,
    CONFIG.granularity,
    from,
    to
  );

  if (!rawCandles || rawCandles.length === 0) {
    console.error('❌ No candle data returned');
    process.exit(1);
  }

  // Format candles
  const candles = rawCandles.map(c => ({
    ts: c[0],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5])
  }));

  console.log(`✅ Loaded ${candles.length} candles`);
  console.log('');

  // Run backtest
  console.log('🔬 Running backtest...');
  
  const engine = new BacktestEngine({
    leverage: CONFIG.leverage,
    riskPercent: CONFIG.riskPercent,
    signalThreshold: CONFIG.signalThreshold,
    slROI: CONFIG.slROI,
    tpROI: CONFIG.tpROI,
    initialBalance: 10000
  });

  const results = engine.run(candles);

  // Display results
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('                        RESULTS                              ');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total Trades:     ${results.summary.totalTrades}`);
  console.log(`Win Rate:         ${results.summary.winRate}%`);
  console.log(`Profit Factor:    ${results.summary.profitFactor}`);
  console.log(`Total Return:     ${results.summary.totalReturn}%`);
  console.log(`Max Drawdown:     ${results.summary.maxDrawdown}%`);
  console.log(`Sharpe Ratio:     ${results.summary.sharpeRatio}`);
  console.log(`Final Balance:    $${results.summary.finalBalance.toFixed(2)}`);
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  
  // Show last 10 trades
  if (results.trades.length > 0) {
    console.log('');
    console.log('Last 10 Trades:');
    const recent = results.trades.slice(-10);
    for (const t of recent) {
      const pnl = t.pnlPercent >= 0 ? `+${t.pnlPercent.toFixed(2)}%` : `${t.pnlPercent.toFixed(2)}%`;
      const color = t.pnlPercent >= 0 ? '\x1b[32m' : '\x1b[31m';
      console.log(`  ${t.side.toUpperCase().padEnd(5)} ${color}${pnl.padStart(8)}\x1b[0m  ${t.reason}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
