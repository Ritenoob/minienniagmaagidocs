'use strict';

/**
 * Deterministic Backtest Engine
 * 
 * Backtests strategies using historical OHLCV data.
 * ⚠️ Microstructure signals are disabled during backtests.
 * 
 * @module BacktestEngine
 */

const Decimal = require('decimal.js');
const EventEmitter = require('events');
const { createIndicatorSuite, updateAll, disableLiveMode } = require('../indicators');
const SignalGeneratorV2 = require('../lib/SignalGeneratorV2');

// Simulation fees
const SIM_FEES = {
  taker: new Decimal('0.0006'),
  maker: new Decimal('0.0002')
};

class BacktestEngine extends EventEmitter {
  /**
   * @param {Object} config
   * @param {number} [config.initialBalance=10000] - Starting balance
   * @param {number} [config.leverage=5] - Leverage
   * @param {number} [config.riskPercent=2] - Risk per trade
   * @param {number} [config.signalThreshold=50] - Entry threshold
   * @param {number} [config.slROI=3] - Stop loss ROI%
   * @param {number} [config.tpROI=6] - Take profit ROI%
   * @param {boolean} [config.trailingEnabled=true] - Enable trailing
   * @param {number} [config.trailingStep=1] - Trailing step %
   */
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
    
    // State
    this.balance = this.initialBalance;
    this.position = null;
    this.trades = [];
    this.equity = [];
    
    // Indicators (no microstructure)
    this.indicators = createIndicatorSuite();
    disableLiveMode(this.indicators);
    
