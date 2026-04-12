#!/bin/bash
# Wrapper script for Claude Code MCP integration
# Loads .env and starts aispy in MCP mode
cd "$(dirname "$0")/.."
export $(grep -v '^#' .env 2>/dev/null | xargs)
exec node --experimental-require-module dist/index.js --mcp
