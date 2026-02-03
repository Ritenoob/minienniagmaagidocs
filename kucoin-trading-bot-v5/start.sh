#!/bin/bash
# KuCoin Futures Trading Bot - Start Script

set -e

# Load .env if exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Defaults
MODE=${MODE:-paper}
PORT=${PORT:-3000}

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  KuCoin Futures Trading Bot                                ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Mode: $MODE"
echo "║  Port: $PORT"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Validate mode
case $MODE in
    paper|live|backtest)
        ;;
    *)
        echo "❌ Invalid MODE: $MODE"
        echo "   Valid modes: paper, live, backtest"
        exit 1
        ;;
esac

# Warn for live mode
if [ "$MODE" == "live" ]; then
    echo "⚠️  WARNING: LIVE TRADING MODE"
    echo "   Real money will be used!"
    echo ""
    
    if [ -z "$KUCOIN_API_KEY" ]; then
        echo "❌ KUCOIN_API_KEY not set for live mode"
        exit 1
    fi
    
    read -p "Type 'YES' to confirm live trading: " confirm
    if [ "$confirm" != "YES" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# Start server
echo "🚀 Starting server..."
exec node server.js
