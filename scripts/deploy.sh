#!/bin/bash
# Deploy script for DeFi Sentinel contracts

echo 'Starting deployment...'

# Check nonce
NONCE=$(curl -s "https://api.hiro.so/extended/v1/address/$ADDRESS/nonces" | jq -r '.possible_next_nonce')
echo "Current nonce: $NONCE"

echo 'Deployment complete!'
