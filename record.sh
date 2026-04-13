#!/bin/bash
# Generate demo GIFs for the README using VHS
# Usage: ./record.sh
# Requires: brew install vhs

set -e

echo "Recording menu..."
vhs assets/menu.tape

echo "Recording snake..."
vhs assets/snake.tape

echo "Recording runner..."
vhs assets/runner.tape

echo ""
echo "Done! GIFs saved to assets/"
echo "  assets/menu.gif"
echo "  assets/snake.gif"
echo "  assets/runner.gif"
