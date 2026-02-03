/**
 * DecimalMath - Precision-safe financial mathematics
 * 
 * All financial calculations MUST use this module to avoid floating-point errors.
 * Uses decimal.js for arbitrary precision decimal arithmetic.
 * 
 * @module DecimalMath
 */

const Decimal = require('decimal.js');

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 20
});

/**
 * Create a Decimal from any numeric input
 * @param {number|string|Decimal} value 
 * @returns {Decimal}
 */
function D(value) {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value);
}

/**
 * Position Sizing Calculations
 */
const PositionSizing = {
  /**
   * Calculate position size in contracts
   * 
   * Formula: size = floor((balance * positionPercent / 100 * leverage) / (price * multiplier) / lotSize) * lotSize
   * 
   * @param {number} balance - Account balance in quote currency
   * @param {number} positionPercent - Percentage of balance to use (e.g., 2 for 2%)
   * @param {number} price - Entry price
   * @param {number} leverage - Position leverage
   * @param {number} multiplier - Contract multiplier
   * @param {number} lotSize - Minimum lot size
   * @returns {number} Position size rounded to lot size
   */
  calculateSize(balance, positionPercent, price, leverage, multiplier, lotSize) {
    const margin = D(balance).mul(positionPercent).div(100);
    const notional = margin.mul(leverage);
    const rawSize = notional.div(D(price).mul(multiplier));
    const size = rawSize.div(lotSize).floor().mul(lotSize);
    return size.toNumber();
  },

  /**
   * Calculate notional value of a position
   * 
   * @param {number} size - Position size in contracts
   * @param {number} price - Current price
   * @param {number} multiplier - Contract multiplier
   * @returns {number} Notional value
   */
  calculateNotional(size, price, multiplier) {
    return D(size).mul(price).mul(multiplier).toNumber();
  },

  /**
   * Calculate required margin for a position
   * 
   * @param {number} notional - Position notional value
   * @param {number} leverage - Position leverage
   * @returns {number} Required margin
   */
  calculateMargin(notional, leverage) {
    return D(notional).div(leverage).toNumber();
  },

  /**
   * Calculate inverse leverage-scaled risk
   * At higher leverage, risk is scaled down proportionally
   * 
   * @param {number} baseRisk - Base risk percentage
   * @param {number} leverage - Current leverage
   * @returns {number} Scaled risk percentage
   */
  calculateInverseScaledRisk(baseRisk, leverage) {
    return D(baseRisk).mul(100).div(leverage).toNumber();
  }
};

/**
 * ROI Calculations
 */
const ROI = {
  /**
   * Calculate current ROI for a long position
   * 
   * Formula: ROI = ((currentPrice - entryPrice) / entryPrice) * leverage * 100
   * 
   * @param {number} entryPrice 
   * @param {number} currentPrice 
   * @param {number} leverage 
   * @returns {number} ROI as percentage
   */
  calculateLong(entryPrice, currentPrice, leverage) {
    const priceDelta = D(currentPrice).sub(entryPrice);
    const percentChange = priceDelta.div(entryPrice).mul(100);
    return percentChange.mul(leverage).toNumber();
  },

  /**
   * Calculate current ROI for a short position
   * 
   * Formula: ROI = ((entryPrice - currentPrice) / entryPrice) * leverage * 100
   * 
   * @param {number} entryPrice 
   * @param {number} currentPrice 
   * @param {number} leverage 
   * @returns {number} ROI as percentage
   */
  calculateShort(entryPrice, currentPrice, leverage) {
    const priceDelta = D(entryPrice).sub(currentPrice);
    const percentChange = priceDelta.div(entryPrice).mul(100);
    return percentChange.mul(leverage).toNumber();
  },

  /**
   * Calculate ROI for any direction
   * 
   * @param {number} entryPrice 
   * @param {number} currentPrice 
   * @param {number} leverage 
   * @param {'long'|'short'} direction 
   * @returns {number} ROI as percentage
   */
  calculate(entryPrice, currentPrice, leverage, direction) {
    return direction === 'long'
      ? this.calculateLong(entryPrice, currentPrice, leverage)
      : this.calculateShort(entryPrice, currentPrice, leverage);
  },

  /**
   * Calculate fee-adjusted break-even ROI
   * 
   * Formula: BE_ROI = (takerFee * 2) * leverage * 100 + buffer
   * 
   * @param {number} leverage - Position leverage
   * @param {number} takerFee - Taker fee rate (e.g., 0.0006 for 0.06%)
   * @param {number} buffer - Safety buffer (default 0.05%)
   * @returns {number} Break-even ROI as percentage
   */
  calculateBreakEven(leverage, takerFee = 0.0006, buffer = 0.05) {
    const totalFees = D(takerFee).mul(2); // Entry + Exit
    const feeImpact = totalFees.mul(leverage).mul(100);
    return feeImpact.add(buffer).toNumber();
  }
};

/**
 * Stop Loss & Take Profit Calculations
 */
const StopLoss = {
  /**
   * Calculate stop loss price for a long position
   * 
   * Formula: SL_price = entry * (1 - (SL_ROI / leverage / 100))
   * 
   * @param {number} entryPrice 
   * @param {number} stopLossROI - Stop loss ROI percentage (positive number)
   * @param {number} leverage 
   * @returns {number} Stop loss price
   */
  calculatePriceLong(entryPrice, stopLossROI, leverage) {
    const priceMovement = D(stopLossROI).div(leverage).div(100);
    return D(entryPrice).mul(D(1).sub(priceMovement)).toNumber();
  },

  /**
   * Calculate stop loss price for a short position
   * 
   * Formula: SL_price = entry * (1 + (SL_ROI / leverage / 100))
   * 
   * @param {number} entryPrice 
   * @param {number} stopLossROI - Stop loss ROI percentage (positive number)
   * @param {number} leverage 
   * @returns {number} Stop loss price
   */
  calculatePriceShort(entryPrice, stopLossROI, leverage) {
    const priceMovement = D(stopLossROI).div(leverage).div(100);
    return D(entryPrice).mul(D(1).add(priceMovement)).toNumber();
  },

  /**
   * Calculate stop loss price for any direction
   * 
   * @param {number} entryPrice 
   * @param {number} stopLossROI 
   * @param {number} leverage 
   * @param {'long'|'short'} direction 
   * @returns {number} Stop loss price
   */
  calculatePrice(entryPrice, stopLossROI, leverage, direction) {
    return direction === 'long'
      ? this.calculatePriceLong(entryPrice, stopLossROI, leverage)
      : this.calculatePriceShort(entryPrice, stopLossROI, leverage);
  }
};

/**
 * Take Profit Calculations
 */
const TakeProfit = {
  /**
   * Calculate take profit price for a long position
   * 
   * Formula: TP_price = entry * (1 + (TP_ROI / leverage / 100))
   * 
   * @param {number} entryPrice 
   * @param {number} takeProfitROI 
   * @param {number} leverage 
   * @returns {number} Take profit price
   */
  calculatePriceLong(entryPrice, takeProfitROI, leverage) {
    const priceMovement = D(takeProfitROI).div(leverage).div(100);
    return D(entryPrice).mul(D(1).add(priceMovement)).toNumber();
  },

  /**
   * Calculate take profit price for a short position
   * 
   * Formula: TP_price = entry * (1 - (TP_ROI / leverage / 100))
   * 
   * @param {number} entryPrice 
   * @param {number} takeProfitROI 
   * @param {number} leverage 
   * @returns {number} Take profit price
   */
  calculatePriceShort(entryPrice, takeProfitROI, leverage) {
    const priceMovement = D(takeProfitROI).div(leverage).div(100);
    return D(entryPrice).mul(D(1).sub(priceMovement)).toNumber();
  },

  /**
   * Calculate take profit price for any direction
   * 
   * @param {number} entryPrice 
   * @param {number} takeProfitROI 
   * @param {number} leverage 
   * @param {'long'|'short'} direction 
   * @returns {number} Take profit price
   */
  calculatePrice(entryPrice, takeProfitROI, leverage, direction) {
    return direction === 'long'
      ? this.calculatePriceLong(entryPrice, takeProfitROI, leverage)
      : this.calculatePriceShort(entryPrice, takeProfitROI, leverage);
  }
};

