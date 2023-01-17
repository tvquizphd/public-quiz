#!/bin/bash
SET_SESSION=$(cat .env | egrep "^SESSION")
SESSION=$(sed -r "s/.*=.(.+)./\1/" <<< $SET_SESSION)
GIT_URL=$(git config --get remote.origin.url)
REMOTE=$(sed -r "s_.*[:/](.+/.+)_\1_" <<< $GIT_URL)
DEPLOYMENT="DEVELOPMENT-TEST"
export DEPLOYMENT
export REMOTE
SERVER_URL="\"localhost:8000\""
SERVER_CMD="\"npx http-server docs\""
INTRO="$SERVER_CMD to access $SERVER_URL"
WIKI_IN="./tmp-wiki/$(basename $REMOTE).wiki"
CSV="./docs/environment.csv"
SECRET_TXT="./secret.txt"
WIKI_OUT="./docs/pub.txt"
MD=$WIKI_IN/Home.md
mkdir -p $WIKI_IN
echo "REMOTE,$REMOTE" > $CSV
echo "DEPLOYMENT,$DEPLOYMENT" >> $CSV
echo "DEV_PATH_ROOT,$(pwd)" >> $CSV
echo "" > $SECRET_TXT

waiter () {
  echo "Awaiting filesystem access..."
  until [ -s $1 ]; do
    echo "HELLO"
    sleep 1
  done
  echo $'... ready!\n'
}

enter () {
  pnpm develop DEV OPEN
  WORK=$(head -n 1 $1)
  # Must have client_auth_data
  pnpm develop LOGIN OPEN ?noop $WORK
  # Must send server_auth_data
  echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT
  pnpm develop DEV CLOSE
  WORK=$(head -n 1 $1)
  # Must have Au + token + client_auth_result
  pnpm develop LOGIN CLOSE $(tail -n 1 $SECRET_TXT) $WORK
  # Must send clients, servers, secrets
  sed -n '1,2p' $SECRET_TXT > $WIKI_OUT
}

echo $'\n\nRun' $INTRO $'\n'
if [ ! -z $SESSION ]; then
  read -p "Use existing login link (y/n)?: " yn
  if [ $yn == "y" ]; then
    read -p "Use existing password (y/n)?: " yn
    if [ $yn != "y" ]; then
      echo $'\n\nPaste your argon hash:\n'
      read -r OLD_HASH
      export OLD_HASH
    fi
    # Simulate wait for workflow dispatch
    pnpm develop DEV INBOX
    echo "Running login development action." $'\n'
    echo "Please open your personal login link." $'\n'
    enter $MD
    exit 0
  fi
fi
echo "" > $WIKI_OUT
echo "" > .env
echo "" > $MD

pnpm develop SETUP PUB OPAQUE 
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT

waiter $MD

pnpm develop SETUP APP $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT

pnpm develop SETUP TOKEN $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT

enter $MD
