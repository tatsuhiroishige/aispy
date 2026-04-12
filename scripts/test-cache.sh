#!/bin/bash
# Test fetch cache: same URL twice, second should be cache hit
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
  sleep 0.3
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  sleep 0.3
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"fetch","arguments":{"url":"https://example.com"}}}'
  sleep 2
  echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fetch","arguments":{"url":"https://example.com"}}}'
  sleep 2
} | node --experimental-require-module dist/index.js --mcp
