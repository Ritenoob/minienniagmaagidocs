#!/bin/bash
# KuCoin Futures Trading Bot - Setup Script

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  KuCoin Futures Trading Bot - Setup                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required (found v$(node -v))"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env if not exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "   ⚠️  Edit .env with your settings before running!"
fi

# Verify modules
echo ""
echo "🔍 Verifying modules..."
node -e "
const modules = [
  './src/indicators',
  './src/microstructure',
  './src/lib/SignalGeneratorV2',
  './src/lib/PositionManager',
  './src/lib/KuCoinClient',
  './src/backtest/BacktestEngine',
  './src/optimizer/PaperTradingEngine'
];

let ok = true;
for (const mod of modules) {
  try {
    require(mod);
    console.log('   ✅ ' + mod);
  } catch (err) {
    console.log('   ❌ ' + mod + ': ' + err.message);
    ok = false;
  }
}

if (!ok) process.exit(1);
"

# Run verification tests
echo ""
echo "🧪 Running verification tests..."
node scripts/verify-system.js

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your configuration"
echo "  2. Run: npm start (or ./start.sh)"
echo ""
echo "Modes:"
echo "  MODE=paper    Paper trading (default, safe)"
echo "  MODE=backtest Run backtests only"
echo "  MODE=live     LIVE TRADING (requires API keys)"
echo "════════════════════════════════════════════════════════════"
