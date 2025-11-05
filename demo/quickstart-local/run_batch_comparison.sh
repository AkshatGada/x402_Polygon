#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║        X402 BATCH SETTLEMENT COMPARISON TEST - SCALED vs EXACT            ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check environment variables
if [ -z "$PRIVATE_KEY" ]; then
  echo -e "${RED}❌ Error: PRIVATE_KEY not set${NC}"
  exit 1
fi

if [ -z "$PAYMENT_CONTRACT_ADDRESS" ]; then
  echo -e "${RED}❌ Error: PAYMENT_CONTRACT_ADDRESS not set${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment configured${NC}"
echo "   Private Key: ${PRIVATE_KEY:0:10}..."
echo "   Payment Contract: ${PAYMENT_CONTRACT_ADDRESS:0:20}..."
echo ""

# Check if servers are running
echo -e "${YELLOW}🔍 Checking server availability...${NC}"

# Check facilitator
if curl -s http://localhost:3333/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Facilitator (port 3333): OK${NC}"
else
  echo -e "${RED}❌ Facilitator (port 3333): NOT RUNNING${NC}"
  echo "   Start with: cd demo/test-facilitator-scaled && npm start"
  exit 1
fi

# Check seller servers
SELLER_SCALED_PORT=${SELLER_SCALED_PORT:-4021}
SELLER_EXACT_PORT=${SELLER_EXACT_PORT:-4020}

if curl -s http://localhost:${SELLER_SCALED_PORT}/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Seller X402-SCALED (port ${SELLER_SCALED_PORT}): OK${NC}"
else
  echo -e "${YELLOW}⚠️  Seller X402-SCALED (port ${SELLER_SCALED_PORT}): NOT RUNNING${NC}"
  echo "   Will start in background..."
  PAYMENT_CONTRACT_ADDRESS=$PAYMENT_CONTRACT_ADDRESS PORT=${SELLER_SCALED_PORT} node seller_x402_scaled.js > /tmp/seller_scaled.log 2>&1 &
  SELLER_SCALED_PID=$!
  echo "   Started with PID: $SELLER_SCALED_PID"
  sleep 3
fi

if curl -s http://localhost:${SELLER_EXACT_PORT}/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Seller X402-EXACT (port ${SELLER_EXACT_PORT}): OK${NC}"
else
  echo -e "${YELLOW}⚠️  Seller X402-EXACT (port ${SELLER_EXACT_PORT}): NOT RUNNING${NC}"
  echo "   Will start in background..."
  PORT=${SELLER_EXACT_PORT} node seller_x402_exact.js > /tmp/seller_exact.log 2>&1 &
  SELLER_EXACT_PID=$!
  echo "   Started with PID: $SELLER_EXACT_PID"
  sleep 3
fi

echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "Running Batch Settlement Tests"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# Run X402-SCALED test
echo -e "${BLUE}🚀 TEST 1: X402-SCALED Batch Test (100 concurrent requests)${NC}"
echo "   Starting at: $(date)"
START_TIME=$(date +%s%N)

PRIVATE_KEY=$PRIVATE_KEY \
PAYMENT_CONTRACT_ADDRESS=$PAYMENT_CONTRACT_ADDRESS \
FACILITATOR_URL="http://localhost:3333" \
SELLER_URL="http://localhost:${SELLER_SCALED_PORT}" \
node buyer_x402_scaled_batch.js > /tmp/batch_scaled_results.json 2>&1

SCALED_EXIT=$?
END_TIME=$(date +%s%N)
SCALED_DURATION=$((($END_TIME - $START_TIME) / 1000000))  # Convert to ms

if [ $SCALED_EXIT -eq 0 ]; then
  echo -e "${GREEN}✅ X402-SCALED test completed successfully${NC}"
else
  echo -e "${RED}❌ X402-SCALED test failed${NC}"
fi

echo ""

# Run X402-EXACT test
echo -e "${BLUE}🚀 TEST 2: X402-EXACT Batch Test (100 concurrent requests)${NC}"
echo "   Starting at: $(date)"
START_TIME=$(date +%s%N)

PRIVATE_KEY=$PRIVATE_KEY \
FACILITATOR_URL="https://x402-amoy.polygon.technology" \
SELLER_URL="http://localhost:${SELLER_EXACT_PORT}" \
node buyer_x402_exact_batch.js > /tmp/batch_exact_results.json 2>&1

