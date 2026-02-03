'use strict';

/**
 * Position Manager
 * 
 * Handles position sizing, entry/exit, and lifecycle management.
 * All calculations are leverage-aware with fee-adjusted break-even.
 * 
 * @module PositionManager
 */

const Decimal = require('decimal.js');
const EventEmitter = require('events');

// Fee structure (KuCoin Futures)
const FEES = {
  taker: new Decimal('0.0006'),  // 0.06%
  maker: new Decimal('0.0002')   // 0.02%
};

class PositionManager extends EventEmitter {
  /**
   * @param {Object} config
   * @param {Object} config.client - KuCoin client instance
   * @param {number} [config.maxRiskPercent=2] - Max risk per trade
   * @param {number} [config.maxPositions=3] - Max concurrent positions
   * @param {number} [config.defaultLeverage=5] - Default leverage
   * @param {boolean} [config.useMaker=false] - Use maker orders
   */
  constructor(config = {}) {
    super();
    
    this.client = config.client;
    this.maxRiskPercent = new Decimal(config.maxRiskPercent || 2);
    this.maxPositions = config.maxPositions || 3;
    this.defaultLeverage = config.defaultLeverage || 5;
    this.useMaker = config.useMaker || false;
    
    // Positions state
    this.positions = new Map();
    this.orders = new Map();
    
    // Contract specs cache
    this.contracts = new Map();
    
    // Account state
    this.balance = new Decimal(0);
    this.equity = new Decimal(0);
  }

  /**
   * Load contract specifications
   */
  async loadContract(symbol) {
    if (this.contracts.has(symbol)) {
      return this.contracts.get(symbol);
    }
    
    const contract = await this.client.getContract(symbol);
    this.contracts.set(symbol, contract);
    return contract;
  }

  /**
   * Update account balance
   */
  async updateAccount() {
    const account = await this.client.getAccountOverview('USDT');
    this.balance = new Decimal(account.availableBalance || 0);
    this.equity = new Decimal(account.accountEquity || 0);
    return { balance: this.balance.toNumber(), equity: this.equity.toNumber() };
  }

  /**
   * Calculate position size
   * 
   * Formula:
   * marginUsed = balance × (riskPercent / 100)
   * notional = marginUsed × leverage
   * size = floor(notional / (price × multiplier) / lotSize) × lotSize
   */
  calculatePositionSize(price, leverage, contract, riskPercent = null) {
    const risk = riskPercent 
      ? new Decimal(riskPercent) 
      : this.maxRiskPercent;
    
    const priceD = new Decimal(price);
    const leverageD = new Decimal(leverage);
    const multiplier = new Decimal(contract.multiplier);
    const lotSize = new Decimal(contract.lotSize);
    
    // Margin used = balance × risk%
    const marginUsed = this.balance.mul(risk).div(100);
    
    // Notional = margin × leverage
    const notional = marginUsed.mul(leverageD);
    
    // Size in lots
    const rawSize = notional.div(priceD.mul(multiplier));
    const size = rawSize.div(lotSize).floor().mul(lotSize);
    
    // Validate against limits
    const minSize = new Decimal(contract.lotSize);
    const maxSize = new Decimal(contract.maxOrderQty || 1000000);
    
    const finalSize = Decimal.max(minSize, Decimal.min(size, maxSize));
    
    return {
      size: finalSize.toNumber(),
      margin: marginUsed.toNumber(),
      notional: finalSize.mul(priceD).mul(multiplier).toNumber(),
      leverage: leverageD.toNumber()
    };
  }

  /**
   * Calculate fee-adjusted break-even ROI
   * 
   * Formula: BE_ROI = (entryFee + exitFee) × leverage × 100 + buffer
   */
  calculateBreakEvenROI(leverage, buffer = 0.1) {
    const fee = this.useMaker ? FEES.maker : FEES.taker;
    const totalFees = fee.mul(2);  // Entry + exit
    const beROI = totalFees.mul(leverage).mul(100).plus(buffer);
    return beROI.toNumber();
  }

