'use strict';

/**
 * KuCoin Futures API Client
 * 
 * REST + WebSocket integration with:
 * - Dynamic WebSocket token management
 * - Rate limiting
 * - Error handling with retries
 * 
 * @module KuCoinClient
 */

const crypto = require('crypto');
const EventEmitter = require('events');

// KuCoin Futures endpoints
const REST_BASE = 'https://api-futures.kucoin.com';
const API_VERSION = '/api/v1';

class KuCoinClient extends EventEmitter {
  /**
   * @param {Object} config
   * @param {string} [config.apiKey] - API key (for authenticated endpoints)
   * @param {string} [config.apiSecret] - API secret
   * @param {string} [config.passphrase] - API passphrase
   * @param {boolean} [config.sandbox=false] - Use sandbox
   */
  constructor(config = {}) {
    super();
    
    this.apiKey = config.apiKey || '';
    this.apiSecret = config.apiSecret || '';
    this.passphrase = config.passphrase || '';
    this.sandbox = config.sandbox || false;
    
    this.baseUrl = this.sandbox 
      ? 'https://api-sandbox-futures.kucoin.com' 
      : REST_BASE;
    
    // WebSocket state
    this.ws = null;
    this.wsEndpoint = null;
    this.wsToken = null;
    this.pingInterval = 18000;
    this.pingTimer = null;
    this.tokenRefreshTimer = null;
    this.connected = false;
    this.subscriptions = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    // Rate limiting
    this.requestQueue = [];
    this.requestsPerSecond = 10;
    this.lastRequestTime = 0;
  }

  /**
   * Generate signature for authenticated requests
   */
  _sign(timestamp, method, endpoint, body = '') {
    const message = `${timestamp}${method}${endpoint}${body}`;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('base64');
  }

  /**
   * Make HTTP request with rate limiting
   */
  async _request(method, endpoint, data = null, auth = false) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    const minInterval = 1000 / this.requestsPerSecond;
    
    if (timeSinceLast < minInterval) {
      await new Promise(r => setTimeout(r, minInterval - timeSinceLast));
    }
    
    this.lastRequestTime = Date.now();
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    
    if (auth && this.apiKey) {
      const timestamp = Date.now().toString();
      const body = data ? JSON.stringify(data) : '';
      const signature = this._sign(timestamp, method, endpoint, body);
      
      headers['KC-API-KEY'] = this.apiKey;
      headers['KC-API-SIGN'] = signature;
      headers['KC-API-TIMESTAMP'] = timestamp;
      headers['KC-API-PASSPHRASE'] = crypto
        .createHmac('sha256', this.apiSecret)
        .update(this.passphrase)
        .digest('base64');
      headers['KC-API-KEY-VERSION'] = '2';
    }
    
    const options = { method, headers };
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    const json = await response.json();
    
    if (json.code !== '200000') {
      throw new Error(`KuCoin API error: ${json.msg || json.code}`);
    }
    
