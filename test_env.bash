#!/bin/bash
TEST_ENV=".env.test"

echo "For Playwright Testing only"
echo "Must disable GitHub 2FA"
echo ""
read -p "GitHub Username:" GITHUB_USER 
while [[ -z "$GITHUB_USER" ]] ; do
  read -p "GitHub Username: " GITHUB_USER
done

read -p "GitHub Password:" GITHUB_PASS 
while [[ -z "$GITHUB_PASS" ]] ; do
  read -p "GitHub Password: " GITHUB_PASS
done

echo "GITHUB_USER=\"$GITHUB_USER\"" > "$TEST_ENV"
echo "GITHUB_PASS=\"$GITHUB_PASS\"" >> "$TEST_ENV"
echo "Playwright for $GITHUB_USER saved to $TEST_ENV"
