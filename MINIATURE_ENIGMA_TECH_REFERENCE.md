# Miniature Enigma v6 - Technology & Integration Reference

## Quick Answers to Your Questions

---

## 1. Webhooks for Indicator Value Retrieval

### ✅ YES - Multiple Options Available

| Source | Method | Latency | Best For |
|--------|--------|---------|----------|
| **TradingView** | Webhook POST | 1-5 sec | Discretionary signals, complex Pine indicators |
| **Custom Python** | REST/gRPC | 10-50ms | ML-based indicators, sentiment |
| **Local Rust** | In-process | <1ms | HFT, real-time scalping |
| **External APIs** | Webhook/REST | 100-500ms | Third-party signals, news |

### TradingView Webhook Setup

```pine
// Pine Script Alert Setup
//@version=5
indicator("ME Signals", overlay=true)

// Your indicators
rsiValue = ta.rsi(close, 14)
[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)

// Alert condition
alertcondition(ta.crossover(rsiValue, 30), title="RSI Oversold", message='{"symbol":"{{ticker}}","rsi":{{plot_0}},"macd":{{plot_1}},"close":{{close}}}')
```

**Webhook URL:** `https://your-server.com/webhooks/tradingview`

---

## 2. Order Placement Options

| Method | Latency | Complexity | Features | Recommendation |
|--------|---------|------------|----------|----------------|
| **KuCoin REST API** | 50-200ms | Medium | All order types | ✅ Primary |
| **KuCoin WebSocket** | 10-50ms | High | Limited | Speed-critical |
| **CCXT (Node/Python)** | 100-300ms | Low | Multi-exchange | Prototyping |
| **Custom Rust Client** | 5-20ms | Very High | Full control | HFT |
| **FIX Protocol** | 1-5ms | Expert | Institutional | Co-located |

### Recommended: Hybrid Approach