  /**
   * Calculate stop loss price
   * 
   * LONG: SL = entry × (1 - (SL_ROI / leverage / 100))
   * SHORT: SL = entry × (1 + (SL_ROI / leverage / 100))
   */
  calculateStopLoss(entry, leverage, slROI, side) {
    const entryD = new Decimal(entry);
    const leverageD = new Decimal(leverage);
    const slROID = new Decimal(slROI);
    
    const adjustment = slROID.div(leverageD).div(100);
    
    if (side === 'long') {
      return entryD.mul(Decimal.sub(1, adjustment)).toNumber();
    } else {
      return entryD.mul(Decimal.add(1, adjustment)).toNumber();
    }
  }

  /**
   * Calculate take profit price
   * 
   * LONG: TP = entry × (1 + (TP_ROI / leverage / 100))
   * SHORT: TP = entry × (1 - (TP_ROI / leverage / 100))
   */
  calculateTakeProfit(entry, leverage, tpROI, side) {
    const entryD = new Decimal(entry);
    const leverageD = new Decimal(leverage);
    const tpROID = new Decimal(tpROI);
    
    const adjustment = tpROID.div(leverageD).div(100);
    
    if (side === 'long') {
      return entryD.mul(Decimal.add(1, adjustment)).toNumber();
    } else {
      return entryD.mul(Decimal.sub(1, adjustment)).toNumber();
    }
  }

  /**
   * Calculate liquidation price
   * 
   * LONG: liq = entry × (1 - (1/leverage) × (1 - maintMargin))
   * SHORT: liq = entry × (1 + (1/leverage) × (1 - maintMargin))
   */
  calculateLiquidationPrice(entry, leverage, maintMargin, side) {
    const entryD = new Decimal(entry);
    const leverageD = new Decimal(leverage);
    const maintD = new Decimal(maintMargin);
    
    const factor = Decimal.div(1, leverageD).mul(Decimal.sub(1, maintD));
    
    if (side === 'long') {
      return entryD.mul(Decimal.sub(1, factor)).toNumber();
    } else {
      return entryD.mul(Decimal.add(1, factor)).toNumber();
    }
  }

  /**
   * Calculate current PnL
   */
  calculatePnL(entry, current, size, side, multiplier) {
    const entryD = new Decimal(entry);
    const currentD = new Decimal(current);
    const sizeD = new Decimal(size);
    const multD = new Decimal(multiplier);
    
    const priceDiff = side === 'long' 
      ? currentD.minus(entryD)
      : entryD.minus(currentD);
    
    const pnl = priceDiff.mul(sizeD).mul(multD);
    const pnlPercent = priceDiff.div(entryD).mul(100);
    
    return {
      pnl: pnl.toNumber(),
      pnlPercent: pnlPercent.toNumber()
    };
  }

  /**
   * Open position
   */
  async openPosition(params) {
    const { symbol, side, price, leverage, slROI, tpROI, signal } = params;
    
    // Check position limit
    if (this.positions.size >= this.maxPositions) {
      throw new Error(`Max positions (${this.maxPositions}) reached`);
    }
    
    // Check for existing position
    if (this.positions.has(symbol)) {
      throw new Error(`Position already exists for ${symbol}`);
    }
    
    // Load contract
    const contract = await this.loadContract(symbol);
    await this.updateAccount();
    
    // Calculate size
    const sizing = this.calculatePositionSize(price, leverage, contract);
    
    // Calculate SL/TP
    const sl = this.calculateStopLoss(price, leverage, slROI, side);
    const tp = this.calculateTakeProfit(price, leverage, tpROI, side);
    const liq = this.calculateLiquidationPrice(price, leverage, contract.maintMarginRate, side);
    const beROI = this.calculateBreakEvenROI(leverage);
    
    // Create order
    const order = {
      clientOid: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side: side === 'long' ? 'buy' : 'sell',
      type: this.useMaker ? 'limit' : 'market',
      size: sizing.size,
      leverage,
      ...(this.useMaker ? { price } : {})
    };
    
    // Place order
    const result = await this.client.placeOrder(order);
    
    // Store position
    const position = {
      id: result.orderId,
      symbol,
      side,
      entryPrice: price,
      size: sizing.size,
      leverage,
      margin: sizing.margin,
      notional: sizing.notional,
      stopLoss: sl,
      takeProfit: tp,
      liquidation: liq,
      breakEvenROI: beROI,
      slROI,
      tpROI,
      signal,
      openTime: Date.now(),
      status: 'open'
    };
    
    this.positions.set(symbol, position);
    this.emit('position_opened', position);
    
    return position;
  }

