#!/bin/bash
SET_SESSION=$(cat .env | egrep "^ROOT__SESSION")
SESSION=$(sed -r "s@.*=.(.+).@\1@" <<< $SET_SESSION)
GIT_URL=$(git config --get remote.origin.url)
REMOTE=$(sed -r "s@.*[:/](.+/.+)@\1@" <<< $GIT_URL)
DEPLOYMENT="DEVELOPMENT-TEST"
export DEPLOYMENT
export REMOTE
SERVER_URL="\"localhost:8000\""
SERVER_CMD="\"npx http-server docs\""
INTRO="$SERVER_CMD to access $SERVER_URL"
WIKI_IN="./tmp-dev"
CSV="./docs/environment.csv"
SECRET_TXT="./secret.txt"
CLIENT_IN="./docs/pub.txt"
CLIENT_OUT=$WIKI_IN/dev.txt
mkdir -p $WIKI_IN
echo "REMOTE,$REMOTE" > $CSV
echo "DEPLOYMENT,$DEPLOYMENT" >> $CSV
echo "DEV_PATH_ROOT,$(pwd)" >> $CSV
echo "" > $SECRET_TXT

waiter () {
  echo "Awaiting empty $1..."
  until [ -s $1 ]; do
    echo "..."
    sleep 1
  done
  echo $'... ready!\n'
}

enter () {
  pnpm develop DEV OPEN
  WORK=$(head -n 1 $1)
  PUB_CTLI=$(head -n 1 $CLIENT_IN)
  # Must have client_auth_data
  pnpm develop LOGIN OPEN $PUB_CTLI $WORK
  # Must send server_auth_data
  echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN
  pnpm develop DEV CLOSE
  WORK=$(head -n 1 $1)
  # Must have Au + token + client_auth_result
  pnpm develop LOGIN CLOSE OUTBOX $WORK
  # Must send clients, servers, secrets
  echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN
}

echo $'\n\nRun' $INTRO $'\n'
if [ ! -z $SESSION ]; then
  read -p "Use existing login link (y/n)?: " yn
  if [ $yn == "y" ]; then
    read -p "Use existing password (y/n)?: " yn
    if [ $yn != "y" ]; then
      pnpm develop DEV RESET
    fi
    pnpm develop DEV INBOX
    echo "Running login development action." $'\n'
    echo "Please open your personal login link." $'\n'
    enter $CLIENT_OUT
    exit 0
  fi
fi
echo "" > $CLIENT_IN
echo "" > .env
echo "" > $CLIENT_OUT

pnpm develop SETUP PUB OPAQUE 
echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN
cat $CLIENT_IN

waiter $CLIENT_OUT

pnpm develop SETUP APP $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN
cat $CLIENT_IN

pnpm develop SETUP TOKEN $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN
cat $CLIENT_IN

enter $CLIENT_OUT
