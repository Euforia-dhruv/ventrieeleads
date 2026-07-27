#!/bin/bash
# Setup script for ventrieeleads.qd.je domain
# This script helps configure the domain for DigitalPlat FreeDomain

set -e

DOMAIN="ventrieeleads.qd.je"
echo "Setting up domain: $DOMAIN"

# 1. Configure DNS at DigitalPlat FreeDomain Dashboard
echo ""
echo "=== Step 1: DNS Configuration ==="
echo "Go to https://domain.digitalplat.org"
echo "Add the following DNS records for $DOMAIN:"
echo ""
echo "Type: A    Name: @     Value: YOUR_SERVER_IP"
echo "Type: A    Name: www   Value: YOUR_SERVER_IP"
echo "Type: CNAME Name: api   Value: $DOMAIN"
echo ""

# 2. Configure CNAME
echo "=== Step 2: CNAME Record ==="
echo "CNAME: www.$DOMAIN -> $DOMAIN"

# 3. SSL Certificate
echo ""
echo "=== Step 3: SSL Certificate ==="
echo "Option 1: Use Let's Encrypt (recommended)"
echo "  docker exec nginx nginx -s reload"
echo ""
echo "Option 2: Use DigitalPlat FreeDomain SSL"
echo "  Copy certificates to nginx/ssl/ and nginx/certs/"
echo ""

# 4. Update environment
echo "=== Step 4: Environment Configuration ==="
echo "Backend .env:"
echo "  DOMAIN=$DOMAIN"
echo "  CORS_ORIGINS=https://$DOMAIN"
echo ""
echo "Frontend .env.local:"
echo "  NEXT_PUBLIC_API_URL=https://$DOMAIN/api"
echo "  NEXT_PUBLIC_DOMAIN=$DOMAIN"

echo ""
echo "Setup complete! Run 'docker compose up -d' to deploy."
