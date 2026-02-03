# KuCoin Futures Trading Bot

Production-grade automated trading system for KuCoin Futures with 11 technical indicators, 3 microstructure analyzers, and comprehensive risk management.

## Features

- **11 Technical Indicators**: RSI, MACD, Williams %R, Awesome Oscillator, Stochastic, Bollinger Bands, EMA Trend, KDJ, OBV, DOM, ATR
- **3 Microstructure Analyzers**: Buy:Sell Ratio, Price Ratio (Bid/Ask/Index/Mark), Funding Rate
- **Signal Score Range**: -130 to +130 with configurable thresholds
- **Risk Management**: ROI-based SL/TP, trailing stops, leverage-aware position sizing
- **Multiple Modes**: Paper trading, backtesting, live trading
- **Real-time Dashboard**: WebSocket-powered UI with live signal updates
- **Dynamic Coin Screening**: Auto-ranks coins by volume, volatility, spread

## Quick Start

```bash
# Clone and setup
git clone <repo>
cd miniature-enigma
./setup.sh

# Configure
cp .env.example .env
# Edit .env with your settings

# Start paper trading (safe mode)
npm start
# Or: MODE=paper npm start

# Open dashboard
http://localhost:3000
```

## Project Structure

```
miniature-enigma/
├── server.js                 # Main entry point
├── package.json
├── .env.example              # Configuration template
│
├── src/
│   ├── indicators/           # Technical indicators (11)
│   │   ├── RSIIndicator.js
│   │   ├── MACDIndicator.js
│   │   ├── WilliamsRIndicator.js
│   │   ├── AwesomeOscillator.js
│   │   ├── StochasticIndicator.js
│   │   ├── BollingerBands.js
│   │   ├── EMATrend.js
│   │   ├── KDJIndicator.js
│   │   ├── OBVIndicator.js
│   │   ├── DOMAnalyzer.js
│   │   ├── ATRIndicator.js
│   │   └── index.js
│   │
│   ├── microstructure/       # Microstructure analyzers (3)
│   │   ├── BuySellRatioAnalyzer.js
│   │   ├── PriceRatioAnalyzer.js
│   │   ├── FundingRateAnalyzer.js
│   │   └── index.js
│   │
│   ├── lib/
│   │   ├── DecimalMath.js        # Precision arithmetic
│   │   ├── SignalGeneratorV2.js  # Signal scoring
│   │   ├── PositionManager.js    # Position & risk
│   │   └── KuCoinClient.js       # Exchange API
│   │
│   ├── screener/
│   │   ├── CoinListManager.js    # Dynamic coin ranking
│   │   └── ScreenerEngine.js     # Multi-symbol screening
│   │
│   ├── backtest/
│   │   └── BacktestEngine.js     # Deterministic backtesting
│   │
│   └── optimizer/
│       └── PaperTradingEngine.js # Paper trading simulation
│
├── public/
│   └── index.html            # Dashboard UI
│
├── scripts/
│   └── verify-system.js      # System verification
│
└── tests/
    └── unit/
        └── indicators.test.js
```

## Configuration

### Environment Variables (.env)

```bash
# Mode: paper | backtest | live
MODE=paper

# Server
PORT=3000

# KuCoin API (required for live trading)
KUCOIN_API_KEY=
KUCOIN_API_SECRET=
KUCOIN_PASSPHRASE=

# Trading symbols
SYMBOLS=XBTUSDTM,ETHUSDTM

# Timeframes
PRIMARY_TF=5min
SECONDARY_TF=15min

# Risk parameters
LEVERAGE=5
RISK_PERCENT=2
MAX_POSITIONS=3
SIGNAL_THRESHOLD=50
SL_ROI=3
TP_ROI=6
TRAILING=true

# Paper trading
PAPER_BALANCE=10000
```

## Signal Scoring

### Indicator Weights (Total: 160)

