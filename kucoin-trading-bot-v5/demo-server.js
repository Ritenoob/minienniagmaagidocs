'use strict';

/**
 * KuCoin Futures Trading Bot - DEMO MODE
 * 
 * Runs without network connection using simulated market data.
 * Perfect for testing the dashboard and understanding the system.
 */

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const path = require('path');

// Core modules
const SignalGeneratorV2 = require('./src/lib/SignalGeneratorV2');
const { createIndicatorSuite, updateAll, enableLiveMode } = require('./src/indicators');
const { createMicrostructureSuite, enableLiveMode: enableMicroLive } = require('./src/microstructure');
const BacktestEngine = require('./src/backtest/BacktestEngine');
const PaperTradingEngine = require('./src/optimizer/PaperTradingEngine');

const CONFIG = {
  port: process.env.PORT || 3000,
  symbols: ['XBTUSDTM', 'ETHUSDTM', 'SOLUSDTM'],
  leverage: 5,
  riskPercent: 2,
  signalThreshold: 50,
  slROI: 3,
  tpROI: 6,
  paperBalance: 10000
};

class DemoServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIO(this.server, { cors: { origin: '*' } });
    
    this.indicators = new Map();
    this.microstructure = new Map();
    this.signalGenerator = new SignalGeneratorV2({
      enhancedMode: true,
      includeMicrostructure: true
    });
    
    this.paperEngine = new PaperTradingEngine({
      initialBalance: CONFIG.paperBalance,
      leverage: CONFIG.leverage,
      riskPercent: CONFIG.riskPercent,
      signalThreshold: CONFIG.signalThreshold,
      slROI: CONFIG.slROI,
      tpROI: CONFIG.tpROI,
      maxPositions: 3
    });
    
    // Simulated prices
    this.prices = {
      'XBTUSDTM': 95000,
      'ETHUSDTM': 3200,
      'SOLUSDTM': 180
    };
    
    this.running = false;
    this.simulationInterval = null;
    
    this._setupRoutes();
    this._setupWebSocket();
  }

  initialize() {
    console.log('[Demo] Initializing...');
    
    for (const symbol of CONFIG.symbols) {
      const suite = createIndicatorSuite();
      enableLiveMode(suite);
      this.indicators.set(symbol, suite);
      
      const micro = createMicrostructureSuite();
      enableMicroLive(micro);
      this.microstructure.set(symbol, micro);
    }
    
    // Warm up indicators with simulated history
    this._warmupIndicators();
    
    this.paperEngine.start();
    
    this.paperEngine.on('position_opened', (pos) => {
      console.log(`[Paper] Opened ${pos.side} on ${pos.symbol} @ ${pos.price}`);
      this.io.emit('position_opened', pos);
    });
    
    this.paperEngine.on('position_closed', (trade) => {
      console.log(`[Paper] Closed ${trade.symbol}: ${trade.pnl?.toFixed(2)} (${trade.reason})`);
      this.io.emit('position_closed', trade);
    });
    
    this.running = true;
    console.log('[Demo] Initialized');
  }

  _warmupIndicators() {
    // Generate 300 candles of historical data per symbol
    for (const symbol of CONFIG.symbols) {
      const basePrice = this.prices[symbol];
      const suite = this.indicators.get(symbol);
      const micro = this.microstructure.get(symbol);
      
      let price = basePrice * 0.95;
      
      for (let i = 0; i < 300; i++) {
        // Random walk with trend
        const change = (Math.random() - 0.48) * (basePrice * 0.01);
        price = Math.max(basePrice * 0.85, Math.min(basePrice * 1.15, price + change));
        
        const candle = {
          ts: Date.now() - (300 - i) * 300000,
          open: price,
          high: price * (1 + Math.random() * 0.005),
          low: price * (1 - Math.random() * 0.005),
          close: price + (Math.random() - 0.5) * (basePrice * 0.003),
          volume: 1000 + Math.random() * 5000
        };
        
        updateAll(suite, candle);
        
        // Simulate some trades
        for (let j = 0; j < 10; j++) {
          micro.buySellRatio.processTrade({
            side: Math.random() > 0.5 ? 'buy' : 'sell',
            size: Math.random() * 10,
            price: candle.close,
            ts: candle.ts
          });
        }
        
        micro.priceRatio.update({
          bid: candle.close * 0.9999,
          ask: candle.close * 1.0001,
          index: candle.close * 0.9998,
          mark: candle.close,
          last: candle.close
        });
        
        micro.fundingRate.update({
          currentRate: (Math.random() - 0.5) * 0.0002,
          predictedRate: (Math.random() - 0.5) * 0.0002,
          nextFundingTime: Date.now() + 4 * 60 * 60 * 1000
        });
      }
      
      this.prices[symbol] = price;
    }
  }

  _startSimulation() {
    console.log('[Demo] Starting market simulation...');
    
    this.simulationInterval = setInterval(() => {
      for (const symbol of CONFIG.symbols) {
        this._simulateTick(symbol);
      }
    }, 2000);
  }

  _simulateTick(symbol) {
    const basePrice = this.prices[symbol];
    const suite = this.indicators.get(symbol);
    const micro = this.microstructure.get(symbol);
    
    // Random price movement
    const change = (Math.random() - 0.48) * (basePrice * 0.002);
    const newPrice = Math.max(basePrice * 0.9, Math.min(basePrice * 1.1, basePrice + change));
    this.prices[symbol] = newPrice;
    
    const candle = {
      ts: Date.now(),
      open: basePrice,
      high: Math.max(basePrice, newPrice) * (1 + Math.random() * 0.001),
      low: Math.min(basePrice, newPrice) * (1 - Math.random() * 0.001),
      close: newPrice,
      volume: 500 + Math.random() * 2000
    };
    
    // Update indicators
    const results = updateAll(suite, candle);
    
    // Simulate trades
    const buySellBias = Math.random();
    for (let i = 0; i < 20; i++) {
      micro.buySellRatio.processTrade({
        side: Math.random() < buySellBias ? 'buy' : 'sell',
        size: Math.random() * 5,
        price: newPrice,
        ts: Date.now()
      });
    }
    
    // Update price ratios
    micro.priceRatio.update({
      bid: newPrice * 0.9999,
      ask: newPrice * 1.0001,
      index: newPrice * (1 + (Math.random() - 0.5) * 0.0002),
      mark: newPrice,
      last: newPrice
    });
    
    // Update funding
    micro.fundingRate.update({
      currentRate: (Math.random() - 0.5) * 0.0003,
      predictedRate: (Math.random() - 0.5) * 0.0003,
      nextFundingTime: Date.now() + 4 * 60 * 60 * 1000
    });
    
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
      price: newPrice,
      signal: this.signalGenerator.getSummary(signal),
      indicators: this._getIndicatorSummary(results),
      microstructure: this._getMicroSummary(microResults)
    });
    
    // Process in paper trading
    this.paperEngine.processUpdate(symbol, candle, results, microResults);
  }

  _getIndicatorSummary(results) {
    const summary = {};
    for (const [name, data] of Object.entries(results)) {
      if (data && data.value !== undefined) {
        summary[name] = {
          value: data.value,
          signalCount: data.signals?.length || 0,
          signals: data.signals?.slice(0, 2) || []
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
    
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    this.app.get('/api/status', (req, res) => {
      res.json({
        mode: 'demo',
        running: this.running,
        symbols: CONFIG.symbols,
        config: {
          leverage: CONFIG.leverage,
          riskPercent: CONFIG.riskPercent,
          signalThreshold: CONFIG.signalThreshold
        }
      });
    });
    
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
          price: this.prices[symbol],
          ...this.signalGenerator.getSummary(signal)
        });
      }
      
      res.json(signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)));
    });
    
    this.app.get('/api/positions', (req, res) => {
      res.json(Array.from(this.paperEngine.positions.values()));
    });
    
    this.app.get('/api/trades', (req, res) => {
      res.json(this.paperEngine.trades.slice(-100));
    });
    
    this.app.get('/api/performance', (req, res) => {
      res.json(this.paperEngine.getResults());
    });
    
    this.app.get('/api/coins', (req, res) => {
      res.json(CONFIG.symbols.map((s, i) => ({
        symbol: s,
        rank: i + 1,
        price: this.prices[s],
        volume24h: 100000000 + Math.random() * 500000000
      })));
    });
    
    // Backtest endpoint with generated data
    this.app.post('/api/backtest', (req, res) => {
      try {
        const { config } = req.body;
        
        // Generate test candles
        const candles = [];
        let price = 50000;
        for (let i = 0; i < 500; i++) {
          const change = (Math.random() - 0.48) * 500;
          price = Math.max(40000, Math.min(60000, price + change));
          candles.push({
            ts: Date.now() - (500 - i) * 300000,
            open: price,
            high: price * 1.003,
            low: price * 0.997,
            close: price + (Math.random() - 0.5) * 200,
            volume: 1000 + Math.random() * 5000
          });
        }
        
        const engine = new BacktestEngine({
          leverage: config?.leverage || CONFIG.leverage,
          riskPercent: config?.riskPercent || CONFIG.riskPercent,
          signalThreshold: config?.signalThreshold || CONFIG.signalThreshold,
          slROI: config?.slROI || CONFIG.slROI,
          tpROI: config?.tpROI || CONFIG.tpROI
        });
        
        const results = engine.run(candles);
        res.json(results);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  _setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('[WS] Client connected');
      
      socket.emit('init', {
        mode: 'demo',
        symbols: CONFIG.symbols,
        message: 'Demo mode - using simulated market data'
      });
      
      socket.on('disconnect', () => {
        console.log('[WS] Client disconnected');
      });
    });
  }

  start() {
    this.initialize();
    this._startSimulation();
    
    this.server.listen(CONFIG.port, () => {
      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║     KuCoin Futures Trading Bot - DEMO MODE                    ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║  Dashboard: http://localhost:${CONFIG.port}                            ║`);
      console.log(`║  API:       http://localhost:${CONFIG.port}/api/signals                ║`);
      console.log(`║  Mode:      Demo (simulated data)                             ║`);
      console.log(`║  Symbols:   ${CONFIG.symbols.join(', ').padEnd(41)}║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
    });
  }

  stop() {
    this.running = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    this.paperEngine.stop();
    this.server.close();
  }
}

const server = new DemoServer();
server.start();

process.on('SIGINT', () => {
  console.log('\n[Demo] Shutting down...');
  server.stop();
  process.exit(0);
});

module.exports = DemoServer;
