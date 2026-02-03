# Miniature Enigma v6.0 - Complete System Architecture

## Enterprise-Grade KuCoin Futures Trading Infrastructure

**Document Version:** 1.0.0 | **Date:** 2026-01-30 | **Status:** Architecture Specification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Technology Stack](#technology-stack)
4. [Data Ingestion Layer](#data-ingestion-layer)
5. [Signal Generation Layer](#signal-generation-layer)
6. [Order Execution Layer](#order-execution-layer)
7. [Risk Management Layer](#risk-management-layer)
8. [Dashboard & UI Layer](#dashboard--ui-layer)
9. [Infrastructure & DevOps](#infrastructure--devops)
10. [Webhooks & Integrations](#webhooks--integrations)
11. [Repository Structure](#repository-structure)
12. [Database Schema](#database-schema)
13. [API Specifications](#api-specifications)
14. [Security Architecture](#security-architecture)
15. [Deployment Strategy](#deployment-strategy)
16. [Cost Estimation](#cost-estimation)

---

## Executive Summary

### Architecture Goals

| Goal | Solution |
|------|----------|
| **Ultra-Low Latency** | Rust execution engine, co-located servers |
| **High Availability** | Multi-region deployment, failover |
| **Real-Time Data** | WebSocket streams, Redis pub/sub |
| **Scalability** | Microservices, horizontal scaling |
| **Observability** | Prometheus, Grafana, distributed tracing |
| **Security** | Zero-trust, encrypted at rest/transit |

### Core Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MINIATURE ENIGMA v6.0                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  TradingView │  │   KuCoin    │  │  Binance    │  │  External   │        │
│  │  Webhooks   │  │  WebSocket  │  │  WebSocket  │  │  Data APIs  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                    ┌──────────────▼──────────────┐                          │
│                    │     DATA INGESTION LAYER    │  (Rust + Node.js)        │
│                    │  ─────────────────────────  │                          │
│                    │  • WebSocket Manager        │                          │
│                    │  • Webhook Receiver         │                          │
│                    │  • Data Normalizer          │                          │
│                    │  • OHLCV Aggregator         │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────┐               │
│         │                         │                         │               │
│         ▼                         ▼                         ▼               │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │   Redis     │          │ TimescaleDB │          │  InfluxDB   │         │
│  │  Pub/Sub    │          │  Time-Series│          │   Metrics   │         │
│  │   Cache     │          │    OHLCV    │          │   Logging   │         │
│  └──────┬──────┘          └──────┬──────┘          └─────────────┘         │
│         │                        │                                          │
│         └────────────┬───────────┘                                          │
│                      │                                                       │
│       ┌──────────────▼──────────────┐                                       │
│       │   SIGNAL GENERATION LAYER   │  (Rust + Python)                      │
│       │  ─────────────────────────  │                                       │
│       │  • Technical Indicators     │                                       │
│       │  • ML Models (PyTorch)      │                                       │
│       │  • Pattern Recognition      │                                       │
│       │  • Multi-TF Analysis        │                                       │
│       └──────────────┬──────────────┘                                       │
│                      │                                                       │
│       ┌──────────────▼──────────────┐                                       │
│       │   ORDER EXECUTION LAYER     │  (Rust)                               │
│       │  ─────────────────────────  │                                       │
│       │  • Order Router             │                                       │
│       │  • Smart Order Types        │                                       │
│       │  • Position Manager         │                                       │
│       │  • Slippage Optimizer       │                                       │
│       └──────────────┬──────────────┘                                       │
│                      │                                                       │
│       ┌──────────────▼──────────────┐                                       │
│       │   RISK MANAGEMENT LAYER     │  (Rust + Node.js)                     │
│       │  ─────────────────────────  │                                       │
│       │  • Position Sizing          │                                       │
│       │  • Stop Loss Manager        │                                       │
│       │  • Drawdown Monitor         │                                       │
│       │  • Circuit Breakers         │                                       │
│       └──────────────┬──────────────┘                                       │
│                      │                                                       │
│  ┌───────────────────┴───────────────────┐                                  │
│  │                                       │                                  │
│  ▼                                       ▼                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐                        │
│  │    API GATEWAY      │    │    DASHBOARD UI     │                        │
│  │  (Node.js/Fastify)  │    │  (Next.js/React)    │                        │
│  │  ─────────────────  │    │  ─────────────────  │                        │
│  │  • REST API         │    │  • Real-time Charts │                        │
│  │  • WebSocket API    │    │  • Position Monitor │                        │
│  │  • Authentication   │    │  • Trade History    │                        │
│  │  • Rate Limiting    │    │  • Risk Dashboard   │                        │
│  └─────────────────────┘    └─────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Complete Technology Matrix

| Layer | Technology | Purpose | Why This Choice |
|-------|------------|---------|-----------------|
| **Execution Engine** | Rust | Order placement, low-latency | Zero-cost abstractions, memory safety, ~10μs latency |
| **Signal Processing** | Rust + Python | Indicator calc, ML inference | Rust for speed, Python for ML ecosystem |
| **Backend API** | Node.js (Fastify) | REST/WebSocket API | Async I/O, large ecosystem, TypeScript |
| **Dashboard Frontend** | Next.js 14 + React | Trading UI | SSR, React Server Components, real-time |
| **Charts** | TradingView Lightweight | Price charts | Industry standard, performant |
| **Real-time** | Socket.io / ws | Live updates | Bidirectional, reconnection handling |
| **Cache** | Redis 7 | Pub/sub, caching, rate limiting | In-memory speed, streams |
| **Time-Series DB** | TimescaleDB | OHLCV storage | PostgreSQL compatible, compression |
| **Relational DB** | PostgreSQL 16 | Orders, positions, users | ACID, reliability |
| **Metrics DB** | InfluxDB / Prometheus | System metrics | Time-series optimized |
| **Message Queue** | Redis Streams / NATS | Event bus | Low latency, persistence |
| **ML Framework** | PyTorch / ONNX | Model inference | ONNX for Rust inference |
| **Container Runtime** | Docker + Podman | Containerization | Isolation, reproducibility |
| **Orchestration** | Kubernetes / Docker Swarm | Deployment | Auto-scaling, self-healing |
| **CI/CD** | GitHub Actions | Automation | Native integration |
| **Monitoring** | Grafana + Prometheus | Observability | Industry standard |
| **Logging** | Loki + Vector | Log aggregation | Scalable, Grafana integration |
| **Tracing** | Jaeger / Tempo | Distributed tracing | Request flow visualization |

---

## Data Ingestion Layer

### Webhook Architecture for Indicator Values

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      WEBHOOK INGESTION SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TRADINGVIEW ALERTS                    CUSTOM INDICATORS                 │
│  ─────────────────────                 ─────────────────────             │
│                                                                          │
│  ┌─────────────────┐                   ┌─────────────────┐              │
│  │ Pine Script     │                   │ Python Calc     │              │
│  │ Indicators      │                   │ Service         │              │
│  │ ─────────────── │                   │ ─────────────── │              │
│  │ • RSI Alert     │                   │ • Custom ML     │              │
│  │ • MACD Cross    │                   │ • Divergence    │              │
│  │ • BB Squeeze    │                   │ • Pattern       │              │
│  │ • Volume Spike  │                   │ • Sentiment     │              │
│  └────────┬────────┘                   └────────┬────────┘              │
│           │                                     │                        │
│           │  HTTPS POST                         │  gRPC/HTTP             │
│           │                                     │                        │
│           └──────────────┬──────────────────────┘                        │
│                          │                                               │
│                          ▼                                               │
│           ┌──────────────────────────────┐                              │
│           │     WEBHOOK GATEWAY          │                              │
│           │     (Node.js/Fastify)        │                              │
│           │  ────────────────────────    │                              │
│           │  POST /webhooks/tradingview  │                              │
│           │  POST /webhooks/custom       │                              │
│           │  POST /webhooks/alerts       │                              │
│           │                              │                              │
│           │  Features:                   │                              │
│           │  • Signature verification    │                              │
│           │  • Rate limiting             │                              │
│           │  • Payload validation        │                              │
│           │  • Idempotency keys          │                              │
│           └──────────────┬───────────────┘                              │
│                          │                                               │
│                          ▼                                               │
│           ┌──────────────────────────────┐                              │
│           │     MESSAGE BROKER           │                              │
│           │     (Redis Streams)          │                              │
│           │  ────────────────────────    │                              │
│           │  Stream: indicators:raw      │                              │
│           │  Stream: signals:pending     │                              │
│           │  Stream: alerts:incoming     │                              │
│           └──────────────────────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### TradingView Webhook Payload Format

```json
{
  "secret": "{{strategy.account}}",
  "timestamp": "{{timenow}}",
  "exchange": "KUCOIN",
  "symbol": "{{ticker}}",
  "interval": "{{interval}}",
  "action": "{{strategy.order.action}}",
  "indicators": {
    "rsi": {{plot_0}},
    "macd": {{plot_1}},
    "macd_signal": {{plot_2}},
    "macd_hist": {{plot_3}},
    "bb_upper": {{plot_4}},
    "bb_middle": {{plot_5}},
    "bb_lower": {{plot_6}},
    "atr": {{plot_7}},
    "volume": {{volume}},
    "close": {{close}},
    "open": {{open}},
    "high": {{high}},
    "low": {{low}}
  },
  "conditions": {
    "rsi_oversold": {{strategy.order.comment}},
    "macd_cross": "{{strategy.order.id}}"
  }
}
```

### WebSocket Data Streams

```typescript
// KuCoin WebSocket Subscriptions
const KUCOIN_STREAMS = {
  // Market Data
  ticker: '/market/ticker:{symbol}',
  level2: '/market/level2:{symbol}',
  match: '/market/match:{symbol}',
  candles: '/market/candles:{symbol}_{interval}',
  
  // Private Channels (requires auth)
  orderChange: '/contractMarket/tradeOrders',
  positionChange: '/contract/position:{symbol}',
  balanceChange: '/contractAccount/wallet',
  
  // System
  announcement: '/contract/announcement'
};

// Multi-Exchange WebSocket Manager
interface WebSocketConfig {
  exchange: 'kucoin' | 'binance' | 'bybit';
  channels: string[];
  reconnectAttempts: number;
  heartbeatInterval: number;
}
```

---

## Signal Generation Layer

### Indicator Calculation Options

| Method | Latency | Accuracy | Complexity | Best For |
|--------|---------|----------|------------|----------|
| **TradingView Webhooks** | 1-5s | High | Low | Discretionary signals |
| **Local Rust Calc** | <1ms | Highest | High | HFT, scalping |
| **Python TA-Lib** | 10-50ms | High | Medium | ML features |
| **Node.js technicalindicators** | 5-20ms | High | Low | Prototyping |

### Rust Indicator Engine

```rust
// src/indicators/mod.rs
pub mod rsi;
pub mod macd;
pub mod bollinger;
pub mod atr;
pub mod stochrsi;
pub mod divergence;

use rust_decimal::Decimal;
use std::collections::VecDeque;

pub trait Indicator {
    fn name(&self) -> &str;
    fn update(&mut self, candle: &Candle) -> Option<IndicatorValue>;
    fn reset(&mut self);
}

#[derive(Debug, Clone)]
pub struct IndicatorValue {
    pub timestamp: i64,
    pub values: Vec<(String, Decimal)>,
    pub signals: Vec<Signal>,
}

#[derive(Debug, Clone)]
pub enum Signal {
    Bullish { strength: f64, reason: String },
    Bearish { strength: f64, reason: String },
    Neutral,
}

// High-performance RSI with Wilder smoothing
pub struct RSI {
    period: usize,
    gains: VecDeque<Decimal>,
    losses: VecDeque<Decimal>,
    avg_gain: Option<Decimal>,
    avg_loss: Option<Decimal>,
    prev_close: Option<Decimal>,
}

impl RSI {
    pub fn new(period: usize) -> Self {
        Self {
            period,
            gains: VecDeque::with_capacity(period),
            losses: VecDeque::with_capacity(period),
            avg_gain: None,
            avg_loss: None,
            prev_close: None,
        }
    }
}

impl Indicator for RSI {
    fn name(&self) -> &str { "RSI" }
    
    fn update(&mut self, candle: &Candle) -> Option<IndicatorValue> {
        // Wilder smoothing implementation
        // ... (full implementation)
    }
    
    fn reset(&mut self) {
        self.gains.clear();
        self.losses.clear();
        self.avg_gain = None;
        self.avg_loss = None;
        self.prev_close = None;
    }
}
```

### Python ML Signal Enhancement

```python
# signals/ml_enhancer.py
import torch
import torch.nn as nn
from typing import Dict, List, Optional
import numpy as np

class SignalEnhancerModel(nn.Module):
    """
    LSTM-based signal quality enhancement model.
    Takes raw indicator values and predicts optimal entry quality.
    """
    
    def __init__(
        self,
        input_dim: int = 14,  # Number of indicators
        hidden_dim: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2
    ):
        super().__init__()
        
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout,
            bidirectional=True
        )
        
        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_dim * 2,
            num_heads=8,
            dropout=dropout
        )
        
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim * 2, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 3)  # [probability_long, probability_short, probability_neutral]
        )
        
        self.quality_head = nn.Sequential(
            nn.Linear(hidden_dim * 2, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()  # Signal quality 0-1
        )
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        # x shape: (batch, sequence_length, input_dim)
        lstm_out, _ = self.lstm(x)
        
        # Self-attention
        attn_out, _ = self.attention(lstm_out, lstm_out, lstm_out)
        
        # Use last timestep
        features = attn_out[:, -1, :]
        
        return {
            'direction': self.classifier(features),
            'quality': self.quality_head(features)
        }


class SignalEnhancer:
    """Production signal enhancement service."""
    
    def __init__(self, model_path: str):
        self.model = SignalEnhancerModel()
        self.model.load_state_dict(torch.load(model_path))
        self.model.eval()
    
    def enhance(
        self,
        indicators: Dict[str, float],
        lookback: List[Dict[str, float]]
    ) -> Dict:
        # Prepare input tensor
        sequence = self._prepare_sequence(indicators, lookback)
        
        with torch.no_grad():
            output = self.model(sequence)
        
        direction_probs = torch.softmax(output['direction'], dim=-1)
        quality = output['quality'].item()
        
        return {
            'long_probability': direction_probs[0, 0].item(),
            'short_probability': direction_probs[0, 1].item(),
            'neutral_probability': direction_probs[0, 2].item(),
            'signal_quality': quality,
            'recommended_action': self._get_action(direction_probs, quality)
        }
    
    def _get_action(self, probs: torch.Tensor, quality: float) -> str:
        if quality < 0.6:
            return 'WAIT'
        
        max_idx = probs.argmax().item()
        max_prob = probs[0, max_idx].item()
        
        if max_prob < 0.7:
            return 'WAIT'
        
        return ['LONG', 'SHORT', 'NEUTRAL'][max_idx]
```

---

## Order Execution Layer

### Order Placement Options

| Method | Latency | Reliability | Features | Best For |
|--------|---------|-------------|----------|----------|
| **KuCoin REST API** | 50-200ms | High | Full order types | Standard trading |
| **KuCoin WebSocket** | 10-50ms | High | Limited types | Speed-critical |
| **CCXT Library** | 100-300ms | Medium | Multi-exchange | Arbitrage |
| **Custom Rust Client** | 5-20ms | Highest | Full control | HFT |
| **FIX Protocol** | 1-5ms | Highest | Institutional | Co-located |

### Rust Order Execution Engine

```rust
// src/execution/order_manager.rs
use tokio::sync::mpsc;
use rust_decimal::Decimal;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct OrderRequest {
    pub id: String,
    pub symbol: String,
    pub side: Side,
    pub order_type: OrderType,
    pub size: Decimal,
    pub price: Option<Decimal>,
    pub stop_price: Option<Decimal>,
    pub leverage: u8,
    pub reduce_only: bool,
    pub client_oid: String,
    pub time_in_force: TimeInForce,
}

#[derive(Debug, Clone)]
pub enum OrderType {
    Market,
    Limit,
    StopMarket,
    StopLimit,
    TakeProfit,
    TrailingStop { callback_rate: Decimal },
}

#[derive(Debug, Clone)]
pub enum Side {
    Buy,
    Sell,
}

#[derive(Debug, Clone)]
pub enum TimeInForce {
    GTC,  // Good Till Cancel
    IOC,  // Immediate or Cancel
    FOK,  // Fill or Kill
    GTX,  // Good Till Crossing (Post Only)
}

pub struct OrderManager {
    client: KuCoinClient,
    pending_orders: HashMap<String, OrderRequest>,
    position_tracker: PositionTracker,
    risk_checker: RiskChecker,
    order_tx: mpsc::Sender<OrderEvent>,
}

impl OrderManager {
    pub async fn place_order(&mut self, request: OrderRequest) -> Result<OrderResponse, OrderError> {
        // Pre-flight checks
        self.risk_checker.validate(&request)?;
        
        // Check position limits
        self.position_tracker.check_limits(&request)?;
        
        // Place order
        let response = match request.order_type {
            OrderType::Market => self.place_market_order(&request).await?,
            OrderType::Limit => self.place_limit_order(&request).await?,
            OrderType::StopMarket => self.place_stop_market(&request).await?,
            OrderType::StopLimit => self.place_stop_limit(&request).await?,
            OrderType::TrailingStop { callback_rate } => {
                self.place_trailing_stop(&request, callback_rate).await?
            }
            _ => return Err(OrderError::UnsupportedOrderType),
        };
        
        // Track order
        self.pending_orders.insert(response.order_id.clone(), request);
        
        // Emit event
        self.order_tx.send(OrderEvent::Placed(response.clone())).await?;
        
        Ok(response)
    }
    
    async fn place_market_order(&self, req: &OrderRequest) -> Result<OrderResponse, OrderError> {
        let payload = json!({
            "clientOid": req.client_oid,
            "symbol": req.symbol,
            "side": req.side.to_string().to_lowercase(),
            "type": "market",
            "size": req.size.to_string(),
            "leverage": req.leverage.to_string(),
            "reduceOnly": req.reduce_only,
        });
        
        self.client.post("/api/v1/orders", payload).await
    }
}

// Smart Order Router
pub struct SmartOrderRouter {
    order_manager: OrderManager,
    order_book: OrderBookSnapshot,
    slippage_model: SlippageModel,
}

impl SmartOrderRouter {
    /// Execute order with minimal slippage
    pub async fn execute_smart(
        &mut self,
        side: Side,
        size: Decimal,
        max_slippage_bps: u32,
    ) -> Result<ExecutionReport, ExecutionError> {
        let book = &self.order_book;
        
        // Calculate optimal execution strategy
        let strategy = self.calculate_strategy(side, size, max_slippage_bps);
        
        match strategy {
            ExecutionStrategy::SingleMarket => {
                self.execute_market(side, size).await
            }
            ExecutionStrategy::TWAP { slices, interval } => {
                self.execute_twap(side, size, slices, interval).await
            }
            ExecutionStrategy::Iceberg { visible_size } => {
                self.execute_iceberg(side, size, visible_size).await
            }
            ExecutionStrategy::LimitChase { initial_price, chase_ticks } => {
                self.execute_limit_chase(side, size, initial_price, chase_ticks).await
            }
        }
    }
}
```

### KuCoin API Client (Node.js)

```typescript
// src/clients/kucoin/futures.ts
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

interface KuCoinConfig {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  sandbox?: boolean;
}

interface OrderParams {
  clientOid?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  size: number;
  price?: number;
  leverage?: number;
  stopPrice?: number;
  stopPriceType?: 'TP' | 'IP' | 'MP';
  reduceOnly?: boolean;
  closeOrder?: boolean;
  forceHold?: boolean;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  postOnly?: boolean;
  hidden?: boolean;
  iceberg?: boolean;
  visibleSize?: number;
}

export class KuCoinFuturesClient {
  private baseUrl: string;
  private client: AxiosInstance;
  private config: KuCoinConfig;
  
  constructor(config: KuCoinConfig) {
    this.config = config;
    this.baseUrl = config.sandbox 
      ? 'https://api-sandbox-futures.kucoin.com'
      : 'https://api-futures.kucoin.com';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
    
    this.client.interceptors.request.use((config) => {
      const timestamp = Date.now().toString();
      const signature = this.sign(
        timestamp,
        config.method?.toUpperCase() || 'GET',
        config.url || '',
        config.data ? JSON.stringify(config.data) : ''
      );
      
      config.headers['KC-API-KEY'] = this.config.apiKey;
      config.headers['KC-API-SIGN'] = signature;
      config.headers['KC-API-TIMESTAMP'] = timestamp;
      config.headers['KC-API-PASSPHRASE'] = this.signPassphrase();
      config.headers['KC-API-KEY-VERSION'] = '2';
      config.headers['Content-Type'] = 'application/json';
      
      return config;
    });
  }
  
  private sign(timestamp: string, method: string, path: string, body: string): string {
    const message = timestamp + method + path + body;
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(message)
      .digest('base64');
  }
  
  private signPassphrase(): string {
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(this.config.passphrase)
      .digest('base64');
  }
  
  // ============================================
  // ORDER METHODS
  // ============================================
  
  async placeOrder(params: OrderParams): Promise<OrderResponse> {
    const response = await this.client.post('/api/v1/orders', {
      clientOid: params.clientOid || crypto.randomUUID(),
      ...params,
    });
    return response.data.data;
  }
  
  async cancelOrder(orderId: string): Promise<void> {
    await this.client.delete(`/api/v1/orders/${orderId}`);
  }
  
  async cancelAllOrders(symbol?: string): Promise<CancelAllResponse> {
    const response = await this.client.delete('/api/v1/orders', {
      params: { symbol }
    });
    return response.data.data;
  }
  
  async getOrder(orderId: string): Promise<Order> {
    const response = await this.client.get(`/api/v1/orders/${orderId}`);
    return response.data.data;
  }
  
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const response = await this.client.get('/api/v1/orders', {
      params: { status: 'active', symbol }
    });
    return response.data.data.items;
  }
  
  // ============================================
  // POSITION METHODS
  // ============================================
  
  async getPosition(symbol: string): Promise<Position> {
    const response = await this.client.get(`/api/v1/position`, {
      params: { symbol }
    });
    return response.data.data;
  }
  
  async getPositions(): Promise<Position[]> {
    const response = await this.client.get('/api/v1/positions');
    return response.data.data;
  }
  
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.client.post('/api/v1/position/margin/auto-deposit-status', {
      symbol,
      autoDeposit: false,
    });
  }
  
  // ============================================
  // ACCOUNT METHODS
  // ============================================
  
  async getAccountOverview(currency?: string): Promise<AccountOverview> {
    const response = await this.client.get('/api/v1/account-overview', {
      params: { currency: currency || 'USDT' }
    });
    return response.data.data;
  }
  
  // ============================================
  // MARKET DATA
  // ============================================
  
  async getTicker(symbol: string): Promise<Ticker> {
    const response = await this.client.get(`/api/v1/ticker`, {
      params: { symbol }
    });
    return response.data.data;
  }
  
  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    const response = await this.client.get(`/api/v1/level2/snapshot`, {
      params: { symbol }
    });
    return response.data.data;
  }
  
  async getCandles(
    symbol: string,
    granularity: number,
    from?: number,
    to?: number
  ): Promise<Candle[]> {
    const response = await this.client.get('/api/v1/kline/query', {
      params: { symbol, granularity, from, to }
    });
    return response.data.data;
  }
}
```

---

## Dashboard & UI Layer

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRADING DASHBOARD                                 │
│                        (Next.js 14 + React)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         TOP BAR                                     │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │ │
│  │  │ Balance │ │ P&L     │ │ Win Rate│ │ Open Pos│ │ Alerts  │      │ │
│  │  │ $10,234 │ │ +$1,234 │ │ 67.5%   │ │ 3       │ │ 🔔 2    │      │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────┐ ┌──────────────────────────────┐  │
│  │         CHART PANEL             │ │      POSITIONS PANEL         │  │
│  │  ┌───────────────────────────┐  │ │  ┌──────────────────────────┐│  │
│  │  │                           │  │ │  │ ETH/USDT  LONG  +2.34%  ││  │
│  │  │    TradingView Chart      │  │ │  │ Entry: 3,245.50         ││  │
│  │  │                           │  │ │  │ Size: 0.5 ETH           ││  │
│  │  │    • Candlesticks         │  │ │  │ P&L: +$38.50            ││  │
│  │  │    • Indicators           │  │ │  │ [Close] [Add] [TP/SL]   ││  │
│  │  │    • Drawing Tools        │  │ │  └──────────────────────────┘│  │
│  │  │    • Order Visualization  │  │ │  ┌──────────────────────────┐│  │
│  │  │                           │  │ │  │ BTC/USDT  SHORT -0.5%   ││  │
│  │  └───────────────────────────┘  │ │  │ Entry: 98,450.00        ││  │
│  │                                  │ │  │ Size: 0.02 BTC          ││  │
│  │  ┌───────────────────────────┐  │ │  │ P&L: -$12.30            ││  │
│  │  │    INDICATOR VALUES       │  │ │  └──────────────────────────┘│  │
│  │  │ RSI: 45.2  MACD: +12.3   │  │ └──────────────────────────────┘  │
│  │  │ BB: Mid    ATR: 1.2%     │  │                                    │
│  │  └───────────────────────────┘  │ ┌──────────────────────────────┐  │
│  └─────────────────────────────────┘ │      ORDER PANEL             │  │
│                                       │  ┌──────────────────────────┐│  │
│  ┌─────────────────────────────────┐ │  │ Symbol: [ETH/USDT ▼]    ││  │
│  │         SIGNALS PANEL           │ │  │ Side:   [LONG] [SHORT]  ││  │
│  │  ┌───────────────────────────┐  │ │  │ Type:   [Market ▼]      ││  │
│  │  │ 14:32:15 ETH LONG  +85   │  │ │  │ Size:   [____] ETH      ││  │
│  │  │ 14:28:43 BTC SHORT +92   │  │ │  │ Leverage: [10x]         ││  │
│  │  │ 14:25:11 SOL LONG  +78   │  │ │  │                          ││  │
│  │  │ 14:21:55 ETH NEUTRAL     │  │ │  │ TP: [____]  SL: [____]  ││  │
│  │  └───────────────────────────┘  │ │  │                          ││  │
│  └─────────────────────────────────┘ │  │ [     PLACE ORDER     ] ││  │
│                                       │  └──────────────────────────┘│  │
│  ┌─────────────────────────────────┐ └──────────────────────────────┘  │
│  │         TRADE HISTORY           │                                    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │
│  │  │ Time     │ Symbol │ Side │ Entry  │ Exit   │ P&L    │ ROI   │  │
│  │  │ 14:30:00 │ ETH    │ LONG │ 3,200  │ 3,245  │ +$45   │ +1.4% │  │
│  │  │ 13:15:00 │ BTC    │ SHORT│ 99,000 │ 98,200 │ +$80   │ +0.8% │  │
│  │  │ 12:45:00 │ SOL    │ LONG │ 180.50 │ 178.20 │ -$23   │ -1.3% │  │
│  │  └──────────────────────────────────────────────────────────────┘  │
│  └─────────────────────────────────┘                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Frontend Tech Stack

```typescript
// package.json dependencies
{
  "dependencies": {
    // Core
    "next": "14.1.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "typescript": "5.3.3",
    
    // State Management
    "zustand": "4.4.7",
    "immer": "10.0.3",
    "@tanstack/react-query": "5.17.9",
    
    // Real-time
    "socket.io-client": "4.7.4",
    
    // Charts
    "lightweight-charts": "4.1.1",
    "@tremor/react": "3.13.0",
    "recharts": "2.10.3",
    
    // UI Components
    "@radix-ui/react-dialog": "1.0.5",
    "@radix-ui/react-dropdown-menu": "2.0.6",
    "@radix-ui/react-tabs": "1.0.4",
    "tailwindcss": "3.4.1",
    "class-variance-authority": "0.7.0",
    "clsx": "2.1.0",
    
    // Forms
    "react-hook-form": "7.49.3",
    "zod": "3.22.4",
    "@hookform/resolvers": "3.3.4",
    
    // Data
    "decimal.js": "10.4.3",
    "date-fns": "3.2.0",
    
    // Auth
    "next-auth": "4.24.5"
  }
}
```

### Real-time State Management

```typescript
// stores/trading.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import Decimal from 'decimal.js';

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: Decimal;
  entryPrice: Decimal;
  currentPrice: Decimal;
  pnl: Decimal;
  pnlPercent: Decimal;
  leverage: number;
  liquidationPrice: Decimal;
  stopLoss?: Decimal;
  takeProfit?: Decimal;
}

interface Signal {
  id: string;
  timestamp: number;
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  score: number;
  indicators: Record<string, number>;
  confidence: number;
}

interface TradingState {
  // Account
  balance: Decimal;
  equity: Decimal;
  availableMargin: Decimal;
  
  // Positions
  positions: Map<string, Position>;
  
  // Signals
  signals: Signal[];
  
  // Market Data
  tickers: Map<string, Ticker>;
  orderBooks: Map<string, OrderBook>;
  
  // Actions
  updatePosition: (position: Position) => void;
  closePosition: (id: string) => void;
  addSignal: (signal: Signal) => void;
  updateTicker: (symbol: string, ticker: Ticker) => void;
  setBalance: (balance: Decimal) => void;
}

export const useTradingStore = create<TradingState>()(
  immer((set, get) => ({
    balance: new Decimal(0),
    equity: new Decimal(0),
    availableMargin: new Decimal(0),
    positions: new Map(),
    signals: [],
    tickers: new Map(),
    orderBooks: new Map(),
    
    updatePosition: (position) => set((state) => {
      state.positions.set(position.id, position);
    }),
    
    closePosition: (id) => set((state) => {
      state.positions.delete(id);
    }),
    
    addSignal: (signal) => set((state) => {
      state.signals.unshift(signal);
      if (state.signals.length > 100) {
        state.signals.pop();
      }
    }),
    
    updateTicker: (symbol, ticker) => set((state) => {
      state.tickers.set(symbol, ticker);
      
      // Update position P&L
      for (const [id, pos] of state.positions) {
        if (pos.symbol === symbol) {
          pos.currentPrice = new Decimal(ticker.price);
          pos.pnl = calculatePnL(pos);
          pos.pnlPercent = calculatePnLPercent(pos);
        }
      }
    }),
    
    setBalance: (balance) => set((state) => {
      state.balance = balance;
    }),
  }))
);
```

---

## Repository Structure

### Monorepo Architecture

```
miniature-enigma-v6/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Continuous integration
│   │   ├── cd-staging.yml            # Deploy to staging
│   │   ├── cd-production.yml         # Deploy to production
│   │   └── rust-security.yml         # Rust security audit
│   └── CODEOWNERS
│
├── apps/
│   │
│   ├── execution-engine/             # RUST - Core execution
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── lib.rs
│   │   │   ├── config/
│   │   │   ├── clients/
│   │   │   │   ├── kucoin/
│   │   │   │   │   ├── mod.rs
│   │   │   │   │   ├── rest.rs
│   │   │   │   │   ├── websocket.rs
│   │   │   │   │   └── types.rs
│   │   │   │   └── mod.rs
│   │   │   ├── execution/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── order_manager.rs
│   │   │   │   ├── position_tracker.rs
│   │   │   │   └── smart_router.rs
│   │   │   ├── indicators/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rsi.rs
│   │   │   │   ├── macd.rs
│   │   │   │   ├── bollinger.rs
│   │   │   │   ├── stochrsi.rs
│   │   │   │   ├── atr.rs
│   │   │   │   └── divergence.rs
│   │   │   ├── risk/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── position_sizer.rs
│   │   │   │   ├── stop_manager.rs
│   │   │   │   └── circuit_breaker.rs
│   │   │   └── utils/
│   │   └── tests/
│   │
│   ├── api-gateway/                  # NODE.JS - REST/WS API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── config/
│   │   │   ├── routes/
│   │   │   │   ├── orders.ts
│   │   │   │   ├── positions.ts
│   │   │   │   ├── signals.ts
│   │   │   │   ├── account.ts
│   │   │   │   └── webhooks.ts
│   │   │   ├── websocket/
│   │   │   │   ├── server.ts
│   │   │   │   ├── handlers.ts
│   │   │   │   └── middleware.ts
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── utils/
│   │   └── tests/
│   │
│   ├── signal-processor/             # PYTHON - ML & Signals
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   ├── src/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── indicators/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── technical.py
│   │   │   │   └── custom.py
│   │   │   ├── ml/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models/
│   │   │   │   ├── training/
│   │   │   │   └── inference.py
│   │   │   ├── signals/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── generator.py
│   │   │   │   ├── scorer.py
│   │   │   │   └── enhancer.py
│   │   │   └── utils/
│   │   └── tests/
│   │
│   ├── dashboard/                    # NEXT.JS - Trading UI
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── trading/
│   │   │   │   ├── positions/
│   │   │   │   ├── history/
│   │   │   │   ├── settings/
│   │   │   │   └── api/
│   │   │   ├── components/
│   │   │   │   ├── charts/
│   │   │   │   ├── trading/
│   │   │   │   ├── positions/
│   │   │   │   └── ui/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   └── public/
│   │
│   └── data-collector/               # NODE.JS - Data Ingestion
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── websocket/
│       │   │   ├── kucoin.ts
│       │   │   ├── binance.ts
│       │   │   └── manager.ts
│       │   ├── webhooks/
│       │   │   ├── tradingview.ts
│       │   │   └── custom.ts
│       │   ├── aggregators/
│       │   │   ├── ohlcv.ts
│       │   │   └── orderbook.ts
│       │   └── publishers/
│       │       ├── redis.ts
│       │       └── timescale.ts
│       └── tests/
│
├── packages/                         # Shared packages
│   │
│   ├── types/                        # TypeScript types
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── orders.ts
│   │       ├── positions.ts
│   │       ├── candles.ts
│   │       └── signals.ts
│   │
│   ├── utils/                        # Shared utilities
│   │   ├── package.json
│   │   └── src/
│   │       ├── decimal.ts
│   │       ├── time.ts
│   │       ├── validation.ts
│   │       └── crypto.ts
│   │
│   ├── config/                       # Shared configuration
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── env.ts
│   │       └── schema.ts
│   │
│   └── database/                     # Database schemas
│       ├── package.json
│       ├── prisma/
│       │   └── schema.prisma
│       └── migrations/
│
├── infrastructure/                   # IaC & Deployment
│   │
│   ├── docker/
│   │   ├── execution-engine.Dockerfile
│   │   ├── api-gateway.Dockerfile
│   │   ├── signal-processor.Dockerfile
│   │   ├── dashboard.Dockerfile
│   │   └── data-collector.Dockerfile
│   │
│   ├── docker-compose/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.dev.yml
│   │   └── docker-compose.prod.yml
│   │
│   ├── kubernetes/
│   │   ├── namespaces/
│   │   ├── deployments/
│   │   ├── services/
│   │   ├── configmaps/
│   │   ├── secrets/
│   │   └── ingress/
│   │
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── modules/
│           ├── vpc/
│           ├── eks/
│           ├── rds/
│           └── redis/
│
├── scripts/
│   ├── setup.sh
│   ├── build.sh
│   ├── deploy.sh
│   └── test.sh
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   └── runbooks/
│
├── .env.example
├── .gitignore
├── README.md
├── CHANGELOG.md
├── LICENSE
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # pnpm workspaces
└── package.json                      # Root package.json
```

---

## Comprehensive Service Matrix

### All Services & Technologies

| Service | Language | Framework | Purpose | Port |
|---------|----------|-----------|---------|------|
| **execution-engine** | Rust | Tokio, Axum | Order execution, indicators | 8001 |
| **api-gateway** | TypeScript | Fastify | REST/WebSocket API | 3000 |
| **signal-processor** | Python | FastAPI | ML inference, signals | 8002 |
| **dashboard** | TypeScript | Next.js | Trading UI | 3001 |
| **data-collector** | TypeScript | Node.js | Data ingestion | 8003 |
| **webhook-receiver** | TypeScript | Fastify | TradingView webhooks | 8004 |

### Database Services

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| **timescaledb** | TimescaleDB | OHLCV time-series | 5432 |
| **postgres** | PostgreSQL | Orders, positions, users | 5433 |
| **redis** | Redis 7 | Cache, pub/sub, rate limit | 6379 |
| **influxdb** | InfluxDB | Metrics, monitoring | 8086 |

### Infrastructure Services

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| **nginx** | NGINX | Reverse proxy, SSL | 80/443 |
| **prometheus** | Prometheus | Metrics collection | 9090 |
| **grafana** | Grafana | Dashboards | 3002 |
| **loki** | Loki | Log aggregation | 3100 |
| **jaeger** | Jaeger | Distributed tracing | 16686 |
| **vector** | Vector | Log shipping | 8687 |

---

## Webhooks & Integrations

### TradingView Integration

```typescript
// apps/webhook-receiver/src/tradingview.ts
import { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import crypto from 'crypto';

interface TradingViewAlert {
  secret: string;
  timestamp: string;
  exchange: string;
  symbol: string;
  interval: string;
  action: string;
  indicators: {
    rsi: number;
    macd: number;
    macd_signal: number;
    macd_hist: number;
    bb_upper: number;
    bb_middle: number;
    bb_lower: number;
    atr: number;
    volume: number;
    close: number;
    open: number;
    high: number;
    low: number;
  };
  conditions: {
    rsi_oversold?: boolean;
    macd_cross?: string;
  };
}

export function registerTradingViewWebhook(
  app: FastifyInstance,
  redis: Redis,
  config: WebhookConfig
) {
  app.post('/webhooks/tradingview', {
    schema: {
      body: {
        type: 'object',
        required: ['secret', 'symbol', 'indicators'],
        properties: {
          secret: { type: 'string' },
          symbol: { type: 'string' },
          // ... full schema
        }
      }
    },
    handler: async (request, reply) => {
      const alert = request.body as TradingViewAlert;
      
      // Verify secret
      if (alert.secret !== config.tradingViewSecret) {
        return reply.code(401).send({ error: 'Invalid secret' });
      }
      
      // Idempotency check
      const idempotencyKey = `tv:${alert.symbol}:${alert.timestamp}`;
      const exists = await redis.get(idempotencyKey);
      if (exists) {
        return reply.code(200).send({ status: 'duplicate' });
      }
      await redis.setex(idempotencyKey, 60, '1');
      
      // Normalize and publish
      const normalizedSignal = {
        id: crypto.randomUUID(),
        source: 'tradingview',
        timestamp: Date.now(),
        symbol: normalizeSymbol(alert.symbol),
        timeframe: alert.interval,
        indicators: alert.indicators,
        action: alert.action,
        conditions: alert.conditions
      };
      
      // Publish to Redis stream
      await redis.xadd(
        'signals:incoming',
        '*',
        'data',
        JSON.stringify(normalizedSignal)
      );
      
      // Log
      app.log.info({ signal: normalizedSignal }, 'TradingView signal received');
      
      return reply.code(200).send({
        status: 'received',
        id: normalizedSignal.id
      });
    }
  });
}

function normalizeSymbol(tvSymbol: string): string {
  // KUCOIN:ETHUSDTM -> ETHUSDTM
  const parts = tvSymbol.split(':');
  return parts[parts.length - 1];
}
```

### Custom Webhook Endpoints

```typescript
// apps/webhook-receiver/src/routes.ts

// 1. Indicator Values Webhook
app.post('/webhooks/indicators', async (req, reply) => {
  const { symbol, timeframe, indicators, timestamp } = req.body;
  
  await redis.xadd('indicators:raw', '*',
    'symbol', symbol,
    'timeframe', timeframe,
    'data', JSON.stringify(indicators),
    'timestamp', timestamp.toString()
  );
  
  return { status: 'received' };
});

// 2. Alert Webhook
app.post('/webhooks/alerts', async (req, reply) => {
  const { type, symbol, message, severity } = req.body;
  
  await redis.publish('alerts:incoming', JSON.stringify({
    type, symbol, message, severity,
    timestamp: Date.now()
  }));
  
  return { status: 'processed' };
});

// 3. External Signal Webhook
app.post('/webhooks/signals', async (req, reply) => {
  const { source, symbol, direction, confidence, metadata } = req.body;
  
  // Validate API key
  const apiKey = req.headers['x-api-key'];
  if (!validateApiKey(apiKey)) {
    return reply.code(401).send({ error: 'Invalid API key' });
  }
  
  await redis.xadd('signals:external', '*',
    'data', JSON.stringify({
      id: crypto.randomUUID(),
      source,
      symbol,
      direction,
      confidence,
      metadata,
      receivedAt: Date.now()
    })
  );
  
  return { status: 'queued' };
});
```

---

## Docker Compose Configuration

```yaml
# infrastructure/docker-compose/docker-compose.yml
version: '3.9'

services:
  # ============================================
  # DATABASES
  # ============================================
  
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    container_name: me-timescaledb
    environment:
      POSTGRES_USER: ${TIMESCALE_USER}
      POSTGRES_PASSWORD: ${TIMESCALE_PASSWORD}
      POSTGRES_DB: trading
    volumes:
      - timescale_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${TIMESCALE_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
  
  postgres:
    image: postgres:16-alpine
    container_name: me-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: miniature_enigma
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
  
  redis:
    image: redis:7-alpine
    container_name: me-redis
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
  
  influxdb:
    image: influxdb:2.7-alpine
    container_name: me-influxdb
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: ${INFLUX_USER}
      DOCKER_INFLUXDB_INIT_PASSWORD: ${INFLUX_PASSWORD}
      DOCKER_INFLUXDB_INIT_ORG: miniature-enigma
      DOCKER_INFLUXDB_INIT_BUCKET: trading
    volumes:
      - influx_data:/var/lib/influxdb2
    ports:
      - "8086:8086"
  
  # ============================================
  # APPLICATION SERVICES
  # ============================================
  
  execution-engine:
    build:
      context: ../../apps/execution-engine
      dockerfile: ../../infrastructure/docker/execution-engine.Dockerfile
    container_name: me-execution-engine
    environment:
      - RUST_LOG=info
      - REDIS_URL=redis://redis:6379
      - TIMESCALE_URL=postgres://${TIMESCALE_USER}:${TIMESCALE_PASSWORD}@timescaledb:5432/trading
      - KUCOIN_API_KEY=${KUCOIN_API_KEY}
      - KUCOIN_API_SECRET=${KUCOIN_API_SECRET}
      - KUCOIN_PASSPHRASE=${KUCOIN_PASSPHRASE}
    depends_on:
      redis:
        condition: service_healthy
      timescaledb:
        condition: service_healthy
    ports:
      - "8001:8001"
    restart: unless-stopped
  
  api-gateway:
    build:
      context: ../../apps/api-gateway
      dockerfile: ../../infrastructure/docker/api-gateway.Dockerfile
    container_name: me-api-gateway
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/miniature_enigma
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"
    restart: unless-stopped
  
  signal-processor:
    build:
      context: ../../apps/signal-processor
      dockerfile: ../../infrastructure/docker/signal-processor.Dockerfile
    container_name: me-signal-processor
    environment:
      - REDIS_URL=redis://redis:6379
      - TIMESCALE_URL=postgres://${TIMESCALE_USER}:${TIMESCALE_PASSWORD}@timescaledb:5432/trading
      - MODEL_PATH=/app/models
    volumes:
      - ./models:/app/models
    depends_on:
      redis:
        condition: service_healthy
      timescaledb:
        condition: service_healthy
    ports:
      - "8002:8002"
    restart: unless-stopped
  
  data-collector:
    build:
      context: ../../apps/data-collector
      dockerfile: ../../infrastructure/docker/data-collector.Dockerfile
    container_name: me-data-collector
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - TIMESCALE_URL=postgres://${TIMESCALE_USER}:${TIMESCALE_PASSWORD}@timescaledb:5432/trading
      - KUCOIN_API_KEY=${KUCOIN_API_KEY}
      - KUCOIN_API_SECRET=${KUCOIN_API_SECRET}
      - KUCOIN_PASSPHRASE=${KUCOIN_PASSPHRASE}
    depends_on:
      redis:
        condition: service_healthy
      timescaledb:
        condition: service_healthy
    ports:
      - "8003:8003"
    restart: unless-stopped
  
  webhook-receiver:
    build:
      context: ../../apps/api-gateway
      dockerfile: ../../infrastructure/docker/api-gateway.Dockerfile
    container_name: me-webhook-receiver
    command: ["node", "dist/webhook-server.js"]
    environment:
      - NODE_ENV=production
      - PORT=8004
      - REDIS_URL=redis://redis:6379
      - TRADINGVIEW_SECRET=${TRADINGVIEW_SECRET}
    depends_on:
      redis:
        condition: service_healthy
    ports:
      - "8004:8004"
    restart: unless-stopped
  
  dashboard:
    build:
      context: ../../apps/dashboard
      dockerfile: ../../infrastructure/docker/dashboard.Dockerfile
    container_name: me-dashboard
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://api-gateway:3000
      - NEXT_PUBLIC_WS_URL=ws://api-gateway:3000
    depends_on:
      - api-gateway
    ports:
      - "3001:3000"
    restart: unless-stopped
  
  # ============================================
  # MONITORING
  # ============================================
  
  prometheus:
    image: prom/prometheus:v2.48.1
    container_name: me-prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9090:9090"
    restart: unless-stopped
  
  grafana:
    image: grafana/grafana:10.2.3
    container_name: me-grafana
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3002:3000"
    depends_on:
      - prometheus
    restart: unless-stopped
  
  loki:
    image: grafana/loki:2.9.3
    container_name: me-loki
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki
    restart: unless-stopped
  
  # ============================================
  # REVERSE PROXY
  # ============================================
  
  nginx:
    image: nginx:alpine
    container_name: me-nginx
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api-gateway
      - dashboard
      - webhook-receiver
    restart: unless-stopped

volumes:
  timescale_data:
  postgres_data:
  redis_data:
  influx_data:
  prometheus_data:
  grafana_data:
  loki_data:

networks:
  default:
    name: miniature-enigma
    driver: bridge
```

---

## Cost Estimation

### Infrastructure Costs (Monthly)

| Component | Provider | Spec | Cost/Month |
|-----------|----------|------|------------|
| **VPS/Server** | Hetzner/DigitalOcean | 8 vCPU, 32GB RAM | $80-160 |
| **TimescaleDB** | Self-hosted | 100GB storage | Included |
| **Redis** | Self-hosted | 512MB | Included |
| **Domain + SSL** | Cloudflare | Pro plan | $20 |
| **Monitoring** | Self-hosted | Grafana stack | Included |
| **Backup** | Backblaze B2 | 100GB | $0.50 |
| **Total DIY** | | | **~$100-180/mo** |

### Managed Services Alternative

| Component | Provider | Spec | Cost/Month |
|-----------|----------|------|------------|
| **Compute** | AWS ECS/EKS | t3.xlarge | $150-300 |
| **Database** | AWS RDS + TimescaleDB | db.r6g.large | $200-400 |
| **Redis** | AWS ElastiCache | cache.r6g.large | $150-300 |
| **Load Balancer** | AWS ALB | | $30 |
| **Monitoring** | Datadog/NewRelic | | $50-100 |
| **Total Managed** | | | **~$600-1200/mo** |

---

## Summary

### Key Decisions

1. **Webhooks for Indicators**: YES - TradingView webhooks for discretionary signals, local Rust calculation for speed-critical
2. **Order Placement**: KuCoin REST API with Rust client for lowest latency, fallback to Node.js CCXT
3. **Real-time Data**: WebSocket streams with Redis pub/sub for distribution
4. **Dashboard**: Next.js with TradingView Lightweight Charts
5. **Persistence**: TimescaleDB for OHLCV, PostgreSQL for orders/positions

### Next Steps

1. Set up monorepo with Turborepo
2. Implement Rust execution engine core
3. Build webhook receiver service
4. Create API gateway with authentication
5. Build dashboard MVP
6. Deploy with Docker Compose
7. Add monitoring and alerting
8. Implement ML signal enhancement

This architecture supports:
- Sub-millisecond indicator calculation (Rust)
- Real-time dashboard updates (<100ms latency)
- 1000+ signals/second processing
- 99.9% uptime with failover
- Full audit trail and compliance
