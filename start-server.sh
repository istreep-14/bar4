#!/bin/bash

# Bar Tracker - Local Development Server
# This script starts a simple HTTP server to run the app locally

echo "================================================"
echo "  Bar Tracker - Local Development Server"
echo "================================================"
echo ""

# Check if the HTML file exists
if [ ! -f "bar-tracker.html" ]; then
    echo "❌ Error: bar-tracker.html not found in current directory"
    echo ""
    echo "Please make sure you're running this script from the directory"
    echo "containing the bar-tracker.html file."
    echo ""
    exit 1
fi

# Get the port (default to 8000)
PORT=${1:-8000}

echo "✅ Starting server on http://localhost:$PORT"
echo ""
echo "📱 Open your browser and navigate to:"
echo "   http://localhost:$PORT/bar-tracker.html"
echo ""
echo "🔧 When setting up Google OAuth, use this as your authorized origin:"
echo "   http://localhost:$PORT"
echo ""
echo "⏹️  Press Ctrl+C to stop the server"
echo ""
echo "================================================"
echo ""

# Build assets before serving
if [ -f "package.json" ]; then
    echo "🛠  Building front-end bundle..."
    if ! npm run build >/dev/null; then
        echo "❌ Build failed. Fix issues above before starting the server."
        exit 1
    fi
    echo "✅ Build complete."
else
    echo "⚠️  package.json not found; skipping build step."
fi

# Start the server
python3 -m http.server $PORT