    return json.data;
  }

  // ============================================
  // PUBLIC REST ENDPOINTS
  // ============================================

  /**
   * Get active contracts
   */
  async getActiveContracts() {
    return this._request('GET', `${API_VERSION}/contracts/active`);
  }

  /**
   * Get contract details
   */
  async getContract(symbol) {
    return this._request('GET', `${API_VERSION}/contracts/${symbol}`);
  }

  /**
   * Get ticker
   */
  async getTicker(symbol) {
    return this._request('GET', `${API_VERSION}/ticker?symbol=${symbol}`);
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol, depth = 20) {
    return this._request('GET', `${API_VERSION}/level2/depth${depth}?symbol=${symbol}`);
  }

  /**
   * Get klines/candlesticks
   * @param {string} symbol
   * @param {number} granularity - Minutes (1, 5, 15, 30, 60, 120, 240, 480, 720, 1440, 10080)
   * @param {number} [from] - Start timestamp (seconds)
   * @param {number} [to] - End timestamp (seconds)
   */
  async getKlines(symbol, granularity, from, to) {
    let endpoint = `${API_VERSION}/kline/query?symbol=${symbol}&granularity=${granularity}`;
    if (from) endpoint += `&from=${from}`;
    if (to) endpoint += `&to=${to}`;
    return this._request('GET', endpoint);
  }

  /**
   * Get recent trades
   */
  async getTrades(symbol) {
    return this._request('GET', `${API_VERSION}/trade/history?symbol=${symbol}`);
  }

  /**
   * Get funding rate
   */
  async getFundingRate(symbol) {
    return this._request('GET', `${API_VERSION}/funding-rate/${symbol}/current`);
  }

  /**
   * Get mark price
   */
  async getMarkPrice(symbol) {
    return this._request('GET', `${API_VERSION}/mark-price/${symbol}/current`);
  }

  /**
   * Get index price
   */
  async getIndexList() {
    return this._request('GET', `${API_VERSION}/index/query`);
  }

  // ============================================
  // AUTHENTICATED REST ENDPOINTS
  // ============================================

  /**
   * Get account overview
   */
  async getAccountOverview(currency = 'USDT') {
    return this._request('GET', `${API_VERSION}/account-overview?currency=${currency}`, null, true);
  }

  /**
   * Get positions
   */
  async getPositions() {
    return this._request('GET', `${API_VERSION}/positions`, null, true);
  }

  /**
   * Get position by symbol
   */
  async getPosition(symbol) {
    return this._request('GET', `${API_VERSION}/position?symbol=${symbol}`, null, true);
  }

  /**
   * Place order
   */
  async placeOrder(order) {
    return this._request('POST', `${API_VERSION}/orders`, order, true);
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId) {
    return this._request('DELETE', `${API_VERSION}/orders/${orderId}`, null, true);
  }

  /**
   * Cancel all orders
   */
  async cancelAllOrders(symbol = null) {
    const endpoint = symbol 
      ? `${API_VERSION}/orders?symbol=${symbol}` 
      : `${API_VERSION}/orders`;
    return this._request('DELETE', endpoint, null, true);
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol = null) {
    const endpoint = symbol
      ? `${API_VERSION}/orders?status=active&symbol=${symbol}`
      : `${API_VERSION}/orders?status=active`;
    return this._request('GET', endpoint, null, true);
  }

  /**
   * Change leverage
   */
  async setLeverage(symbol, leverage) {
    return this._request('POST', `${API_VERSION}/position/margin/auto-deposit-status`, {
      symbol,
      leverage
    }, true);
  }

  // ============================================
  // WEBSOCKET
  // ============================================

  /**
   * Get WebSocket token (public or private)
   */
  async getWsToken(isPrivate = false) {
    const endpoint = isPrivate 
      ? `${API_VERSION}/bullet-private`
      : `${API_VERSION}/bullet-public`;
    
    const data = await this._request('POST', endpoint, null, isPrivate);
    
    if (!data.instanceServers || data.instanceServers.length === 0) {
      throw new Error('No WebSocket servers available');
    }
    
    const server = data.instanceServers[0];
    this.wsToken = data.token;
    this.wsEndpoint = `${server.endpoint}?token=${data.token}`;
    this.pingInterval = server.pingInterval || 18000;
    
    return {
      url: this.wsEndpoint,
      token: this.wsToken,
      pingInterval: this.pingInterval
    };
  }

  /**
   * Connect WebSocket
   */
  async connectWs(isPrivate = false) {
    if (this.connected) return;
    
    await this.getWsToken(isPrivate);
    
    return new Promise((resolve, reject) => {
      // Dynamic import for WebSocket
      const WebSocket = require('ws');
      this.ws = new WebSocket(this.wsEndpoint);
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 30000);
      
      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.reconnectAttempts = 0;
        this._startPing();
        this._scheduleTokenRefresh();
        this.emit('connected');
        resolve();
      });
      
      this.ws.on('message', (data) => this._handleMessage(data));
      
      this.ws.on('error', (err) => {
        this.emit('error', err);
      });
      
      this.ws.on('close', () => {
        this.connected = false;
        clearInterval(this.pingTimer);
        this.emit('disconnected');
        this._reconnect(isPrivate);
      });
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWs() {
    clearInterval(this.pingTimer);
    clearInterval(this.tokenRefreshTimer);
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.subscriptions.clear();
  }

  _startPing() {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.connected) {
        this.ws.send(JSON.stringify({
          id: Date.now().toString(),
          type: 'ping'
        }));
      }
    }, this.pingInterval);
  }

  _scheduleTokenRefresh() {
    // Refresh token every 23 hours
    this.tokenRefreshTimer = setInterval(async () => {
      try {
        await this.getWsToken(this.apiKey ? true : false);
      } catch (err) {
        this.emit('error', err);
      }
    }, 23 * 60 * 60 * 1000);
  }

  async _reconnect(isPrivate) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    await new Promise(r => setTimeout(r, delay));
    
    try {
      await this.connectWs(isPrivate);
      
      // Resubscribe
      for (const topic of this.subscriptions) {
        this._send({ type: 'subscribe', topic, response: true });
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  _handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    
    if (msg.type === 'pong') return;
    if (msg.type === 'ack') {
      this.emit('subscribed', msg);
      return;
    }
    
    if (msg.type === 'message') {
      this.emit('message', msg);
      this.emit(msg.subject, msg);
    }
  }

  _send(data) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({
        id: Date.now().toString(),
        ...data
      }));
    }
  }

  /**
   * Subscribe to topic
   */
  subscribe(topic) {
    this.subscriptions.add(topic);
    this._send({ type: 'subscribe', topic, response: true });
  }

  /**
   * Unsubscribe from topic
   */
  unsubscribe(topic) {
    this.subscriptions.delete(topic);
    this._send({ type: 'unsubscribe', topic, response: true });
  }

  // Subscription helpers
  subscribeTicker(symbol) {
    this.subscribe(`/contractMarket/ticker:${symbol}`);
  }

  subscribeCandles(symbol, interval) {
    this.subscribe(`/contractMarket/candle:${symbol}_${interval}`);
  }

  subscribeOrderBook(symbol, depth = 5) {
    this.subscribe(`/contractMarket/level2Depth${depth}:${symbol}`);
  }

  subscribeTrades(symbol) {
    this.subscribe(`/contractMarket/execution:${symbol}`);
  }

  subscribeInstrument(symbol) {
    this.subscribe(`/contract/instrument:${symbol}`);
  }

  // Private subscriptions (requires auth)
  subscribePositions() {
    this.subscribe('/contractMarket/position:all');
  }

  subscribeOrders() {
    this.subscribe('/contractMarket/tradeOrders');
  }
}

module.exports = KuCoinClient;
