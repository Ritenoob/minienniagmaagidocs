'use strict';

/**
 * Screener Engine
 * 
 * Real-time multi-symbol signal screener using WebSocket feeds.
 * Processes indicators and generates signals for the coin list.
 * 
 * @module ScreenerEngine
 */

const EventEmitter = require('events');
const { createIndicatorSuite, updateAll, enableLiveMode } = require('../indicators');
const { createMicrostructureSuite, enableLiveMode: enableMicroLive } = require('../microstructure');
const SignalGeneratorV2 = require('../lib/SignalGeneratorV2');

class ScreenerEngine extends EventEmitter {
  /**
   * @param {Object} config
   * @param {Object} config.client - KuCoin client
   * @param {Array} config.symbols - Symbols to screen
   * @param {string} [config.primaryTimeframe='5min'] - Primary TF
   * @param {string} [config.secondaryTimeframe='15min'] - Secondary TF
   * @param {number} [config.signalThreshold=50] - Min signal score
   * @param {number} [config.cooldownMs=60000] - Signal cooldown
   */
  constructor(config = {}) {
    super();
    
    this.client = config.client;
    this.symbols = config.symbols || [];
    this.primaryTF = config.primaryTimeframe || '5min';
    this.secondaryTF = config.secondaryTimeframe || '15min';
    this.signalThreshold = config.signalThreshold || 50;
    this.cooldownMs = config.cooldownMs || 60000;
    
    // Per-symbol state
    this.indicators = new Map();
    this.microstructure = new Map();
    this.candleBuffers = new Map();
    this.lastSignals = new Map();
    
    // Signal generator
    this.signalGenerator = new SignalGeneratorV2({
      enhancedMode: true,
      includeMicrostructure: true
    });
    
    this.running = false;
  }

  async start() {
    if (this.running) return;
    
    // Initialize per-symbol state
    for (const symbol of this.symbols) {
      this.indicators.set(symbol, {
        [this.primaryTF]: createIndicatorSuite(),
        [this.secondaryTF]: createIndicatorSuite()
      });
      
      this.microstructure.set(symbol, createMicrostructureSuite());
      
      this.candleBuffers.set(symbol, {
        [this.primaryTF]: [],
        [this.secondaryTF]: []
      });
      
      // Enable live mode for DOM
      enableLiveMode(this.indicators.get(symbol)[this.primaryTF]);
      enableMicroLive(this.microstructure.get(symbol));
    }
    
    // Connect WebSocket
    await this.client.connectWs();
    
    // Subscribe to feeds
    for (const symbol of this.symbols) {
      this.client.subscribeCandles(symbol, this.primaryTF);
      this.client.subscribeCandles(symbol, this.secondaryTF);
      this.client.subscribeTrades(symbol);
      this.client.subscribeTicker(symbol);
      this.client.subscribeInstrument(symbol);
    }
    
    // Handle messages
    this.client.on('candle.stick', (msg) => this._handleCandle(msg));
    this.client.on('match', (msg) => this._handleTrade(msg));
    this.client.on('ticker', (msg) => this._handleTicker(msg));
    this.client.on('funding.rate', (msg) => this._handleFunding(msg));
    
    this.running = true;
    this.emit('started', { symbols: this.symbols });
  }

  stop() {
    if (!this.running) return;
    
    this.client.disconnectWs();
    this.running = false;
    this.emit('stopped');
  }

  _handleCandle(msg) {
    const topicParts = msg.topic?.split(':') || [];
    if (topicParts.length < 2) return;
    
    const [symbol, tf] = topicParts[1].split('_');
    const data = msg.data;
    
    if (!this.symbols.includes(symbol)) return;
    
    const candle = {
      ts: Number(data.time) * 1000,
      open: Number(data.open),
      high: Number(data.high),
      low: Number(data.low),
      close: Number(data.close),
      volume: Number(data.volume)
    };
    
    // Update buffer
    const buffer = this.candleBuffers.get(symbol)?.[tf];
    if (buffer) {
      buffer.push(candle);
      if (buffer.length > 500) buffer.shift();
    }
    
    // Update indicators
    const suite = this.indicators.get(symbol)?.[tf];
    if (!suite) return;
    
    const results = updateAll(suite, candle);
    
    // Check for signals on primary TF
    if (tf === this.primaryTF) {
      this._checkSignal(symbol, results);
    }
  }

  _handleTrade(msg) {
    const symbol = msg.data?.symbol;
    if (!symbol || !this.symbols.includes(symbol)) return;
    
    const micro = this.microstructure.get(symbol);
    if (!micro) return;
    
    micro.buySellRatio.processTrade({
      side: msg.data.side,
      size: msg.data.size,
      price: msg.data.price,
      ts: msg.data.ts
    });
  }

  _handleTicker(msg) {
    const symbol = msg.data?.symbol;
    if (!symbol || !this.symbols.includes(symbol)) return;
    
    const micro = this.microstructure.get(symbol);
    if (!micro) return;
    
    micro.priceRatio.update({
      bid: msg.data.bestBidPrice,
      ask: msg.data.bestAskPrice,
      last: msg.data.price
    });
  }

  _handleFunding(msg) {
    const symbol = msg.data?.symbol;
    if (!symbol || !this.symbols.includes(symbol)) return;
    
    const micro = this.microstructure.get(symbol);
    if (!micro) return;
    
    micro.fundingRate.update({
      currentRate: msg.data.fundingFeeRate,
      predictedRate: msg.data.predictedFundingFeeRate,
      nextFundingTime: msg.data.fundingTime
    });
  }

  _checkSignal(symbol, indicatorResults) {
    // Get microstructure results
    const micro = this.microstructure.get(symbol);
    const microResults = {
      buySellRatio: micro?.buySellRatio.getResult(),
      priceRatio: micro?.priceRatio.getResult(),
      fundingRate: micro?.fundingRate.getResult()
    };
    
    // Generate signal
    const signal = this.signalGenerator.generate(indicatorResults, microResults);
    
    // Check threshold
    if (Math.abs(signal.score) < this.signalThreshold) return;
    
    // Check cooldown
    const dedupKey = `${symbol}:${signal.type}`;
    const lastTime = this.lastSignals.get(dedupKey);
    if (lastTime && Date.now() - lastTime < this.cooldownMs) return;
    
    this.lastSignals.set(dedupKey, Date.now());
    
    // Emit signal
    const signalEvent = {
      symbol,
      timeframe: this.primaryTF,
      ...this.signalGenerator.getSummary(signal),
      timestamp: Date.now()
    };
    
    this.emit('signal', signalEvent);
  }

  /**
   * Get current state for symbol
   */
  getSymbolState(symbol) {
    const suite = this.indicators.get(symbol)?.[this.primaryTF];
    const micro = this.microstructure.get(symbol);
    
    if (!suite) return null;
    
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
    
    return {
      symbol,
      indicators: indicatorResults,
      microstructure: microResults,
      signal: this.signalGenerator.generate(indicatorResults, microResults)
    };
  }

  /**
   * Get all current signals
   */
  getAllSignals() {
    const signals = [];
    
    for (const symbol of this.symbols) {
      const state = this.getSymbolState(symbol);
      if (state && Math.abs(state.signal.score) >= this.signalThreshold) {
        signals.push({
          symbol,
          ...this.signalGenerator.getSummary(state.signal)
        });
      }
    }
    
    return signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }
}

module.exports = ScreenerEngine;