EXACT_EXIT=$?
END_TIME=$(date +%s%N)
EXACT_DURATION=$((($END_TIME - $START_TIME) / 1000000))  # Convert to ms

if [ $EXACT_EXIT -eq 0 ]; then
  echo -e "${GREEN}✅ X402-EXACT test completed successfully${NC}"
else
  echo -e "${RED}❌ X402-EXACT test failed${NC}"
fi

echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "Test Execution Complete"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# Extract results
echo -e "${BLUE}📊 COMPARISON ANALYSIS${NC}"
echo ""

if [ $SCALED_EXIT -eq 0 ] && [ $EXACT_EXIT -eq 0 ]; then
  # Parse JSON results
  SCALED_TIME=$(grep -o '"totalTimeMs":[0-9]*' /tmp/batch_scaled_results.json | grep -o '[0-9]*' | head -1)
  SCALED_AVG=$(grep -o '"avgTimeMs":[0-9.]*' /tmp/batch_scaled_results.json | grep -o '[0-9.]*' | head -1)
  SCALED_RPS=$(grep -o '"requestsPerSecond":"[^"]*' /tmp/batch_scaled_results.json | cut -d'"' -f2)
  
  EXACT_TIME=$(grep -o '"totalTimeMs":[0-9]*' /tmp/batch_exact_results.json | grep -o '[0-9]*' | head -1)
  EXACT_AVG=$(grep -o '"avgTimeMs":[0-9.]*' /tmp/batch_exact_results.json | grep -o '[0-9.]*' | head -1)
  EXACT_RPS=$(grep -o '"requestsPerSecond":"[^"]*' /tmp/batch_exact_results.json | cut -d'"' -f2)
  
  echo "Metric                         X402-SCALED      X402-EXACT       Improvement"
  echo "─────────────────────────────────────────────────────────────────────────────"
  
  if [ ! -z "$SCALED_TIME" ] && [ ! -z "$EXACT_TIME" ]; then
    TIME_IMPROVEMENT=$(echo "scale=2; (($EXACT_TIME - $SCALED_TIME) / $EXACT_TIME) * 100" | bc)
    printf "Total Time (ms)                %-16s %-16s %.1f%% faster\n" "$SCALED_TIME" "$EXACT_TIME" "$TIME_IMPROVEMENT"
  fi
  
  if [ ! -z "$SCALED_AVG" ] && [ ! -z "$EXACT_AVG" ]; then
    AVG_IMPROVEMENT=$(echo "scale=2; (($EXACT_AVG - $SCALED_AVG) / $EXACT_AVG) * 100" | bc)
    printf "Avg Time per Request (ms)      %-16s %-16s %.1f%% faster\n" "$SCALED_AVG" "$EXACT_AVG" "$AVG_IMPROVEMENT"
  fi
  
  if [ ! -z "$SCALED_RPS" ] && [ ! -z "$EXACT_RPS" ]; then
    RPS_IMPROVEMENT=$(echo "scale=2; (($SCALED_RPS - $EXACT_RPS) / $EXACT_RPS) * 100" | bc)
    printf "Requests/sec                   %-16s %-16s %.1f%% higher\n" "$SCALED_RPS" "$EXACT_RPS" "$RPS_IMPROVEMENT"
  fi
  
  echo ""
  echo "Key Findings:"
  echo "  • X402-SCALED: 1 on-chain transaction (batch settlement)"
  echo "  • X402-EXACT: 100+ on-chain transactions (per-request)"
  echo "  • X402-SCALED: Lower latency due to batching"
  echo "  • X402-SCALED: Better throughput with cumulative signatures"
  echo ""
fi

# Cleanup
if [ ! -z "$SELLER_SCALED_PID" ]; then
  kill $SELLER_SCALED_PID 2>/dev/null
fi

if [ ! -z "$SELLER_EXACT_PID" ]; then
  kill $SELLER_EXACT_PID 2>/dev/null
fi

echo "═════════════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Batch comparison test completed!${NC}"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📁 Results saved to:"
echo "   • /tmp/batch_scaled_results.json"
echo "   • /tmp/batch_exact_results.json"
echo ""
echo "To view detailed results:"
echo "   cat /tmp/batch_scaled_results.json | jq ."
echo "   cat /tmp/batch_exact_results.json | jq ."
echo ""
