'use strict';

/**
 * KuCoin Futures Trading Bot - Main Server
 * 
 * Production-grade trading bot with:
 * - 10 technical indicators + 3 microstructure analyzers
 * - Real-time WebSocket data feeds
 * - Position management with risk controls
 * - Paper trading mode
 * - Dashboard API
 */

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const path = require('path');

// Core modules
const KuCoinClient = require('./src/lib/KuCoinClient');
const PositionManager = require('./src/lib/PositionManager');
const SignalGeneratorV2 = require('./src/lib/SignalGeneratorV2');
const { createIndicatorSuite, updateAll, enableLiveMode } = require('./src/indicators');
const { createMicrostructureSuite, enableLiveMode: enableMicroLive } = require('./src/microstructure');
const CoinListManager = require('./src/screener/CoinListManager');
const ScreenerEngine = require('./src/screener/ScreenerEngine');
const BacktestEngine = require('./src/backtest/BacktestEngine');
const PaperTradingEngine = require('./src/optimizer/PaperTradingEngine');

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  mode: process.env.MODE || 'paper', // 'live' | 'paper' | 'backtest'
  
  // API credentials (optional for public endpoints)
  apiKey: process.env.KUCOIN_API_KEY || '',
  apiSecret: process.env.KUCOIN_API_SECRET || '',
  passphrase: process.env.KUCOIN_PASSPHRASE || '',
  
  // Trading parameters
  symbols: (process.env.SYMBOLS || 'XBTUSDTM,ETHUSDTM').split(','),
  primaryTimeframe: process.env.PRIMARY_TF || '5min',
  secondaryTimeframe: process.env.SECONDARY_TF || '15min',
  
  // Risk parameters
  leverage: parseInt(process.env.LEVERAGE || '5'),
  riskPercent: parseFloat(process.env.RISK_PERCENT || '2'),
  maxPositions: parseInt(process.env.MAX_POSITIONS || '3'),
  signalThreshold: parseInt(process.env.SIGNAL_THRESHOLD || '50'),
  slROI: parseFloat(process.env.SL_ROI || '3'),
  tpROI: parseFloat(process.env.TP_ROI || '6'),
  trailingEnabled: process.env.TRAILING !== 'false',
  
  // Paper trading
  paperBalance: parseFloat(process.env.PAPER_BALANCE || '10000')
};

class TradingServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIO(this.server, { cors: { origin: '*' } });
    
    // Core components
    this.client = new KuCoinClient({
      apiKey: CONFIG.apiKey,
      apiSecret: CONFIG.apiSecret,
      passphrase: CONFIG.passphrase
    });
    
    this.coinList = new CoinListManager({ client: this.client });
    
    // Mode-specific components
    if (CONFIG.mode === 'paper') {
      this.paperEngine = new PaperTradingEngine({
        initialBalance: CONFIG.paperBalance,
        leverage: CONFIG.leverage,
        riskPercent: CONFIG.riskPercent,
        signalThreshold: CONFIG.signalThreshold,
        slROI: CONFIG.slROI,
        tpROI: CONFIG.tpROI,
        trailingEnabled: CONFIG.trailingEnabled,
        maxPositions: CONFIG.maxPositions
      });
    } else if (CONFIG.mode === 'live') {
      this.positionManager = new PositionManager({
        client: this.client,
        maxRiskPercent: CONFIG.riskPercent,
        maxPositions: CONFIG.maxPositions,
        defaultLeverage: CONFIG.leverage
      });
    }
    
    // Per-symbol state
    this.indicators = new Map();
    this.microstructure = new Map();
    this.signalGenerator = new SignalGeneratorV2({
      enhancedMode: true,
      includeMicrostructure: true
    });
    
    this.running = false;
    this._setupRoutes();
    this._setupWebSocket();
  }

  async initialize() {
    console.log(`[Server] Initializing in ${CONFIG.mode} mode...`);
    
    // Initialize coin list
    await this.coinList.initialize();
    
    // Use configured symbols or top coins
    const symbols = CONFIG.symbols.length > 0 && CONFIG.symbols[0] 
      ? CONFIG.symbols 
      : this.coinList.getSymbols().slice(0, 10);
    
    console.log(`[Server] Tracking symbols: ${symbols.join(', ')}`);
    
    // Initialize per-symbol state
    for (const symbol of symbols) {
      const suite = createIndicatorSuite();
      enableLiveMode(suite);
      this.indicators.set(symbol, suite);
      
      const micro = createMicrostructureSuite();
      enableMicroLive(micro);
      this.microstructure.set(symbol, micro);
    }
    
    // Connect WebSocket
    const isPrivate = CONFIG.mode === 'live' && CONFIG.apiKey;
    await this.client.connectWs(isPrivate);
    
    // Subscribe to feeds
    for (const symbol of symbols) {
      this.client.subscribeCandles(symbol, CONFIG.primaryTimeframe);
      this.client.subscribeTrades(symbol);
      this.client.subscribeTicker(symbol);
      this.client.subscribeInstrument(symbol);
    }
    
    // Event handlers
    this.client.on('message', (msg) => this._handleMessage(msg));
    
    if (CONFIG.mode === 'paper') {
      this.paperEngine.start();
      this.paperEngine.on('position_opened', (pos) => {
        console.log(`[Paper] Opened ${pos.side} on ${pos.symbol} @ ${pos.price}`);
        this.io.emit('position_opened', pos);
      });
      this.paperEngine.on('position_closed', (trade) => {
        console.log(`[Paper] Closed ${trade.symbol}: ${trade.pnl.toFixed(2)} (${trade.reason})`);
        this.io.emit('position_closed', trade);
      });
    }
    
    this.running = true;
    console.log('[Server] Initialized successfully');
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
      case 'funding.rate':
        this._handleFunding(symbol, data);
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
    
    // Update indicators
    const suite = this.indicators.get(symbol);
    const results = updateAll(suite, candle);
    
    // Get microstructure
    const micro = this.microstructure.get(symbol);
    const microResults = {
      buySellRatio: micro.buySellRatio.getResult(),
      priceRatio: micro.priceRatio.getResult(),
      fundingRate: micro.fundingRate.getResult()
    };
    
    // Generate signal
    const signal = this.signalGenerator.generate(results, microResults);
    
    // Emit to dashboard
    this.io.emit('signal_update', {
      symbol,
      signal: this.signalGenerator.getSummary(signal),
      indicators: this._getIndicatorSummary(results),
      microstructure: this._getMicroSummary(microResults)
    });
    
    // Process in paper trading
    if (CONFIG.mode === 'paper' && this.paperEngine) {
      this.paperEngine.processUpdate(symbol, candle, results, microResults);
    }
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

  _handleFunding(symbol, data) {
    const micro = this.microstructure.get(symbol);
    micro?.fundingRate.update({
      currentRate: data.fundingFeeRate,
      predictedRate: data.predictedFundingFeeRate,
      nextFundingTime: data.fundingTime
    });
  }

  _getIndicatorSummary(results) {
    const summary = {};
    for (const [name, data] of Object.entries(results)) {
      if (data && data.value !== undefined) {
        summary[name] = {
          value: typeof data.value === 'object' ? data.value : data.value,
          signalCount: data.signals?.length || 0
        };
      }
    }
    return summary;
  }

  _getMicroSummary(results) {
    return {
      buySellRatio: results.buySellRatio?.value?.ratio,
      spread: results.priceRatio?.value?.spread,
      basis: results.priceRatio?.value?.basis,
      funding: results.fundingRate?.value?.currentRate,
      isLive: results.buySellRatio?.value?.isLive
    };
  }

  _setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // Screener Dashboard
    this.app.get('/screener', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'screener.html'));
    });
    
    // API: Status
    this.app.get('/api/status', (req, res) => {
      res.json({
        mode: CONFIG.mode,
        running: this.running,
        symbols: Array.from(this.indicators.keys()),
        config: {
          leverage: CONFIG.leverage,
          riskPercent: CONFIG.riskPercent,
          signalThreshold: CONFIG.signalThreshold
        }
      });
    });
    
    // API: Signals
    this.app.get('/api/signals', (req, res) => {
      const signals = [];
      for (const symbol of this.indicators.keys()) {
        const suite = this.indicators.get(symbol);
        const micro = this.microstructure.get(symbol);
        
        const indicatorResults = {};
        for (const [name, ind] of Object.entries(suite)) {
          if (typeof ind.getResult === 'function') {
            indicatorResults[name] = ind.getResult();
          }
        }
        
        const microResults = {
          buySellRatio: micro?.buySellRatio.getResult(),
          priceRatio: micro?.priceRatio.getResult(),
          fundingRate: micro?.fundingRate.getResult()
        };
        
        const signal = this.signalGenerator.generate(indicatorResults, microResults);
        signals.push({
          symbol,
          ...this.signalGenerator.getSummary(signal)
        });
      }
      
      res.json(signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)));
    });
    
    // API: Positions (paper)
    this.app.get('/api/positions', (req, res) => {
      if (CONFIG.mode === 'paper' && this.paperEngine) {
        res.json(Array.from(this.paperEngine.positions.values()));
      } else if (CONFIG.mode === 'live' && this.positionManager) {
        res.json(this.positionManager.getAllPositions());
      } else {
        res.json([]);
      }
    });
    
    // API: Trades (paper)
    this.app.get('/api/trades', (req, res) => {
      if (CONFIG.mode === 'paper' && this.paperEngine) {
        res.json(this.paperEngine.trades.slice(-100));
      } else {
        res.json([]);
      }
    });
    
    // API: Performance (paper)
    this.app.get('/api/performance', (req, res) => {
      if (CONFIG.mode === 'paper' && this.paperEngine) {
        res.json(this.paperEngine.getResults());
      } else {
        res.json({});
      }
    });
    
    // API: Coin list
    this.app.get('/api/coins', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      res.json(this.coinList.getTopCoins(limit));
    });
    
    /**
     * API: Screener Scan - Full scan of top coins.
     *
     * Note:
     * - The current screener UI (screener.html) still uses /api/signals and /api/coins
     *   and performs filtering client-side.
     * - This endpoint centralizes screener logic on the server and is intended for
     *   programmatic use (e.g. external tools, future dashboard revisions, or other
     *   services) even if the existing frontend does not yet call it directly.
     *
     * Do not remove this endpoint as "dead code" without first verifying external
     * consumers and planned dashboard integrations.
     */
    this.app.get('/api/screener/scan', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const minScore = parseInt(req.query.minScore) || 0;
        
        const coins = this.coinList.getTopCoins(limit);
        const results = [];
        
        for (const coin of coins) {
          // Check if we have indicators for this coin
          const suite = this.indicators.get(coin.symbol);
          const micro = this.microstructure.get(coin.symbol);
          
          let signal = { score: 0, type: 'NEUTRAL', confidence: 0, indicatorScore: 0, microstructureScore: 0 };
          
          if (suite) {
            const indicatorResults = {};
            for (const [name, ind] of Object.entries(suite)) {
              if (typeof ind.getResult === 'function') {
                indicatorResults[name] = ind.getResult();
              }
            }
            
            const microResults = {
              buySellRatio: micro?.buySellRatio?.getResult(),
              priceRatio: micro?.priceRatio?.getResult(),
              fundingRate: micro?.fundingRate?.getResult()
            };
            
            const generatedSignal = this.signalGenerator.generate(indicatorResults, microResults);
            signal = this.signalGenerator.getSummary(generatedSignal);
          }
          
          // Apply min score filter
          if (Math.abs(signal.score) >= minScore) {
            results.push({
              symbol: coin.symbol,
              baseCurrency: coin.baseCurrency,
              price: coin.lastPrice,
              change: coin.priceChangePercent,
              volume: coin.turnover24h,
              spread: coin.spread,
              fundingRate: coin.fundingRate,
              openInterest: coin.openInterest,
              ...signal
            });
          }
        }
        
        // Sort by absolute score
        results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
        
        res.json({
          timestamp: Date.now(),
          count: results.length,
          coins: results
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // API: Backtest
    this.app.post('/api/backtest', async (req, res) => {
      try {
        const { symbol, granularity, from, to, config } = req.body;
        
        // Fetch historical data
        const candles = await this.client.getKlines(symbol, granularity, from, to);
        
        if (!candles || candles.length === 0) {
          return res.status(400).json({ error: 'No data returned' });
        }
        
        // Format candles
        const formatted = candles.map(c => ({
          ts: c[0],
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5])
        }));
        
        // Run backtest
        const engine = new BacktestEngine({
          leverage: config?.leverage || CONFIG.leverage,
          riskPercent: config?.riskPercent || CONFIG.riskPercent,
          signalThreshold: config?.signalThreshold || CONFIG.signalThreshold,
          slROI: config?.slROI || CONFIG.slROI,
          tpROI: config?.tpROI || CONFIG.tpROI
        });
        
        const results = engine.run(formatted);
        res.json(results);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  _setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('[WS] Client connected');
      
      // Send current state
      socket.emit('init', {
        mode: CONFIG.mode,
        symbols: Array.from(this.indicators.keys())
      });
      
      socket.on('disconnect', () => {
        console.log('[WS] Client disconnected');
      });
    });
  }

  async start() {
    await this.initialize();
    
    this.server.listen(CONFIG.port, () => {
      console.log(`[Server] Running on http://localhost:${CONFIG.port}`);
      console.log(`[Server] Mode: ${CONFIG.mode}`);
    });
  }

  async stop() {
    this.running = false;
    this.client.disconnectWs();
    this.coinList.stop();
    
    if (this.paperEngine) {
      this.paperEngine.stop();
    }
    
    this.server.close();
  }
}

// Main entry
const server = new TradingServer();

server.start().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Terminating...');
  await server.stop();
  process.exit(0);
});

module.exports = TradingServer;
