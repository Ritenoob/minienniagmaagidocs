'use strict';

/**
 * Standalone Screener Runner
 * Scans multiple coins for trading opportunities
 */

require('dotenv').config();
const CoinListManager = require('../src/screener/CoinListManager');
const KuCoinClient = require('../src/lib/KuCoinClient');
const { createIndicatorSuite, updateAll, enableLiveMode } = require('../src/indicators');
const SignalGeneratorV2 = require('../src/lib/SignalGeneratorV2');

const CONFIG = {
  topN: parseInt(process.argv[2] || '20'),
  minVolume: parseFloat(process.env.MIN_VOLUME || '10000000'),
  signalThreshold: parseInt(process.env.SIGNAL_THRESHOLD || '40')
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Coin Screener                                             ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Scanning top ${CONFIG.topN} coins by volume${''.padEnd(35)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const client = new KuCoinClient({});
  const coinList = new CoinListManager({
    client,
    minVolume: CONFIG.minVolume,
    topN: CONFIG.topN
  });

  console.log('📊 Fetching coin list...');
  await coinList.initialize();
  
  const coins = coinList.getTopCoins(CONFIG.topN);
  console.log(`✅ Found ${coins.length} coins\n`);

  const signalGenerator = new SignalGeneratorV2({ enhancedMode: true });
  const opportunities = [];

  console.log('🔍 Scanning for signals...\n');

  for (const coin of coins) {
    try {
      // Fetch recent candles
      const to = Date.now();
      const from = to - (4 * 60 * 60 * 1000); // 4 hours
      
      const rawCandles = await client.getKlines(coin.symbol, '5', from, to);
      
      if (!rawCandles || rawCandles.length < 50) continue;

      // Process through indicators
      const suite = createIndicatorSuite();
      enableLiveMode(suite);

      let lastResult = null;
      for (const c of rawCandles) {
        const candle = {
          ts: c[0],
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5])
        };
        lastResult = updateAll(suite, candle);
      }

      if (!lastResult) continue;

      const signal = signalGenerator.generate(lastResult, {});
      
      if (Math.abs(signal.score) >= CONFIG.signalThreshold) {
        opportunities.push({
          symbol: coin.symbol,
          score: signal.score,
          type: signal.type,
          volume24h: coin.turnover24h,
          price: coin.lastPrice,
          change: coin.priceChangePercent
        });
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      // Skip failed coins
    }
  }

  // Sort by score
  opportunities.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  console.log('════════════════════════════════════════════════════════════');
  console.log('                    OPPORTUNITIES                            ');
  console.log('════════════════════════════════════════════════════════════\n');

  if (opportunities.length === 0) {
    console.log('No significant signals found.\n');
  } else {
    console.log('Symbol          Score    Type           Volume 24h    Change');
    console.log('────────────────────────────────────────────────────────────');
    
    for (const opp of opportunities.slice(0, 20)) {
      const color = opp.score > 0 ? '\x1b[32m' : '\x1b[31m';
      const scoreStr = `${opp.score > 0 ? '+' : ''}${opp.score}`.padStart(6);
      const typeStr = opp.type.padEnd(14);
      const volStr = `$${(opp.volume24h / 1e6).toFixed(1)}M`.padStart(10);
      const chgStr = `${opp.change >= 0 ? '+' : ''}${opp.change.toFixed(2)}%`;
      
      console.log(`${opp.symbol.padEnd(15)} ${color}${scoreStr}\x1b[0m   ${typeStr} ${volStr}    ${chgStr}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  coinList.stop();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