/**
 * Liquidation Price Calculations
 */
const Liquidation = {
  /**
   * Calculate liquidation price for a long position (isolated margin)
   * 
   * Formula: liq = entry * (1 - (1/leverage) * (1 - maintMargin))
   * 
   * @param {number} entryPrice 
   * @param {number} leverage 
   * @param {number} maintMarginRate - Maintenance margin rate (e.g., 0.005 for 0.5%)
   * @returns {number} Liquidation price
   */
  calculatePriceLong(entryPrice, leverage, maintMarginRate = 0.005) {
    const factor = D(1).div(leverage).mul(D(1).sub(maintMarginRate));
    return D(entryPrice).mul(D(1).sub(factor)).toNumber();
  },

  /**
   * Calculate liquidation price for a short position (isolated margin)
   * 
   * Formula: liq = entry * (1 + (1/leverage) * (1 - maintMargin))
   * 
   * @param {number} entryPrice 
   * @param {number} leverage 
   * @param {number} maintMarginRate 
   * @returns {number} Liquidation price
   */
  calculatePriceShort(entryPrice, leverage, maintMarginRate = 0.005) {
    const factor = D(1).div(leverage).mul(D(1).sub(maintMarginRate));
    return D(entryPrice).mul(D(1).add(factor)).toNumber();
  },

  /**
   * Calculate liquidation price for any direction
   * 
   * @param {number} entryPrice 
   * @param {number} leverage 
   * @param {'long'|'short'} direction 
   * @param {number} maintMarginRate 
   * @returns {number} Liquidation price
   */
  calculatePrice(entryPrice, leverage, direction, maintMarginRate = 0.005) {
    return direction === 'long'
      ? this.calculatePriceLong(entryPrice, leverage, maintMarginRate)
      : this.calculatePriceShort(entryPrice, leverage, maintMarginRate);
  },

  /**
   * Calculate buffer percentage from liquidation
   * 
   * @param {number} currentPrice 
   * @param {number} liquidationPrice 
   * @param {'long'|'short'} direction 
   * @returns {number} Buffer as percentage
   */
  calculateBuffer(currentPrice, liquidationPrice, direction) {
    if (direction === 'long') {
      return D(currentPrice).sub(liquidationPrice).div(currentPrice).mul(100).toNumber();
    } else {
      return D(liquidationPrice).sub(currentPrice).div(currentPrice).mul(100).toNumber();
    }
  }
};

/**
 * Trailing Stop Calculations (Staircase Logic)
 */
