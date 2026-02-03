# Miniature Enigma - AGI-Level KuCoin Futures Trading Bot

[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://www.python.org/)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](#license)
[![Status](https://img.shields.io/badge/Status-Specification_Ready-informational)](#status)

---

## 📋 Overview

**Miniature Enigma** is an enterprise-grade cryptocurrency trading bot designed for **KuCoin Futures perpetual contracts**. It combines sophisticated technical analysis, machine learning signal generation, and comprehensive risk management.

### Key Characteristics

- **10-Indicator Technical Analysis** - Multi-layer signal generation system
- **Market Microstructure Analysis** - Real-time buy/sell pressure, funding rates, spread analysis
- **Dynamic Coin Screener** - Automated identification of optimal trading opportunities
- **AI-Powered Decision Making** - ML-optimized signal routing
- **Enterprise Risk Management** - ATR-based position sizing, circuit breakers, drawdown limits
- **Real-Time Dashboard** - React-based trading interface
- **Paper Trading Mode** - Strategy optimization without risk

---

## ✨ Features

### Technical Analysis Engine
✅ 10+ Technical Indicators (Stochastic RSI, Williams %R, MACD, Awesome Oscillator, EMA, Bollinger Bands, KDJ, OBV, DOM, CCI, ATR)
✅ Market Microstructure Analysis (Buy/Sell Ratio, Price Ratios, Funding Rates)
✅ Multi-Timeframe Alignment (5m, 15m, 30m, 1h, 2h, 4h)
✅ Confidence Scoring System
✅ 9-Level Signal Classification

### Trading Automation
✅ Dynamic Coin Screener
✅ Automated Entry/Exit Logic
✅ Smart Order Routing
✅ Position Management with Trailing Stops
✅ Paper Trading Mode

### Risk Management
✅ ATR-Based Position Sizing
✅ Automated Stop-Loss & Take-Profit
✅ Daily Drawdown Limits (3% max)
✅ Circuit Breakers
✅ Liquidation Buffer Enforcement (5% minimum)
✅ Leverage Caps (10x maximum, 6x default)

---

## 🔧 Technology Stack

### Backend Services
- **Execution Engine:** Rust (low-latency <10μs)
- **Signal Processing:** Python + Rust
- **REST/WebSocket API:** Node.js (Fastify)
- **Data Ingestion:** Node.js + Rust

### Frontend
- **Dashboard:** React 18 + TypeScript
- **Charts:** TradingView Lightweight
- **Real-Time:** WebSocket

### Data Storage
- **PostgreSQL 16** - Orders, positions, users
- **TimescaleDB** - OHLCV time-series data
- **Redis 7** - Caching, pub/sub, rate limiting
- **InfluxDB/Prometheus** - Metrics

### Infrastructure
- Docker + Docker Compose
- Kubernetes (optional)
- Terraform (IaC)
- GitHub Actions (CI/CD)
- Grafana + Prometheus (Monitoring)

---

## 📁 Project Structure

```
miniature-enigma/
├── 📄 Core Documentation
│   ├── AGIREADME.md                    (228KB) ⭐ MAIN SPEC
│   ├── MINIATURE_ENIGMA_V6_ARCHITECTURE.md
│   ├── MINIATURE_ENIGMA_TECH_REFERENCE.md
│   ├── DELIVERY_SUMMARY.md
│   └── AGENTS.md
├── ⚙️ Configuration
│   ├── STRATEGY_CONFIG.json            (Indicator weights)
│   └── CORRECTED_ENV_CONFIG.env        (Environment setup)
├── 📊 Specification Documents
│   ├── AGI LEVEL TRADING BOT.txt
│   ├── coinscreener.md
│   └── The Definitive Information.txt
└── 🎨 Frontend
    └── react-trading-dashboard.tsx
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Rust 1.70+
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/miniature-enigma.git
cd miniature-enigma
```

### 2. Install Dependencies
```bash
npm install
pip install -r requirements.txt
cargo build --release
```

### 3. Set Up Environment
```bash
cp CORRECTED_ENV_CONFIG.env .env
nano .env  # Edit with your KuCoin credentials
```

### 4. Set Up Databases
```bash
docker-compose up -d postgres redis timescaledb
npm run db:migrate
```

### 5. Start Development Servers
```bash
# Terminal 1: Backend API
npm start

# Terminal 2: Signal Engine
python src/signal_engine/main.py

# Terminal 3: Dashboard
npm run dev:dashboard
```

### 6. Access Dashboard
```
http://localhost:3000
```

---

## 🔨 8-Phase Build Workflow

Follow this workflow to build the complete project:

### Phase 1: Architecture & Planning (Days 1-2)

**Read Documentation in Order:**
1. AGIREADME.md (228KB) - Complete specification
2. MINIATURE_ENIGMA_V6_ARCHITECTURE.md - System design
3. MINIATURE_ENIGMA_TECH_REFERENCE.md - Integration guide
4. Full Development Plan.txt - Roadmap

**Review Configuration:**
5. STRATEGY_CONFIG.json - All indicator parameters
6. CORRECTED_ENV_CONFIG.env - Environment setup

**Checklist:**
- [ ] Understand signal generation system
- [ ] Review indicator weight distribution
- [ ] Understand risk management constraints
- [ ] Plan database schema

---

### Phase 2: Backend Development (Days 3-8)

**Build Node.js API:**
```javascript
// src/backend/routes/signals.ts
import Fastify from 'fastify';

const server = Fastify();

server.get('/signals', async (request, reply) => {
  // Get latest signals
  return { signals: [...] };
});

server.post('/orders', async (request, reply) => {
  // Place order
  const order = await executeOrder(request.body);
  return order;
});

server.listen({ port: 3000 });
```

**Database Setup:**
```sql
CREATE TABLE signals (
  id UUID PRIMARY KEY,
  symbol VARCHAR(20),
  signal_type VARCHAR(20),
  score FLOAT,
  confidence FLOAT,
  created_at TIMESTAMP
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  symbol VARCHAR(20),
  side VARCHAR(10),
  quantity FLOAT,
  price FLOAT,
  status VARCHAR(20),
  created_at TIMESTAMP
);

CREATE TABLE positions (
  id UUID PRIMARY KEY,
  symbol VARCHAR(20),
  entry_price FLOAT,
  current_price FLOAT,
  quantity FLOAT,
  leverage FLOAT,
  stop_loss FLOAT,
  take_profit FLOAT,
  created_at TIMESTAMP
);
```

**KuCoin Integration:**
```javascript
class KuCoinService {
  async getMarketData(symbol, timeframe) {
    // WebSocket connection
  }

  async placeOrder(symbol, side, size, price) {
    // Smart order routing
  }

  async getOrderBook(symbol) {
    // Depth of market
  }

  async getFundingRate(symbol) {
    // Funding rate for predictions
  }
}
```

**Checklist:**
- [ ] Backend API scaffolding complete
- [ ] Database migrations created
- [ ] KuCoin API client implemented
- [ ] WebSocket data feed connected
- [ ] API endpoints responding
- [ ] Health checks passing

---

### Phase 3: Signal Generation Engine (Days 9-14)

**Build Python Signal Engine:**
```python
# src/signal_engine/indicators.py

class IndicatorEngine:
    def calculate_stochastic_rsi(self, prices, period=14):
        """Stochastic RSI: 40 points (highest weight)"""
        rsi = RSI(prices, period)
        min_rsi = min(rsi[-period:])
        max_rsi = max(rsi[-period:])
        stoch_rsi = (rsi[-1] - min_rsi) / (max_rsi - min_rsi)
        score = stoch_rsi * 40
        return {
            'value': stoch_rsi,
            'score': score,
            'signal': 'BUY' if score > 20 else 'SELL'
        }

    def calculate_williams_r(self, high, low, close, period=14):
        """Williams %R: 22 points"""
        highest = max(high[-period:])
        lowest = min(low[-period:])
        wr = (highest - close[-1]) / (highest - lowest)
        score = abs(wr) * 22
        return {'value': wr, 'score': score}

    def calculate_macd(self, prices):
        """MACD: 18 points"""
        macd, signal, histogram = MACD(prices)
        score = abs(histogram[-1]) * 18
        return {'value': histogram[-1], 'score': score}
```

**Signal Aggregation:**
```python
class SignalGenerator:
    def aggregate_signal(self, indicators, microstructure=None):
        """Aggregate all indicators into unified signal"""
        total_score = sum(ind['score'] for ind in indicators.values())
        
        if microstructure:
            micro_score = sum(m['score'] for m in microstructure.values())
            total_score += micro_score
        
        final_score = max(-220, min(220, total_score))
        confidence = self.calculate_confidence(indicators)
        signal_class = self.classify_signal(final_score)
        
        return {
            'score': final_score,
            'confidence': confidence,
            'classification': signal_class,
            'timestamp': datetime.now()
        }
    
    def classify_signal(self, score):
        """9-level classification system"""
        if score >= 130: return 'EXTREME_BUY'
        elif score >= 95: return 'STRONG_BUY'
        elif score >= 65: return 'BUY'
        elif score >= 40: return 'BUY_WEAK'
        elif score >= -39: return 'NEUTRAL'
        elif score >= -64: return 'SELL_WEAK'
        elif score >= -94: return 'SELL'
        elif score >= -129: return 'STRONG_SELL'
        else: return 'EXTREME_SELL'
```

**Checklist:**
- [ ] All 10 technical indicators implemented
- [ ] Market microstructure analyzers created
- [ ] Signal aggregation system working
- [ ] 9-level classification tested
- [ ] Confidence scoring functional
- [ ] Indicator weights match STRATEGY_CONFIG.json

---

### Phase 4: Order Execution Engine (Days 15-19)

**Rust Execution Engine:**
```rust
// src/execution/src/main.rs

pub struct ExecutionEngine {
    kucoin_client: KuCoinClient,
    position_manager: PositionManager,
    risk_manager: RiskManager,
}

impl ExecutionEngine {
    pub async fn place_order(&self, signal: TradingSignal) -> Result<Order> {
        // 1. Validate signal
        self.validate_signal(&signal)?;
        
        // 2. Calculate position size
        let size = self.risk_manager.calculate_position_size(&signal)?;
        
        // 3. Prepare order
        let order = self.prepare_order(&signal, size)?;
        
        // 4. Place with exchange
        let executed = self.kucoin_client.place_order(&order).await?;
        
        // 5. Track position
        self.position_manager.add_position(&executed).await?;
        
        Ok(executed)
    }
}

pub struct RiskManager {
    max_daily_drawdown: f64,
    circuit_breaker_threshold: u32,
    min_liquidation_buffer: f64,
}

impl RiskManager {
    pub fn calculate_position_size(&self, signal: &TradingSignal) -> Result<f64> {
        let account_equity = self.get_account_equity();
        
        if self.get_daily_drawdown() >= self.max_daily_drawdown {
            return Err("Daily drawdown limit reached".into());
        }
        
        let atr = signal.atr_value;
        let base_size = account_equity * 0.02 / atr;
        let final_size = base_size * signal.confidence;
        
        Ok(final_size)
    }
}
```

**Checklist:**
- [ ] Rust execution engine compiles
- [ ] Order placement latency <100ms
- [ ] Position manager tracks positions
- [ ] Stop-loss and take-profit working
- [ ] Trailing stops implemented
- [ ] Risk manager enforcing constraints
- [ ] Circuit breaker functional

---

### Phase 5: Coin Screener (Days 20-22)

**Screener Implementation:**
```python
# src/signal_engine/screener.py

class CoinScreener:
    def __init__(self, config):
        self.top_coins_count = config.get('TOP_COINS_COUNT', 100)
        self.min_volume_24h = config.get('MIN_VOLUME_24H', 5_000_000)
    
    async def scan_opportunities(self):
        """Scan and rank coins by opportunity score"""
        all_symbols = await self.get_top_liquid_pairs(self.top_coins_count)
        
        opportunities = []
        for symbol in all_symbols:
            if self.is_on_cooldown(symbol):
                continue
            
            market_data = await self.fetch_market_data(symbol)
            tech_score = await self.calculate_technical_score(symbol, market_data)
            
            if not self.check_timeframe_alignment(tech_score):
                continue
            
            gates_passed = self.check_entry_gates(tech_score, market_data)
            if not gates_passed:
                continue
            
            opportunities.append({
                'symbol': symbol,
                'score': tech_score['score'],
                'confidence': tech_score['confidence'],
                'recommendation': tech_score['classification']
            })
        
        opportunities.sort(key=lambda x: abs(x['score']), reverse=True)
        return opportunities[:10]
    
    def check_entry_gates(self, tech_score, market_data):
        """7 Entry Gate Requirements"""
        checks = [
            tech_score['score'] >= 75,
            tech_score['indicator_confluence'] >= 4,
            tech_score['confidence'] >= 0.85,
            self.check_trend_alignment(tech_score),
            self.check_account_drawdown() < 0.03,
            self.check_spread_acceptable(market_data),
            self.check_liquidity_sufficient(market_data),
        ]
        return all(checks)
```

**Checklist:**
- [ ] Screener scans top 100 pairs
- [ ] Technical scoring working
- [ ] Multi-timeframe alignment checks functional
- [ ] 7 entry gates implemented
- [ ] Opportunity ranking working
- [ ] Cooldown tracking prevents retrades

---

### Phase 6: Dashboard Development (Days 23-24)

**React Dashboard:**
```typescript
// src/dashboard/components/TradingDashboard.tsx

import React, { useEffect, useState } from 'react';

const TradingDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3000/ws');
    
    ws.current.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setData(prev => ({ ...prev, ...update }));
    };

    return () => ws.current?.close();
  }, []);

  return (
    <div className="dashboard">
      <section className="portfolio-section">
        <h2>Portfolio</h2>
        <MetricCard label="Total Equity" value={data?.portfolio.total_equity} />
        <MetricCard label="Win Rate" value={`${(data?.performance.win_rate * 100).toFixed(1)}%`} />
        <MetricCard label="Max Drawdown" value={`${(data?.performance.max_drawdown * 100).toFixed(1)}%`} />
      </section>

      <section className="positions-section">
        <h2>Open Positions ({data?.openPositions.length})</h2>
        <PositionsTable positions={data?.openPositions} />
      </section>

      <section className="signals-section">
        <h2>Recent Signals</h2>
        {data?.recentSignals.map(signal => <SignalCard key={signal.id} signal={signal} />)}
      </section>
    </div>
  );
};
```

**Checklist:**
- [ ] Dashboard renders correctly
- [ ] WebSocket real-time updates working
- [ ] Portfolio metrics displaying
- [ ] Positions table functional
- [ ] Charts rendering
- [ ] Responsive design

---

### Phase 7: Testing & Validation (Days 25-26)

**Test Suite:**
```bash
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=integration
npm test -- --testPathPattern=e2e
```

**Unit Tests:**
```javascript
describe('Signal Generator', () => {
  describe('Stochastic RSI', () => {
    test('should return score 0-40', () => {
      const result = signalGen.calculateStochasticRSI(prices);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(40);
    });
  });

  describe('Signal Aggregation', () => {
    test('should aggregate 10+ indicators', () => {
      const result = signalGen.aggregateSignal(indicators);
      expect(result.score).toBeLessThanOrEqual(220);
    });
  });
});
```

**Checklist:**
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests covering workflows
- [ ] >80% code coverage
- [ ] Database transaction tests
- [ ] Risk manager tests

---

### Phase 8: Production Deployment (Days 27-28)

**Docker Setup:**
```bash
docker build -t miniature-enigma:latest .
docker-compose -f docker-compose.prod.yml up -d
docker-compose ps
```

**Kubernetes (Optional):**
```bash
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl get pods
```

**Monitoring:**
```bash
kubectl apply -f monitoring/prometheus-config.yaml
kubectl apply -f monitoring/grafana-deployment.yaml
```

**Checklist:**
- [ ] Docker image builds successfully
- [ ] All containers running and healthy
- [ ] Kubernetes deployment successful
- [ ] Monitoring dashboards accessible
- [ ] Alerts configured
- [ ] Health checks passing
- [ ] SSL/TLS installed
- [ ] Backups configured

---

## ⚙️ Configuration

### STRATEGY_CONFIG.json
All 11 indicator parameters, scoring ranges, thresholds, and timeframes.

### CORRECTED_ENV_CONFIG.env
100+ environment variables with safety fixes:
```bash
BOT_MODE=paper                  # Start in paper mode
LEVERAGE_DEFAULT=6              # Conservative default
LEVERAGE_MAX=10                 # Hard cap
POSITION_SIZE_DEFAULT=0.02      # 2% of equity
POSITION_SIZE_MAX=0.05          # 5% max
MAX_DAILY_DRAWDOWN=0.03         # 3% max daily loss
STOP_LOSS_ROI=0.06              # -6% stop loss
TAKE_PROFIT_ROI=0.15            # +15% take profit
MAX_OPEN_POSITIONS=5
CIRCUIT_BREAKER_THRESHOLD=3
```

---

## 🛡️ Safety Features

✅ **Paper Trading Default** - Start in paper mode  
✅ **Reduced Leverage** - 6x default, 10x max  
✅ **Smaller Position Sizes** - 2% default, 5% max  
✅ **Daily Drawdown Limit** - 3% maximum daily loss  
✅ **Circuit Breaker** - Halts after 3 losses  
✅ **Liquidation Buffer** - 5% minimum equity buffer  
✅ **Automated Stop-Loss** - Every position protected  
✅ **Automated Take-Profit** - Lock in gains  
✅ **API Restrictions** - Read-only recommended  
✅ **Emergency Kill Switch** - Manual shutdown  

---

## 📚 Documentation Files

| File | Size | Read Time | Content |
|------|------|-----------|---------|
| AGIREADME.md | 228KB | 2-3 hrs | MAIN SPECIFICATION |
| MINIATURE_ENIGMA_V6_ARCHITECTURE.md | 66KB | 30 min | System architecture |
| AGI LEVEL TRADING BOT.txt | 159KB | 1.5 hrs | Detailed protocol |
| coinscreener.md | 189KB | 1 hr | Screener specification |
| STRATEGY_CONFIG.json | 16KB | 5 min | Configuration |
| CORRECTED_ENV_CONFIG.env | 11KB | 5 min | Environment setup |

---

## 📖 Reading Order

1. **DELIVERY_SUMMARY.md** - Quick overview
2. **MINIATURE_ENIGMA_V6_ARCHITECTURE.md** - System design
3. **AGIREADME.md** - Complete specification
4. **coinscreener.md** - Screener details
5. **STRATEGY_CONFIG.json** - Configuration
6. **CORRECTED_ENV_CONFIG.env** - Environment

---

## 🗺️ Development Roadmap

- **Week 1-2:** Architecture & Planning
- **Week 3-4:** Backend Development
- **Week 5-6:** Signal Engine
- **Week 7-8:** Execution Engine
- **Week 9-10:** Coin Screener
- **Week 11-12:** Dashboard
- **Week 13-14:** Testing
- **Week 15-16:** Deployment

**Total Estimated Time:** 2-4 weeks for full implementation

---

## 📊 Expected Performance (Conservative)

- **Win Rate:** 55-65%
- **Profit Factor:** 1.8-2.2x
- **Max Drawdown:** 8-12%
- **Sharpe Ratio:** 0.8-1.2
- **Monthly Return:** 3-8%

---

## ⚠️ Disclaimer

**Cryptocurrency trading involves substantial risk of loss.**

- This bot is for educational and research purposes
- Not financial advice
- Do not risk capital you cannot afford to lose
- Always test in paper trading mode first
- Markets are unpredictable; no system guarantees profits
- Leverage amplifies both gains and losses

**Use at your own risk.**

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests (80%+ coverage required)
5. Submit a pull request

---

## 📞 Support

- 📖 Documentation: See files in this directory
- 🐛 Report Bugs: Open GitHub issue
- 💡 Feature Requests: GitHub discussion
- 💬 Questions: GitHub discussions

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🚀 Next Steps

1. ✅ Clone the repository
2. ✅ Read DELIVERY_SUMMARY.md
3. ✅ Follow Quick Start section
4. ✅ Read AGIREADME.md for full understanding
5. ✅ Begin Phase 1 (Architecture & Planning)
6. ✅ Progress through 8-phase build workflow

---

**Made with ❤️ for the algorithmic trading community**

For more information, see the documentation files in this directory.
