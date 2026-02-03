# Miniature Enigma — Strategy Reference (GitHub)

This document isolates the two core strategies referenced in the main docs: a high-level 10+ indicator technical analysis stack and the weight/timeframe-driven 11-indicator configuration. Use this as a quick map; see the linked specs for full parameterization.

- [Strategy 1: 10+ Indicator Technical Analysis](#strategy-1-10-indicator-technical-analysis)
- [Strategy 2: 11-Indicator Weighted Configuration](#strategy-2-11-indicator-weighted-configuration)
- [Related Docs](#related-docs)

## Strategy 1: 10+ Indicator Technical Analysis
High-level, multi-layer TA stack used for signal generation and screening.

**Indicators (11 total):** Stochastic RSI, Williams %R, MACD, Awesome Oscillator, EMA Trend, Bollinger Bands, KDJ, OBV, DOM, CCI, ATR.

**How it works:**
- Multi-timeframe alignment across 5m, 15m, 30m, 1h, 2h, 4h.
- Confidence scoring and 9-level signal classification.
- Integrates market microstructure inputs (buy/sell ratio, funding rates, price ratios) and feeds the screener for pair selection.

**When to use:**
- Broad market scanning and default signal generation.
- Situations where breadth and confluence matter more than per-indicator fine-tuning.

## Strategy 2: 11-Indicator Weighted Configuration
Detailed, weight- and timeframe-aware configuration drawn from STRATEGY_CONFIG.json. Use this when tuning or inspecting signal strength contributions.

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

**Usage notes:**
- Score range: -220 to 220 with per-indicator caps; classifications map to LONG/SHORT strength bands.
- Entry gates: min score 75+ (stronger at 90/100); confluence ≥50% and ≥4 signals; confidence ≥0.85.
- Volatility-aware sizing: ATR regimes modify position multiplier and leverage caps; daily drawdown capped at 3%, leverage default 6x (max 10x).

## Related Docs
- Primary overview and feature list: [README.md](README.md)
- Full configuration reference (weights, thresholds, timeframes): [STRATEGY_CONFIG.json](STRATEGY_CONFIG.json)
- Architecture and specs: [AGIREADME.md](AGIREADME.md), [MINIATURE_ENIGMA_V6_ARCHITECTURE.md](MINIATURE_ENIGMA_V6_ARCHITECTURE.md), [coinscreener.md](coinscreener.md)