const TrailingStop = {
  /**
   * Update trailing stop with staircase logic
   * CRITICAL: Never untrail - only move stop in favorable direction
   * 
   * @param {Object} params
   * @param {number} params.entryPrice
   * @param {number} params.currentPrice
   * @param {number} params.currentStopPrice
   * @param {number} params.leverage
   * @param {'long'|'short'} params.direction
   * @param {number} params.activationROI - ROI threshold to activate trailing
   * @param {number} params.trailDistance - Distance to trail behind peak ROI
   * @param {number} params.stepSize - Step size for staircase
   * @returns {{ updated: boolean, stopPrice: number, level?: number }}
   */
  update(params) {
    const {
      entryPrice,
      currentPrice,
      currentStopPrice,
      leverage,
      direction,
      activationROI,
      trailDistance,
      stepSize
    } = params;

    // Calculate current ROI
    const currentROI = ROI.calculate(entryPrice, currentPrice, leverage, direction);

    // Not activated yet
    if (currentROI < activationROI) {
      return { updated: false, stopPrice: currentStopPrice };
    }

    // Calculate staircase level
    const level = D(currentROI).div(stepSize).floor().mul(stepSize);
    const trailROI = level.sub(trailDistance);

    // Calculate new stop price
    let newStopPrice;
    if (direction === 'long') {
      const movement = trailROI.div(leverage).div(100);
      newStopPrice = D(entryPrice).mul(D(1).add(movement)).toNumber();
    } else {
      const movement = trailROI.div(leverage).div(100);
      newStopPrice = D(entryPrice).mul(D(1).sub(movement)).toNumber();
    }

    // CRITICAL: Never untrail - only move stop in favorable direction
    if (direction === 'long' && newStopPrice <= currentStopPrice) {
      return { updated: false, stopPrice: currentStopPrice };
    }
    if (direction === 'short' && newStopPrice >= currentStopPrice) {
      return { updated: false, stopPrice: currentStopPrice };
    }

    return { 
      updated: true, 
      stopPrice: newStopPrice, 
      level: level.toNumber(),
      roiAtStop: trailROI.toNumber()
    };
  }
};

/**
 * Auto Leverage Calculation based on Volatility
 */
const AutoLeverage = {
  /**
   * Calculate recommended leverage based on ATR%
   * 
   * @param {number} atrPercent - ATR as percentage of price
   * @param {Object} tiers - Volatility tiers configuration
   * @returns {number} Recommended leverage
   */
  calculate(atrPercent, tiers = null) {
    const defaultTiers = [
      { maxVol: 0.3, leverage: 100 },
      { maxVol: 0.5, leverage: 75 },
      { maxVol: 1.0, leverage: 50 },
      { maxVol: 2.0, leverage: 25 },
      { maxVol: 3.0, leverage: 10 },
      { maxVol: 5.0, leverage: 5 },
      { maxVol: Infinity, leverage: 3 }
    ];

    const useTiers = tiers || defaultTiers;

    for (const tier of useTiers) {
      if (atrPercent <= tier.maxVol) {
        return tier.leverage;
      }
    }

    return 3; // Minimum safe leverage
  }
};

/**
 * Performance Metrics Calculations
 */
