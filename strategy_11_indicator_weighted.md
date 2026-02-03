# Strategy 2: 11-Indicator Weighted Configuration

Weight- and timeframe-aware configuration drawn from STRATEGY_CONFIG.json. Use this when tuning or inspecting signal strength contributions.

| Indicator | Weight | Enabled Timeframes | Notes |
|-----------|--------|--------------------|-------|
| Stochastic RSI (STOCHRSI) | 20 | 5m, 15m, 30m, 1h, 2h, 4h | K/D crosses; oversold 20, overbought 80 (varies by TF) |
| Williams %R (WILLIAMS_R) | 20 | 5m, 15m, 30m, 1h, 2h, 4h | Oversold typically -80/-85; overbought -15/-20 |
| MACD | 18 | 15m, 30m, 2h, 4h | 12/26/9 set; histogram acceleration/deceleration |
| Bollinger Bands (BOLLINGER) | 20 | 5m, 15m, 30m, 1h, 2h, 4h | 20-period, 2.0σ; reversals and band walks |
| Stochastic (STOCHASTIC) | 18 | 5m, 15m, 30m, 1h, 2h, 4h | %K/%D crosses; oversold 20, overbought 80 |
| EMA Trend (EMA_TREND) | 19 | 15m, 30m, 2h, 4h | 10/25/50 stack; golden/death cross, alignment |
| Awesome Oscillator (AO) | 17 | 30m, 2h, 4h | Zero-line cross; saucer patterns |
| KDJ | 17 | 5m, 15m, 30m, 1h, 2h, 4h | J extremes (<0, >100) and K/D crosses |
| On-Balance Volume (OBV) | 18 | 5m, 15m, 30m, 2h, 4h | Volume/price confirmation and divergence |
| Chaikin Money Flow (CMF) | 19 | 15m, 30m, 2h, 4h | Flow intensity; ±0.1 strong signals |
| Commodity Channel Index (CCI) | 16 | 5m, 15m, 30m, 1h, 2h, 4h | ±100/±200 regimes; zero-line crosses |
| Depth of Market (DOM) | 15 | 5m, 15m, 30m, 1h, 2h, 4h | Bid/ask imbalance tiers (>0.3 strong, <-0.3 strong) |
| Average True Range (ATR) | 15 | 5m, 15m, 30m, 1h, 2h, 4h | Volatility regimes adjust score and position sizing |

## Usage Notes
- Score range: -220 to 220 with per-indicator caps; classifications map to LONG/SHORT strength bands.
- Entry gates: min score 75+ (stronger at 90/100); confluence ≥50% and ≥4 signals; confidence ≥0.85.
- Volatility-aware sizing: ATR regimes modify position multiplier and leverage caps; daily drawdown capped at 3%, leverage default 6x (max 10x).

## References
- Full configuration details: STRATEGY_CONFIG.json.
- Architecture/specs: AGIREADME.md, MINIATURE_ENIGMA_V6_ARCHITECTURE.md, coinscreener.md.
