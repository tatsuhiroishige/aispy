#!/bin/bash
# Test search + fetch flow to verify read/skip labels
# Usage: BRAVE_API_KEY=your-key bash scripts/test-search.sh
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
  sleep 0.3
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  sleep 0.3
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"query":"IANA example domains","count":5}}}'
  sleep 2
  echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fetch","arguments":{"url":"https://www.iana.org/help/example-domains"}}}'
  sleep 3
} | node --experimental-require-module dist/index.js --mcp