```
┌─────────────────────────────────────────────────────────┐
│                ORDER PLACEMENT FLOW                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Signal Generated                                        │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────────────┐                                    │
│  │  Order Router   │                                    │
│  │  (Rust Service) │                                    │
│  └────────┬────────┘                                    │
│           │                                              │
│     ┌─────┴─────┐                                       │
│     │           │                                        │
│     ▼           ▼                                        │
│  Speed-Critical    Normal Orders                        │
│  (WebSocket)       (REST API)                           │
│     │                  │                                 │
│     └────────┬─────────┘                                │
│              │                                           │
│              ▼                                           │
│       KuCoin Futures                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Complete Technology Stack

### Languages & Frameworks

| Layer | Language | Framework | Purpose |
|-------|----------|-----------|---------|
| **Execution Engine** | 🦀 Rust | Tokio, Axum | Orders, indicators, low-latency |
| **Signal Processing** | 🐍 Python | FastAPI, PyTorch | ML models, complex analysis |
| **Backend API** | 📘 TypeScript | Fastify, Node.js | REST/WebSocket API |
| **Frontend** | ⚛️ TypeScript | Next.js 14, React | Trading dashboard |
| **Infrastructure** | 🐳 Docker | Compose/K8s | Containerization |
| **IaC** | 🔧 Terraform | HCL | Cloud provisioning |

### Databases

| Database | Purpose | Technology |
|----------|---------|------------|
| **Time-Series** | OHLCV, ticks, indicators | TimescaleDB |
| **Relational** | Orders, positions, users | PostgreSQL 16 |
| **Cache/Queue** | Pub/sub, rate limiting | Redis 7 |
| **Metrics** | System monitoring | InfluxDB / Prometheus |

### Message Passing

| Technology | Use Case | Latency |
|------------|----------|---------|
| **Redis Streams** | Event bus, signals | <1ms |
| **Redis Pub/Sub** | Real-time updates | <1ms |
| **gRPC** | Service-to-service | 1-5ms |
| **WebSocket** | Client updates | 5-20ms |

---

## 4. Server Architecture

### Service Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION SERVERS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  WEB SERVER     │    │  API SERVER     │    │  WORKER SERVER  │ │
│  │  (Frontend)     │    │  (Backend)      │    │  (Processing)   │ │
│  │  ─────────────  │    │  ─────────────  │    │  ─────────────  │ │
│  │  Next.js        │    │  Fastify        │    │  Rust Engine    │ │
│  │  Dashboard      │    │  REST API       │    │  Python ML      │ │
│  │  TradingView    │    │  WebSocket      │    │  Data Collector │ │
│  │                 │    │  Auth           │    │  Signal Gen     │ │
│  │  Port: 3001     │    │  Port: 3000     │    │  Port: 8001-03  │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│           │                     │                      │            │
│           └─────────────────────┼──────────────────────┘            │
│                                 │                                    │
│                                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     DATA LAYER                               │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐│   │
│  │  │TimescaleDB│  │PostgreSQL │  │  Redis    │  │ InfluxDB  ││   │
│  │  │  OHLCV    │  │  Orders   │  │  Cache    │  │  Metrics  ││   │
│  │  │  5432     │  │  5433     │  │  6379     │  │  8086     ││   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   MONITORING LAYER                           │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐│   │
│  │  │Prometheus │  │ Grafana   │  │   Loki    │  │  Jaeger   ││   │
│  │  │  9090     │  │  3002     │  │  3100     │  │  16686    ││   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Minimum Server Requirements

| Environment | CPU | RAM | Storage | Cost/Month |
|-------------|-----|-----|---------|------------|
| **Development** | 2 vCPU | 4 GB | 50 GB SSD | $20-40 |
| **Staging** | 4 vCPU | 8 GB | 100 GB SSD | $40-80 |
| **Production** | 8 vCPU | 32 GB | 500 GB NVMe | $100-200 |
| **High-Performance** | 16 vCPU | 64 GB | 1 TB NVMe | $300-500 |

---

## 5. Complete Services List

### Application Services

| Service | Language | Port | Purpose | Dependencies |
|---------|----------|------|---------|--------------|
| `execution-engine` | Rust | 8001 | Order execution, indicators | Redis, TimescaleDB, KuCoin |
| `api-gateway` | Node.js | 3000 | REST/WebSocket API | Redis, PostgreSQL |
| `signal-processor` | Python | 8002 | ML inference, signals | Redis, TimescaleDB |
| `data-collector` | Node.js | 8003 | WebSocket data ingestion | Redis, TimescaleDB, KuCoin |
| `webhook-receiver` | Node.js | 8004 | TradingView webhooks | Redis |
| `dashboard` | Next.js | 3001 | Trading UI | api-gateway |

### Infrastructure Services

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| `nginx` | NGINX | 80/443 | Reverse proxy, SSL termination |
| `timescaledb` | TimescaleDB | 5432 | Time-series data |
| `postgres` | PostgreSQL | 5433 | Relational data |
| `redis` | Redis 7 | 6379 | Cache, pub/sub, queues |
| `influxdb` | InfluxDB | 8086 | Metrics storage |
| `prometheus` | Prometheus | 9090 | Metrics collection |
| `grafana` | Grafana | 3002 | Dashboards |
| `loki` | Loki | 3100 | Log aggregation |
| `jaeger` | Jaeger | 16686 | Distributed tracing |

---

## 6. Integration Points

### External Data Sources

| Source | Method | Data Type | Update Frequency |
|--------|--------|-----------|------------------|
| **KuCoin WebSocket** | WebSocket | Ticks, L2, trades | Real-time |
| **KuCoin REST** | HTTP | OHLCV, account | On-demand |
| **TradingView** | Webhook | Indicator values | On alert |
| **CoinGecko** | REST | Market data | 1-5 min |
| **CryptoCompare** | REST/WS | Social, news | 1 min |
| **FRED** | REST | Economic data | Daily |
| **Twitter/X** | REST | Sentiment | 15 min |

### Webhook Endpoints

| Endpoint | Purpose | Auth | Rate Limit |
|----------|---------|------|------------|
| `POST /webhooks/tradingview` | TradingView alerts | Secret token | 100/min |
| `POST /webhooks/indicators` | Custom indicator values | API key | 1000/min |
| `POST /webhooks/alerts` | External alerts | API key | 100/min |
| `POST /webhooks/signals` | Third-party signals | API key | 50/min |

---

## 7. Dashboard Features

### Main Dashboard Components

| Component | Technology | Features |
|-----------|------------|----------|
| **Price Chart** | TradingView Lightweight | Candles, indicators, drawings |
| **Order Book** | Custom React | Real-time L2 depth |
| **Position Panel** | React + Zustand | Live P&L, management |
| **Signal Feed** | React + Socket.io | Real-time signals |
| **Trade History** | React Table | Pagination, filters |
| **Risk Monitor** | Recharts | Drawdown, exposure |
| **Performance** | Tremor/Recharts | Win rate, profit factor |

### Real-time Updates

| Data | Method | Latency Target |
|------|--------|----------------|
| Prices | WebSocket | <100ms |
| Positions | WebSocket | <200ms |
| Signals | WebSocket | <500ms |
| Orders | WebSocket | <100ms |
| Balance | Polling | 5 sec |

---

## 8. Deployment Options

### Option A: Single Server (Development/Small Scale)

```yaml
# docker-compose.yml - All services on one server
services:
  all-in-one:
    # All services in containers
    # Suitable for < $50k portfolio
