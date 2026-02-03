'use strict';

/**
 * Paper Trading Engine
 * 
 * Simulates live trading with real-time data for strategy validation.
 * Includes microstructure signals (unlike backtest).
 * 
 * @module PaperTradingEngine
 */

const Decimal = require('decimal.js');
const EventEmitter = require('events');
const SignalGeneratorV2 = require('../lib/SignalGeneratorV2');

class PaperTradingEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.initialBalance = new Decimal(config.initialBalance || 10000);
    this.leverage = config.leverage || 5;
    this.riskPercent = new Decimal(config.riskPercent || 2);
    this.signalThreshold = config.signalThreshold || 50;
    this.slROI = config.slROI || 3;
    this.tpROI = config.tpROI || 6;
    this.trailingEnabled = config.trailingEnabled !== false;
    this.trailingStep = new Decimal(config.trailingStep || 1).div(100);
    this.maxPositions = config.maxPositions || 3;
    
    // Microstructure filters
    this.maxSpread = config.maxSpread || 0.03;
    this.maxFunding = config.maxFunding || 0.02;
    
    this.balance = this.initialBalance;
    this.positions = new Map();
    this.trades = [];
    this.equity = [];
    this.stats = { filtered: 0, microBoosts: 0 };
    
    this.signalGenerator = new SignalGeneratorV2({
      enhancedMode: true,
      includeMicrostructure: true
    });
    
    this.running = false;
  }

  start() {
    this.running = true;
    this.emit('started');
  }

  stop() {
    this.running = false;
    this.emit('stopped');
  }

  processUpdate(symbol, candle, indicators, microstructure = {}) {
    if (!this.running) return;
    
    // Check exits
    if (this.positions.has(symbol)) {
      const pos = this.positions.get(symbol);
      const exit = this._checkExit(pos, candle);
      if (exit.shouldExit) {
        this._closePosition(symbol, exit.price, exit.reason);
      } else if (this.trailingEnabled) {
        this._updateTrailing(symbol, candle.close);
      }
    }
    
    // Check entries
    if (!this.positions.has(symbol) && this.positions.size < this.maxPositions) {
      // Microstructure filter
      if (!this._checkMicroFilter(microstructure)) {
        this.stats.filtered++;
        return;
      }
      
      const signal = this.signalGenerator.generate(indicators, microstructure);
      
      if (Math.abs(signal.score) >= this.signalThreshold) {
        if (this.signalGenerator.hasEntryWarning(signal)) {
          this.stats.filtered++;
          return;
        }
        
        const side = signal.score > 0 ? 'long' : 'short';
        this._openPosition(symbol, candle.close, side, signal, microstructure);
      }
    }
    
    // Record equity
    this.equity.push({
      ts: Date.now(),
      value: this._calculateEquity(symbol, candle.close).toNumber()
    });
  }

  _checkMicroFilter(micro) {
    const spread = micro.priceRatio?.value?.spread;
    if (spread && spread > this.maxSpread) return false;
    
    const funding = micro.fundingRate?.value?.currentRate;
    if (funding && Math.abs(funding) > this.maxFunding * 100) return false;
    
    return true;
  }

  _openPosition(symbol, price, side, signal, micro) {
    const priceD = new Decimal(price);
    const leverageD = new Decimal(this.leverage);
    
    // Position sizing
    let sizeMultiplier = new Decimal(1);
    if (signal.hasMicrostructure && signal.confidence > 70) {
      sizeMultiplier = new Decimal(1.2);
      this.stats.microBoosts++;
    }
    
    const margin = this.balance.mul(this.riskPercent).div(100).mul(sizeMultiplier);
    const notional = margin.mul(leverageD);
    const size = notional.div(priceD);
    
    // SL/TP
    const slAdj = new Decimal(this.slROI).div(leverageD).div(100);
    const tpAdj = new Decimal(this.tpROI).div(leverageD).div(100);
    
    let sl, tp;
    if (side === 'long') {
      sl = priceD.mul(Decimal.sub(1, slAdj)).toNumber();
      tp = priceD.mul(Decimal.add(1, tpAdj)).toNumber();
    } else {
      sl = priceD.mul(Decimal.add(1, slAdj)).toNumber();
      tp = priceD.mul(Decimal.sub(1, tpAdj)).toNumber();
    }
    
    this.positions.set(symbol, {
      side,
      entryPrice: price,
      size: size.toNumber(),
      margin: margin.toNumber(),
      stopLoss: sl,
      takeProfit: tp,
      entryTime: Date.now(),
      signal: this.signalGenerator.getSummary(signal),
      hasMicro: signal.hasMicrostructure
    });
    
    this.emit('position_opened', { symbol, side, price });
  }

  _closePosition(symbol, price, reason) {
    const pos = this.positions.get(symbol);
    if (!pos) return;
    
    const priceD = new Decimal(price);
    const entryD = new Decimal(pos.entryPrice);
    const sizeD = new Decimal(pos.size);
    
    let pnl;
    if (pos.side === 'long') {
      pnl = priceD.minus(entryD).mul(sizeD);
    } else {
      pnl = entryD.minus(priceD).mul(sizeD);
    }
    
    // Simulated fees
    const fee = priceD.mul(sizeD).mul('0.0012');
    pnl = pnl.minus(fee);
    
    this.balance = this.balance.plus(pnl);
    
    const trade = {
      symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: price,
      pnl: pnl.toNumber(),
      pnlPercent: pnl.div(pos.margin).mul(100).toNumber(),
      reason,
      entryTime: pos.entryTime,
      exitTime: Date.now(),
      hasMicro: pos.hasMicro
    };
    
    this.trades.push(trade);
    this.positions.delete(symbol);
    
    this.emit('position_closed', trade);
  }

  _checkExit(pos, candle) {
    if (pos.side === 'long') {
      if (candle.low <= pos.stopLoss) return { shouldExit: true, price: pos.stopLoss, reason: 'stop_loss' };
      if (candle.high >= pos.takeProfit) return { shouldExit: true, price: pos.takeProfit, reason: 'take_profit' };
    } else {
      if (candle.high >= pos.stopLoss) return { shouldExit: true, price: pos.stopLoss, reason: 'stop_loss' };
      if (candle.low <= pos.takeProfit) return { shouldExit: true, price: pos.takeProfit, reason: 'take_profit' };
    }
    return { shouldExit: false };
  }

  _updateTrailing(symbol, price) {
    const pos = this.positions.get(symbol);
    if (!pos) return;
    
    const priceD = new Decimal(price);
    const entry = new Decimal(pos.entryPrice);
    
    if (pos.side === 'long') {
      const profit = priceD.minus(entry).div(entry);
      const steps = profit.div(this.trailingStep).floor();
      if (steps.gte(1)) {
        const newSL = entry.mul(Decimal.add(1, steps.minus(1).mul(this.trailingStep))).toNumber();
        if (newSL > pos.stopLoss) pos.stopLoss = newSL;
      }
    } else {
      const profit = entry.minus(priceD).div(entry);
      const steps = profit.div(this.trailingStep).floor();
      if (steps.gte(1)) {
        const newSL = entry.mul(Decimal.sub(1, steps.minus(1).mul(this.trailingStep))).toNumber();
        if (newSL < pos.stopLoss) pos.stopLoss = newSL;
      }
    }
  }

  _calculateEquity(symbol, price) {
    let equity = this.balance;
    
    for (const [sym, pos] of this.positions) {
      const currentPrice = sym === symbol ? price : pos.entryPrice;
      const priceD = new Decimal(currentPrice);
      const entryD = new Decimal(pos.entryPrice);
      const sizeD = new Decimal(pos.size);
      
      let unrealized;
      if (pos.side === 'long') {
        unrealized = priceD.minus(entryD).mul(sizeD);
      } else {
        unrealized = entryD.minus(priceD).mul(sizeD);
      }
      equity = equity.plus(unrealized);
    }
    
    return equity;
  }

  getResults() {
    const winners = this.trades.filter(t => t.pnl > 0);
    const losers = this.trades.filter(t => t.pnl <= 0);
    const microTrades = this.trades.filter(t => t.hasMicro);
    const microWinners = microTrades.filter(t => t.pnl > 0);
    
    const winRate = this.trades.length > 0 ? (winners.length / this.trades.length) * 100 : 0;
    const microWinRate = microTrades.length > 0 ? (microWinners.length / microTrades.length) * 100 : 0;
    
    const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
    
    const totalReturn = this.balance.minus(this.initialBalance).div(this.initialBalance).mul(100).toNumber();
    
    return {
      balance: this.balance.toNumber(),
      totalReturn: totalReturn.toFixed(2),
      totalTrades: this.trades.length,
      winRate: winRate.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      microstructureWinRate: microWinRate.toFixed(2),
      filteredEntries: this.stats.filtered,
      microBoosts: this.stats.microBoosts,
      trades: this.trades
    };
  }
}

module.exports = PaperTradingEngine;