  /**
   * Close position
   */
  async closePosition(symbol, reason = 'manual') {
    const position = this.positions.get(symbol);
    if (!position) {
      throw new Error(`No position for ${symbol}`);
    }
    
    // Create close order
    const order = {
      clientOid: `close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      type: 'market',
      size: position.size,
      reduceOnly: true
    };
    
    const result = await this.client.placeOrder(order);
    
    // Update position
    position.status = 'closed';
    position.closeTime = Date.now();
    position.closeReason = reason;
    
    this.positions.delete(symbol);
    this.emit('position_closed', position);
    
    return position;
  }

  /**
   * Update trailing stop
   * 
   * Staircase logic: never "untrail" - only move in profit direction
   */
  updateTrailingStop(symbol, currentPrice, stepPercent = 1) {
    const position = this.positions.get(symbol);
    if (!position) return null;
    
    const priceD = new Decimal(currentPrice);
    const entry = new Decimal(position.entryPrice);
    const step = new Decimal(stepPercent).div(100);
    
    if (position.side === 'long') {
      // Long: move SL up as price goes up
      const profitPercent = priceD.minus(entry).div(entry);
      const steps = profitPercent.div(step).floor();
      
      if (steps.gte(1)) {
        const newSL = entry.mul(Decimal.add(1, steps.minus(1).mul(step)));
        
        // Never move SL down
        if (newSL.gt(position.stopLoss)) {
          position.stopLoss = newSL.toNumber();
          position.trailingActive = true;
          this.emit('trailing_updated', { symbol, stopLoss: position.stopLoss });
        }
      }
    } else {
      // Short: move SL down as price goes down
      const profitPercent = entry.minus(priceD).div(entry);
      const steps = profitPercent.div(step).floor();
      
      if (steps.gte(1)) {
        const newSL = entry.mul(Decimal.sub(1, steps.minus(1).mul(step)));
        
        // Never move SL up
        if (newSL.lt(position.stopLoss)) {
          position.stopLoss = newSL.toNumber();
          position.trailingActive = true;
          this.emit('trailing_updated', { symbol, stopLoss: position.stopLoss });
        }
      }
    }
    
    return position;
  }

  /**
   * Check stop loss / take profit
   */
  checkExits(symbol, currentPrice) {
    const position = this.positions.get(symbol);
    if (!position) return null;
    
    const price = new Decimal(currentPrice);
    
    if (position.side === 'long') {
      if (price.lte(position.stopLoss)) {
        return { exit: true, reason: 'stop_loss', price: currentPrice };
      }
      if (price.gte(position.takeProfit)) {
        return { exit: true, reason: 'take_profit', price: currentPrice };
      }
    } else {
      if (price.gte(position.stopLoss)) {
        return { exit: true, reason: 'stop_loss', price: currentPrice };
      }
      if (price.lte(position.takeProfit)) {
        return { exit: true, reason: 'take_profit', price: currentPrice };
      }
    }
    
    return { exit: false };
  }

  /**
   * Get position summary
   */
  getPositionSummary(symbol, currentPrice) {
    const position = this.positions.get(symbol);
    if (!position) return null;
    
    const contract = this.contracts.get(symbol);
    const pnl = this.calculatePnL(
      position.entryPrice,
      currentPrice,
      position.size,
      position.side,
      contract?.multiplier || 1
    );
    
    return {
      ...position,
      currentPrice,
      ...pnl,
      duration: Date.now() - position.openTime
    };
  }

  /**
   * Get all positions
   */
  getAllPositions() {
    return Array.from(this.positions.values());
  }
}

module.exports = PositionManager;
