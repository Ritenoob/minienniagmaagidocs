# Strategy 1: 10+ Indicator Technical Analysis

High-level, multi-layer TA stack used for signal generation and screening.

**Indicators (11 total):** Stochastic RSI, Williams %R, MACD, Awesome Oscillator, EMA Trend, Bollinger Bands, KDJ, OBV, DOM, CCI, ATR.

## Mechanics
- Multi-timeframe alignment across 5m, 15m, 30m, 1h, 2h, 4h.
- Confidence scoring with 9-level signal classification.
- Integrates market microstructure inputs (buy/sell ratio, funding rates, price ratios) and feeds the screener for pair selection.

## When to Use
- Broad market scanning and default signal generation.
- Situations where breadth and confluence matter more than per-indicator fine-tuning.

## Notes
- See STRATEGY_CONFIG.json for detailed parameters and thresholds.
- Works in tandem with risk rules (drawdown limits, leverage caps) defined in the main config.
