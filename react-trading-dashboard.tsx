import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Types
interface TradingSignal {
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  timestamp: number;
}

interface Position {
  ticket: number;
  symbol: string;
  openPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  openTime: number;
}

interface AccountState {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  profit: number;
}

interface TradingState {
  signal: TradingSignal;
  account: AccountState;
  positions: Position[];
}

const TradingDashboard: React.FC = () => {
  const [state, setState] = useState<TradingState | null>(null);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [profitHistory, setProfitHistory] = useState<Array<{time: string, profit: number}>>([]);
  const ws = useRef<WebSocket | null>(null);
  const pingInterval = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close();
      if (pingInterval.current) clearInterval(pingInterval.current);
    };
  }, []);

  const connectWebSocket = () => {
    ws.current = new WebSocket('ws://localhost:8080');
    
    ws.current.onopen = () => {
      console.log('Connected to ETARE server');
      setConnected(true);
      
      // Ping every second to measure latency
      pingInterval.current = setInterval(() => {
        const start = Date.now();
        ws.current?.send(JSON.stringify({ action: 'GET_STATE', timestamp: start }));
      }, 1000);
    };
    
    ws.current.onmessage = (event) => {
      const end = Date.now();
      const data = JSON.parse(event.data);
      
      // Calculate latency
      if (data.timestamp) {
        setLatency(end - data.timestamp);
      }
      
      // Update state
      if (data.signal && data.account && data.positions) {
        setState(data);
        
        // Update profit history
        setProfitHistory(prev => {
          const newHistory = [...prev, {
            time: new Date().toLocaleTimeString(),
            profit: data.account.profit
          }];
          return newHistory.slice(-30); // Keep last 30 points
        });
      }
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };
    
    ws.current.onclose = () => {
      console.log('Disconnected from server');
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
  };

  const sendCommand = (action: string, params?: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action, ...params }));
    }
  };

  const executeBuy = (entryType: 'MARKET' | 'LIMIT' = 'MARKET') => {
    sendCommand('BUY', { entryType });
  };

  const executeSell = (entryType: 'MARKET' | 'LIMIT' = 'MARKET') => {
    sendCommand('SELL', { entryType });
  };

  const closePosition = (ticket: number) => {
    sendCommand('CLOSE_POSITION', { ticket });
  };

  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-xl">Connecting to ETARE Server...</p>
          <p className="text-sm text-gray-400 mt-2">
            {connected ? 'Loading data...' : 'Waiting for connection...'}
          </p>
        </div>
      </div>
    );
  }

  const { signal, account, positions } = state;
  const signalColor = signal.direction === 'BUY' ? 'text-green-500' : 
                      signal.direction === 'SELL' ? 'text-red-500' : 'text-gray-400';
  const signalBg = signal.direction === 'BUY' ? 'bg-green-500/20 border-green-500' : 
                   signal.direction === 'SELL' ? 'bg-red-500/20 border-red-500' : 
                   'bg-gray-500/20 border-gray-500';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">🤖 ETARE Trading Dashboard</h1>
          <p className="text-gray-400">Real-Time Evolutionary Trading System</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-400">Latency</div>
            <div className={`text-lg font-mono ${latency < 10 ? 'text-green-500' : 'text-yellow-500'}`}>
              {latency}ms
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Trading Signal */}
        <div className={`border-2 rounded-lg p-6 ${signalBg}`}>
          <h2 className="text-xl font-bold mb-4">📊 Market Signal</h2>
          
          <div className="text-center mb-4">
            <div className={`text-5xl font-black ${signalColor}`}>
              {signal.direction}
            </div>
            <div className="text-2xl font-bold mt-2">
              {signal.strength.toFixed(0)}%
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 mt-2">
              <div 
                className={`h-4 rounded-full ${
                  signal.direction === 'BUY' ? 'bg-green-500' : 
                  signal.direction === 'SELL' ? 'bg-red-500' : 'bg-gray-500'
                }`}
                style={{ width: `${signal.strength}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Entry:</span>
              <span className="font-mono">{signal.entryPrice.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Stop Loss:</span>
              <span className="font-mono text-red-400">{signal.stopLoss.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Take Profit:</span>
              <span className="font-mono text-green-400">{signal.takeProfit.toFixed(5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Risk:Reward:</span>
              <span className="font-mono">1:5.0</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-800 rounded text-xs">
            <div className="text-gray-400 mb-1">Analysis:</div>
            <div>{signal.reasoning}</div>
          </div>
        </div>

        {/* Account Info */}
        <div className="border-2 border-blue-500 rounded-lg p-6 bg-blue-500/10">
          <h2 className="text-xl font-bold mb-4">💰 Account</h2>
          
          <div className="space-y-4">
            <div>
              <div className="text-gray-400 text-sm">Balance</div>
              <div className="text-3xl font-bold">${account.balance.toFixed(2)}</div>
            </div>
            
            <div>
              <div className="text-gray-400 text-sm">Equity</div>
              <div className="text-2xl font-bold">${account.equity.toFixed(2)}</div>
            </div>
            
            <div className="flex justify-between text-sm">
              <div>
                <div className="text-gray-400">Margin</div>
                <div className="font-mono">${account.margin.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400">Free Margin</div>
                <div className="font-mono">${account.freeMargin.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-700">
              <div className="text-gray-400 text-sm">P&L</div>
              <div className={`text-3xl font-bold ${account.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {account.profit >= 0 ? '+' : ''}{account.profit.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-2 border-purple-500 rounded-lg p-6 bg-purple-500/10">
          <h2 className="text-xl font-bold mb-4">⚡ Quick Actions</h2>
          
          <div className="space-y-3">
            <button
              onClick={() => executeBuy('MARKET')}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg transition transform hover:scale-105"
            >
              🚀 BUY MARKET
            </button>
            
            <button
              onClick={() => executeBuy('LIMIT')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
            >
              📌 BUY LIMIT
            </button>
            
            <div className="border-t border-gray-700 my-4"></div>
            
            <button
              onClick={() => executeSell('MARKET')}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-lg transition transform hover:scale-105"
            >
              📉 SELL MARKET
            </button>
            
            <button
              onClick={() => executeSell('LIMIT')}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition"
            >
              📌 SELL LIMIT
            </button>
          </div>

          <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500 rounded-lg">
            <div className="text-yellow-500 font-bold text-sm mb-1">⚠️ Risk Warning</div>
            <div className="text-xs text-gray-300">
              Trading involves substantial risk. Only trade with money you can afford to lose.
            </div>
          </div>
        </div>
      </div>

      {/* Profit Chart */}
      <div className="border-2 border-gray-700 rounded-lg p-6 bg-gray-800/50 mb-6">
        <h2 className="text-xl font-bold mb-4">📈 Profit History</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={profitHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
              labelStyle={{ color: '#9CA3AF' }}
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#10B981" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Open Positions */}
      <div className="border-2 border-gray-700 rounded-lg p-6 bg-gray-800/50">
        <h2 className="text-xl font-bold mb-4">📋 Open Positions ({positions.length})</h2>
        
        {positions.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No open positions
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2">Ticket</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-right py-2">Entry</th>
                  <th className="text-right py-2">SL</th>
                  <th className="text-right py-2">TP</th>
                  <th className="text-right py-2">Profit</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.ticket} className="border-b border-gray-800 hover:bg-gray-700/50">
                    <td className="py-3 font-mono">{pos.ticket}</td>
                    <td className="py-3">{pos.symbol}</td>
                    <td className="py-3 text-right font-mono">{pos.openPrice.toFixed(5)}</td>
                    <td className="py-3 text-right font-mono text-red-400">{pos.stopLoss.toFixed(5)}</td>
                    <td className="py-3 text-right font-mono text-green-400">{pos.takeProfit.toFixed(5)}</td>
                    <td className={`py-3 text-right font-mono font-bold ${pos.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pos.profit >= 0 ? '+' : ''}{pos.profit.toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => closePosition(pos.ticket)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingDashboard;