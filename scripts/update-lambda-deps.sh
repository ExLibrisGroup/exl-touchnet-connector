#!/bin/bash
# Generate production-only dependencies for AWS Lambda Layer
# This creates dependencies/nodejs with only production deps, no dev dependencies
# Dependencies are extracted from the root package.json

set -e

LAMBDA_DIR="dependencies/nodejs"

# Remove the directory if it exists to clean out any stale files
rm -rf "$LAMBDA_DIR"

# Create a fresh directory
mkdir -p "$LAMBDA_DIR"

# Extract only the dependencies field from root package.json
# This uses jq to extract .dependencies, or falls back to node if jq is not available
if command -v jq &> /dev/null; then
  # Use jq if available (faster and cleaner)
  jq '{dependencies: .dependencies}' package.json > "$LAMBDA_DIR/package.json"
else
  # Fallback to node if jq is not available
  node -e "
    const pkg = require('./package.json');
    const lambdaPkg = { dependencies: pkg.dependencies };
    const fs = require('fs');
    fs.writeFileSync('$LAMBDA_DIR/package.json', JSON.stringify(lambdaPkg, null, 2));
  "
fi

# Install production dependencies using the lock file
# Copy root package-lock.json to use as source of truth for versions
cp package-lock.json "$LAMBDA_DIR/package-lock.json"

cd "$LAMBDA_DIR"

# Coherence check. Install the dependencies to confirm everything is working.
npm ci --production
cd ../..

echo "✓ Lambda dependencies prepared in $LAMBDA_DIR"