    this.signalGenerator = new SignalGeneratorV2({
      enhancedMode: true,
      includeMicrostructure: false  // Disabled for backtest
    });
  }

  /**
   * Run backtest on historical data
   * @param {Array} candles - OHLCV candles [{ts,open,high,low,close,volume}]
   * @returns {Object} Results
   */
  run(candles) {
    // Reset state
    this.balance = this.initialBalance;
    this.position = null;
    this.trades = [];
    this.equity = [];
    
    // Reset indicators
    for (const ind of Object.values(this.indicators)) {
      if (typeof ind.reset === 'function') ind.reset();
    }
    
    // Process each candle
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      
      // Update indicators
      const results = updateAll(this.indicators, candle);
      
      // Check exits first (on open)
      if (this.position) {
        const exit = this._checkExit(candle);
        if (exit.shouldExit) {
          this._closePosition(exit.price, exit.reason, candle.ts);
        }
      }
      
      // Update trailing (on close)
      if (this.position && this.trailingEnabled) {
        this._updateTrailing(candle.close);
      }
      
      // Check entries (on close)
      if (!this.position) {
        const signal = this.signalGenerator.generate(results, {});
        
        if (Math.abs(signal.score) >= this.signalThreshold) {
          const side = signal.score > 0 ? 'long' : 'short';
          this._openPosition(candle.close, side, signal, candle.ts);
        }
      }
      
      // Record equity
      this.equity.push({
        ts: candle.ts,
        value: this._calculateEquity(candle.close).toNumber()
      });
    }
    
    // Close any open position at end
    if (this.position) {
      const lastCandle = candles[candles.length - 1];
      this._closePosition(lastCandle.close, 'backtest_end', lastCandle.ts);
    }
    
    return this.getResults();
  }

  _openPosition(price, side, signal, ts) {
    const priceD = new Decimal(price);
    const leverageD = new Decimal(this.leverage);
    
    // Position sizing
    const margin = this.balance.mul(this.riskPercent).div(100);
    const notional = margin.mul(leverageD);
    const size = notional.div(priceD);
    
    // Calculate SL/TP
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
    
    // Fee on entry
    const entryFee = notional.mul(SIM_FEES.taker);
    this.balance = this.balance.minus(entryFee);
    
    this.position = {
      side,
      entryPrice: price,
      size: size.toNumber(),
      margin: margin.toNumber(),
      stopLoss: sl,
      takeProfit: tp,
      originalSL: sl,
      entryTime: ts,
      signal: this.signalGenerator.getSummary(signal)
    };
  }

  _closePosition(price, reason, ts) {
    if (!this.position) return;
    
    const priceD = new Decimal(price);
    const entryD = new Decimal(this.position.entryPrice);
    const sizeD = new Decimal(this.position.size);
    
    // Calculate PnL
    let pnl;
    if (this.position.side === 'long') {
      pnl = priceD.minus(entryD).mul(sizeD);
    } else {
      pnl = entryD.minus(priceD).mul(sizeD);
    }
    
    // Fee on exit
    const exitNotional = priceD.mul(sizeD);
    const exitFee = exitNotional.mul(SIM_FEES.taker);
    pnl = pnl.minus(exitFee);
    
    // Update balance
    this.balance = this.balance.plus(pnl);
    
    // Record trade
    const trade = {
      side: this.position.side,
      entryPrice: this.position.entryPrice,
      exitPrice: price,
      size: this.position.size,
      pnl: pnl.toNumber(),
      pnlPercent: pnl.div(this.position.margin).mul(100).toNumber(),
      reason,
      entryTime: this.position.entryTime,
      exitTime: ts,
      duration: ts - this.position.entryTime,
      signal: this.position.signal
    };
    
    this.trades.push(trade);
    this.position = null;
    
    this.emit('trade', trade);
  }

  _checkExit(candle) {
    if (!this.position) return { shouldExit: false };
    
    const { high, low } = candle;
    const sl = this.position.stopLoss;
    const tp = this.position.takeProfit;
    
    if (this.position.side === 'long') {
      // Check SL first (worst case)
      if (low <= sl) {
        return { shouldExit: true, price: sl, reason: 'stop_loss' };
      }
      // Check TP
      if (high >= tp) {
        return { shouldExit: true, price: tp, reason: 'take_profit' };
      }
    } else {
      // Check SL first (worst case)
      if (high >= sl) {
        return { shouldExit: true, price: sl, reason: 'stop_loss' };
      }
      // Check TP
      if (low <= tp) {
        return { shouldExit: true, price: tp, reason: 'take_profit' };
      }
    }
    
    return { shouldExit: false };
  }

  _updateTrailing(price) {
    if (!this.position) return;
    
    const priceD = new Decimal(price);
    const entry = new Decimal(this.position.entryPrice);
    
    if (this.position.side === 'long') {
      const profitPct = priceD.minus(entry).div(entry);
      const steps = profitPct.div(this.trailingStep).floor();
      
      if (steps.gte(1)) {
        const newSL = entry.mul(Decimal.add(1, steps.minus(1).mul(this.trailingStep))).toNumber();
        if (newSL > this.position.stopLoss) {
          this.position.stopLoss = newSL;
        }
      }
    } else {
      const profitPct = entry.minus(priceD).div(entry);
      const steps = profitPct.div(this.trailingStep).floor();
      
      if (steps.gte(1)) {
        const newSL = entry.mul(Decimal.sub(1, steps.minus(1).mul(this.trailingStep))).toNumber();
        if (newSL < this.position.stopLoss) {
          this.position.stopLoss = newSL;
        }
      }
    }
  }

  _calculateEquity(currentPrice) {
    let equity = this.balance;
    
    if (this.position) {
      const priceD = new Decimal(currentPrice);
      const entryD = new Decimal(this.position.entryPrice);
      const sizeD = new Decimal(this.position.size);
      
      let unrealized;
      if (this.position.side === 'long') {
        unrealized = priceD.minus(entryD).mul(sizeD);
      } else {
        unrealized = entryD.minus(priceD).mul(sizeD);
      }
      
      equity = equity.plus(unrealized);
    }
    
    return equity;
  }

  /**
   * Calculate performance metrics
   */
  getResults() {
    const winners = this.trades.filter(t => t.pnl > 0);
    const losers = this.trades.filter(t => t.pnl <= 0);
    
    const totalPnL = this.trades.reduce((s, t) => s + t.pnl, 0);
    const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
    
    const winRate = this.trades.length > 0 
      ? (winners.length / this.trades.length) * 100 
      : 0;
    
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;
    
    // Sharpe ratio
    const returns = [];
    for (let i = 1; i < this.equity.length; i++) {
      returns.push((this.equity[i].value - this.equity[i-1].value) / this.equity[i-1].value);
    }
    
    const avgReturn = returns.length > 0 
      ? returns.reduce((a, b) => a + b, 0) / returns.length 
      : 0;
    const stdReturn = returns.length > 0
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
      : 1;
    
    const sharpeRatio = stdReturn > 0 ? (avgReturn * Math.sqrt(252 * 24)) / stdReturn : 0;
    
    // Max drawdown
    let maxDD = 0;
    let peak = this.equity[0]?.value || this.initialBalance.toNumber();
    for (const { value } of this.equity) {
      if (value > peak) peak = value;
      const dd = (peak - value) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    
    const totalReturn = ((this.balance.toNumber() - this.initialBalance.toNumber()) / this.initialBalance.toNumber()) * 100;
    
    return {
      summary: {
        initialBalance: this.initialBalance.toNumber(),
        finalBalance: this.balance.toNumber(),
        totalPnL,
        totalReturn: totalReturn.toFixed(2),
        totalTrades: this.trades.length,
        winners: winners.length,
        losers: losers.length,
        winRate: winRate.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        sharpeRatio: sharpeRatio.toFixed(2),
        maxDrawdown: (maxDD * 100).toFixed(2),
        avgWin: winners.length > 0 ? grossProfit / winners.length : 0,
        avgLoss: losers.length > 0 ? grossLoss / losers.length : 0
      },
      trades: this.trades,
      equity: this.equity
    };
  }
}

module.exports = BacktestEngine;
