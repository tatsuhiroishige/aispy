#!/bin/bash
# Wrapper script for Claude Code MCP integration
# Loads .env and starts aispy in MCP mode
cd "$(dirname "$0")/.."
export $(grep -v '^#' .env 2>/dev/null | xargs)
# --experimental-require-module needed for jsdom's @csstools transitive dep
# Redirect stderr to a log file for debugging (ASPYPY_DEBUG_IMAGES etc.)
exec node --experimental-require-module dist/index.js --mcp 2>> /tmp/aispy-mcp.log
