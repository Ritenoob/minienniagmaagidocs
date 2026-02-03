'use strict';

/**
 * Standalone Paper Trading Runner
 * Usage: node scripts/run-paper-trading.js [symbol]
 */

require('dotenv').config();
const PaperTradingEngine = require('../src/optimizer/PaperTradingEngine');
const KuCoinClient = require('../src/lib/KuCoinClient');
const { createIndicatorSuite, updateAll, enableLiveMode } = require('../src/indicators');
const { createMicrostructureSuite, enableLiveMode: enableMicroLive } = require('../src/microstructure');
const SignalGeneratorV2 = require('../src/lib/SignalGeneratorV2');

const CONFIG = {
  symbols: (process.argv[2] || process.env.SYMBOLS || 'XBTUSDTM').split(','),
  leverage: parseInt(process.env.LEVERAGE || '5'),
  riskPercent: parseFloat(process.env.RISK_PERCENT || '2'),
  signalThreshold: parseInt(process.env.SIGNAL_THRESHOLD || '50'),
  slROI: parseFloat(process.env.SL_ROI || '3'),
  tpROI: parseFloat(process.env.TP_ROI || '6'),
  trailingEnabled: process.env.TRAILING !== 'false',
  paperBalance: parseFloat(process.env.PAPER_BALANCE || '10000'),
  primaryTf: process.env.PRIMARY_TF || '5min'
};

class PaperTradingRunner {
  constructor() {
    this.client = new KuCoinClient({});
    this.engine = new PaperTradingEngine({
      initialBalance: CONFIG.paperBalance,
      leverage: CONFIG.leverage,
      riskPercent: CONFIG.riskPercent,
      signalThreshold: CONFIG.signalThreshold,
      slROI: CONFIG.slROI,
      tpROI: CONFIG.tpROI,
      trailingEnabled: CONFIG.trailingEnabled
    });
    
    this.signalGenerator = new SignalGeneratorV2({
      enhancedMode: true,
      includeMicrostructure: true
    });
    
    this.indicators = new Map();
    this.microstructure = new Map();
  }

  async start() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  Paper Trading Runner                                      ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Symbols: ${CONFIG.symbols.join(', ').padEnd(47)}║`);
    console.log(`║  Balance: $${CONFIG.paperBalance.toLocaleString().padEnd(46)}║`);
    console.log(`║  Leverage: ${CONFIG.leverage}x${''.padEnd(46)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Initialize per-symbol state
    for (const symbol of CONFIG.symbols) {
      const suite = createIndicatorSuite();
      enableLiveMode(suite);
      this.indicators.set(symbol, suite);
      
      const micro = createMicrostructureSuite();
      enableMicroLive(micro);
      this.microstructure.set(symbol, micro);
    }

    // Connect WebSocket
    console.log('🔌 Connecting to KuCoin...');
    await this.client.connectWs(false);
    console.log('✅ Connected');

    // Subscribe
    for (const symbol of CONFIG.symbols) {
      this.client.subscribeCandles(symbol, CONFIG.primaryTf);
      this.client.subscribeTrades(symbol);
      this.client.subscribeTicker(symbol);
      console.log(`📡 Subscribed to ${symbol}`);
    }

    // Handle messages
    this.client.on('message', (msg) => this._handleMessage(msg));

    // Start engine
    this.engine.start();
    this.engine.on('position_opened', (pos) => {
      console.log(`\n🟢 OPENED ${pos.side.toUpperCase()} ${pos.symbol} @ ${pos.price}`);
      console.log(`   Size: ${pos.size}, Signal: ${pos.signal.score}`);
    });
    this.engine.on('position_closed', (trade) => {
      const color = trade.pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
      const sign = trade.pnl >= 0 ? '+' : '';
      console.log(`\n🔴 CLOSED ${trade.symbol}: ${color}${sign}$${trade.pnl.toFixed(2)}\x1b[0m (${trade.reason})`);
    });

    console.log('\n🚀 Paper trading started. Press Ctrl+C to stop.\n');

    // Status interval
    setInterval(() => this._printStatus(), 60000);
  }

  _handleMessage(msg) {
    if (!msg.subject || !msg.data) return;
    
    const subject = msg.subject;
    const data = msg.data;
    const symbol = data.symbol;
    
    if (!symbol || !this.indicators.has(symbol)) return;
    
    switch (subject) {
      case 'candle.stick':
        this._handleCandle(symbol, data);
        break;
      case 'match':
        this._handleTrade(symbol, data);
        break;
      case 'ticker':
        this._handleTicker(symbol, data);
        break;
    }
  }

  _handleCandle(symbol, data) {
    const candle = {
      ts: Number(data.time) * 1000,
      open: Number(data.open),
      high: Number(data.high),
      low: Number(data.low),
      close: Number(data.close),
      volume: Number(data.volume)
    };

    const suite = this.indicators.get(symbol);
    const results = updateAll(suite, candle);

    const micro = this.microstructure.get(symbol);
    const microResults = {
      buySellRatio: micro.buySellRatio.getResult(),
      priceRatio: micro.priceRatio.getResult(),
      fundingRate: micro.fundingRate.getResult()
    };

    const signal = this.signalGenerator.generate(results, microResults);
    
    // Log signal if significant
    if (Math.abs(signal.score) >= 30) {
      const color = signal.score > 0 ? '\x1b[32m' : '\x1b[31m';
      process.stdout.write(`${color}●\x1b[0m ${symbol}: ${signal.score} (${signal.type}) `);
    }

    // Process in engine
    this.engine.processUpdate(symbol, candle, results, microResults);
  }

  _handleTrade(symbol, data) {
    const micro = this.microstructure.get(symbol);
    micro?.buySellRatio.processTrade({
      side: data.side,
      size: data.size,
      price: data.price,
      ts: data.ts
    });
  }

  _handleTicker(symbol, data) {
    const micro = this.microstructure.get(symbol);
    micro?.priceRatio.update({
      bid: data.bestBidPrice,
      ask: data.bestAskPrice,
      last: data.price
    });
  }

  _printStatus() {
    const results = this.engine.getResults();
    console.log('\n─────────────────────────────────────────');
    console.log(`📊 Balance: $${results.balance?.toFixed(2) || CONFIG.paperBalance}`);
    console.log(`   Trades: ${results.totalTrades || 0} | Win Rate: ${results.winRate || '0'}%`);
    console.log(`   PnL: ${results.totalReturn || '0'}%`);
    console.log('─────────────────────────────────────────\n');
  }

  stop() {
    this.engine.stop();
    this.client.disconnectWs();
    console.log('\n\n📊 Final Results:');
    console.log(JSON.stringify(this.engine.getResults(), null, 2));
  }
}

const runner = new PaperTradingRunner();

runner.start().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  runner.stop();
  process.exit(0);
});