const Metrics = {
  /**
   * Calculate win rate from trades
   * 
   * @param {Array<{pnl: number}>} trades 
   * @returns {number} Win rate as percentage
   */
  winRate(trades) {
    if (trades.length === 0) return 0;
    const wins = trades.filter(t => t.pnl > 0).length;
    return (wins / trades.length) * 100;
  },

  /**
   * Calculate profit factor
   * 
   * @param {Array<{pnl: number}>} trades 
   * @returns {number} Profit factor (grossProfit / grossLoss)
   */
  profitFactor(trades) {
    const grossProfit = trades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
    if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
    return grossProfit / grossLoss;
  },

  /**
   * Calculate Sharpe Ratio (annualized)
   * 
   * @param {number[]} returns - Array of period returns
   * @param {number} riskFreeRate - Risk-free rate (default 0)
   * @returns {number} Sharpe ratio
   */
  sharpeRatio(returns, riskFreeRate = 0) {
    if (returns.length < 2) return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    return ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252);
  },

  /**
   * Calculate Sortino Ratio (downside-only volatility)
   * 
   * @param {number[]} returns 
   * @param {number} targetReturn 
   * @returns {number} Sortino ratio
   */
  sortinoRatio(returns, targetReturn = 0) {
    if (returns.length < 2) return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < targetReturn);
    if (downsideReturns.length === 0) return Infinity;
    const downsideVariance = downsideReturns.reduce((a, r) => a + Math.pow(r - targetReturn, 2), 0) / downsideReturns.length;
    const downsideStd = Math.sqrt(downsideVariance);
    if (downsideStd === 0) return Infinity;
    return ((avgReturn - targetReturn) / downsideStd) * Math.sqrt(252);
  },

  /**
   * Calculate maximum drawdown
   * 
   * @param {number[]} equityCurve - Array of equity values
   * @returns {number} Maximum drawdown as percentage
   */
  maxDrawdown(equityCurve) {
    if (equityCurve.length === 0) return 0;
    let peak = equityCurve[0];
    let maxDD = 0;

    for (const equity of equityCurve) {
      if (equity > peak) peak = equity;
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDD) maxDD = drawdown;
    }

    return maxDD * 100;
  },

  /**
   * Calculate expected value per trade
   * 
   * @param {number} winRate - Win rate as percentage
   * @param {number} avgWin - Average winning trade value
   * @param {number} avgLoss - Average losing trade value (positive number)
   * @returns {number} Expected value per trade
   */
  expectedValue(winRate, avgWin, avgLoss) {
    const winRateDecimal = winRate / 100;
    return (winRateDecimal * avgWin) - ((1 - winRateDecimal) * Math.abs(avgLoss));
  },

  /**
   * Calculate Calmar Ratio (return / max drawdown)
   * 
   * @param {number} annualReturn - Annualized return percentage
   * @param {number} maxDrawdown - Maximum drawdown percentage
   * @returns {number} Calmar ratio
   */
  calmarRatio(annualReturn, maxDrawdown) {
    if (maxDrawdown === 0) return annualReturn > 0 ? Infinity : 0;
    return annualReturn / maxDrawdown;
  }
};

/**
 * Price rounding utilities
 */
const PriceUtils = {
  /**
   * Round price to tick size
   * 
   * @param {number} price 
   * @param {number} tickSize 
   * @returns {number} Rounded price
   */
  roundToTick(price, tickSize) {
    return D(price).div(tickSize).round().mul(tickSize).toNumber();
  },

  /**
   * Round size to lot size
   * 
   * @param {number} size 
   * @param {number} lotSize 
   * @returns {number} Rounded size
   */
  roundToLot(size, lotSize) {
    return D(size).div(lotSize).floor().mul(lotSize).toNumber();
  },

  /**
   * Format price with appropriate decimals
   * 
   * @param {number} price 
   * @param {number} decimals 
   * @returns {string} Formatted price string
   */
  formatPrice(price, decimals = 2) {
    return D(price).toFixed(decimals);
  }
};

/**
 * Convenience arithmetic functions
 */
function add(a, b) {
  return D(a).plus(D(b)).toString();
}

function subtract(a, b) {
  return D(a).minus(D(b)).toString();
}

function multiply(a, b) {
  return D(a).mul(D(b)).toString();
}

function divide(a, b, decimals = 20) {
  return D(a).div(D(b)).toFixed(decimals).replace(/\.?0+$/, '');
}

function floorToStep(value, step) {
  return D(value).div(step).floor().mul(step).toString();
}

function ceilToStep(value, step) {
  return D(value).div(step).ceil().mul(step).toString();
}

function roundToStep(value, step) {
  return D(value).div(step).round().mul(step).toString();
}

function toNumber(value) {
  return D(value).toNumber();
}

function toFixed(value, decimals) {
  return D(value).toFixed(decimals);
}

module.exports = {
  // Core
  D,
  Decimal,
  
  // Convenience arithmetic
  add,
  subtract,
  multiply,
  divide,
  floorToStep,
  ceilToStep,
  roundToStep,
  toNumber,
  toFixed,
  
  // Financial calculations
  PositionSizing,
  ROI,
  StopLoss,
  TakeProfit,
  Liquidation,
  TrailingStop,
  AutoLeverage,
  Metrics,
  PriceUtils
};
