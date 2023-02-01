#!/bin/bash
CLIENT_IN="./docs/pub.txt"
PUB_CTLI=$(cat $CLIENT_IN)
GIT_URL=$(git config --get remote.origin.url)
REMOTE=$(sed -r "s@.*[:/](.+/.+)@\1@" <<< $GIT_URL)
DEPLOYMENT="DEVELOPMENT-TEST"
export DEPLOYMENT
export REMOTE
SECRET_TXT="./secret.txt"
echo "" > $SECRET_TXT
pnpm develop UPDATE TOKEN "$PUB_CTLI"
cat $SECRET_TXT