```

**Pros:** Simple, cheap (~$100/mo)
**Cons:** Single point of failure, limited scaling

### Option B: Multi-Server (Production)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web Server │  │  API Server │  │Data Server  │
│  Dashboard  │  │  Gateway    │  │ TimescaleDB │
│  Nginx      │  │  Execution  │  │ PostgreSQL  │
│             │  │  Signals    │  │ Redis       │
└─────────────┘  └─────────────┘  └─────────────┘
```

**Pros:** Fault tolerance, scalability
**Cons:** More complex, higher cost (~$300-500/mo)

### Option C: Kubernetes (Enterprise)

```
┌───────────────────────────────────────────────────┐
│                 Kubernetes Cluster                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Pod 1   │  │ Pod 2   │  │ Pod 3   │  ...      │
│  │ API x3  │  │ Exec x2 │  │ Signal  │           │
│  └─────────┘  └─────────┘  └─────────┘           │
│                                                    │
│  + Auto-scaling, self-healing, rolling deploys    │
└───────────────────────────────────────────────────┘
```

**Pros:** Enterprise-grade, auto-scaling
**Cons:** Complex, expensive (~$800-1500/mo)

---

## 9. Quick Start Commands

### Development Setup

```bash
# Clone monorepo
git clone https://github.com/your-org/miniature-enigma-v6.git
cd miniature-enigma-v6

# Install dependencies
pnpm install

# Start databases
docker-compose -f infrastructure/docker-compose/docker-compose.dev.yml up -d

# Start all services in dev mode
pnpm dev
```

### Production Deployment

```bash
# Build all services
pnpm build

# Build Docker images
docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml build

# Deploy
docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml up -d

# View logs
docker-compose logs -f
```

---

## 10. Security Checklist

| Layer | Requirement | Implementation |
|-------|-------------|----------------|
| **API** | Authentication | JWT + API keys |
| **API** | Rate limiting | Redis-based |
| **Network** | HTTPS | Let's Encrypt / Cloudflare |
| **Network** | IP whitelist | Nginx / Firewall |
| **Secrets** | Management | Environment variables / Vault |
| **KuCoin** | API permissions | Trade only, no withdrawal |
| **KuCoin** | IP restriction | Whitelist server IPs |
| **Database** | Encryption | At rest + in transit |
| **Logs** | Sanitization | No secrets in logs |
| **Backup** | Automated | Daily + transaction logs |

---

## Summary: What You Need

### Minimum Viable System

1. **1 VPS** ($100-200/mo) with Docker
2. **KuCoin API** (trade permissions only)
3. **TradingView Pro** ($15/mo for webhooks)
4. **Domain + Cloudflare** ($20/mo)

### Full Production System

1. **3+ Servers** (API, Worker, Database)
2. **Kubernetes** or Docker Swarm
3. **Managed Redis** (optional)
4. **Monitoring stack** (Grafana, Prometheus)
5. **CI/CD pipeline** (GitHub Actions)

### Development Tools

- **IDE:** VS Code / RustRover / PyCharm
- **API Testing:** Postman / Insomnia
- **Database:** DBeaver / pgAdmin
- **Monitoring:** Grafana dashboards
- **Debugging:** Chrome DevTools, Rust debugger

---

## Next Steps

1. **Phase 1:** Set up monorepo structure
2. **Phase 2:** Implement webhook receiver (TradingView)
3. **Phase 3:** Build Rust execution engine
4. **Phase 4:** Create API gateway
5. **Phase 5:** Build dashboard MVP
6. **Phase 6:** Add ML signal enhancement
7. **Phase 7:** Deploy to production
8. **Phase 8:** Monitoring and optimization

Would you like me to create the initial repository scaffold with all these components?