| Indicator | Max Points | Signal Types |
|-----------|------------|--------------|
| RSI | 25 | Crossover, Divergence, Momentum, Zone |
| MACD | 20 | Signal Cross, Zero Cross, Histogram, Divergence |
| Williams %R | 20 | Crossover, Failure Swing, Divergence, Zone |
| EMA Trend | 20 | Cross, Golden/Death Cross, Slope, Distance |
| KDJ | 15 | J-Line, K/D Cross, Divergence |
| Awesome Oscillator | 15 | Zero Cross, Saucer, Twin Peaks |
| DOM | 15 | Imbalance, Wall Detection, Microprice (live-only) |
| Stochastic | 10 | K/D Cross, Zone, Divergence |
| Bollinger Bands | 10 | Band Touch, Squeeze, Breakout |
| OBV | 10 | Slope, Breakout, Divergence |
| ATR | 0 | Used for volatility filtering |

### Microstructure Weights (Total: 45, capped at 20)

| Analyzer | Max Points | Signal Types |
|----------|------------|--------------|
| Buy:Sell Ratio | 15 | Flow Imbalance, Absorption, Exhaustion |
| Price Ratios | 15 | Basis, Spread, Premium/Discount |
| Funding Rate | 15 | Rate Extreme, Rate Change, Predicted |

### Signal Classification

| Score Range | Classification |
|-------------|----------------|
| ≥ +90 | EXTREME_BUY |
| ≥ +70 | STRONG_BUY |
| ≥ +50 | BUY |
| ≥ +30 | BUY_WEAK |
| -30 to +30 | NEUTRAL |
| ≤ -30 | SELL_WEAK |
| ≤ -50 | SELL |
| ≤ -70 | STRONG_SELL |
| ≤ -90 | EXTREME_SELL |

## Mathematical Formulas

### Position Sizing
```
marginUsed = balance × (riskPercent / 100)
notional = marginUsed × leverage
size = floor(notional / (price × multiplier) / lotSize) × lotSize
```

### Break-Even ROI (Fee-Adjusted)
```
BE_ROI = (entryFee + exitFee) × leverage × 100 + buffer
Example: 10x leverage, 0.06% taker = 1.3% BE_ROI
```

### Stop Loss / Take Profit (ROI-Based)
```
SL_LONG = entry × (1 - (SL_ROI / leverage / 100))
SL_SHORT = entry × (1 + (SL_ROI / leverage / 100))
TP_LONG = entry × (1 + (TP_ROI / leverage / 100))
TP_SHORT = entry × (1 - (TP_ROI / leverage / 100))
```

### Liquidation Price
```
LIQ_LONG = entry × (1 - (1 / leverage) × (1 - maintMargin))
LIQ_SHORT = entry × (1 + (1 / leverage) × (1 - maintMargin))
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard UI |
| `/api/status` | GET | System status |
| `/api/signals` | GET | Current signals for all symbols |
| `/api/positions` | GET | Active positions |
| `/api/trades` | GET | Recent trades |
| `/api/performance` | GET | Performance metrics |
| `/api/coins` | GET | Ranked coin list |
| `/api/backtest` | POST | Run backtest |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `init` | Server → Client | Initial state on connect |
| `signal_update` | Server → Client | Real-time signal updates |
| `position_opened` | Server → Client | New position opened |
| `position_closed` | Server → Client | Position closed |

## Running Modes

### Paper Trading (Default)
```bash
MODE=paper npm start
```
- Uses simulated balance
- All signals processed
- No real orders placed
- Full microstructure analysis

### Backtesting
```bash
# Via API
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{"symbol":"XBTUSDTM","granularity":"5","from":1700000000000,"to":1705000000000}'
```
- Deterministic (no microstructure)
- Uses historical OHLCV data
- Fast simulation

### Live Trading
```bash
MODE=live npm start
```
⚠️ **WARNING**: Real money at risk!
- Requires valid API credentials
- Full microstructure analysis
- Real orders placed on exchange

## Testing

```bash
# Run all tests
npm test

# Run verification
node scripts/verify-system.js

# Check individual modules
node -e "require('./src/indicators')"
```

## Security Notes

1. **API Keys**: Never commit `.env` file
2. **Permissions**: Use trade-only API keys (no withdrawal)
3. **IP Whitelist**: Restrict API access to server IP
4. **Mode**: Always test in paper mode first
5. **Risk**: Set conservative risk parameters initially

## Performance Notes

- **Hot Path**: Signal generation, position updates
- **Cold Path**: Backtest initialization, coin list refresh
- **Decimal Arithmetic**: All financial calculations use decimal.js
- **WebSocket**: Efficient binary message handling
- **Memory**: Bounded history buffers (configurable max)

## License

MIT
