#!/bin/bash
SET_TOKEN=$(cat .env | egrep "^ROOT_TOKEN")
TOKEN=$(sed -r "s/.*=.(.+)./\1/" <<< $SET_TOKEN)
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
echo "" > $WIKI_OUT

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
  WORK=$(head -n 1 $MD)
  # Must have client_auth_data
  pnpm develop LOGIN OPEN ?noop $WORK
  # Must send server_auth_data
  echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT
  pnpm develop DEV CLOSE
  WORK=$(head -n 1 $MD)
  # Must have Au + token + client_auth_result
  pnpm develop LOGIN CLOSE $(tail -n 1 $1) $WORK
  # Must send clients, servers, secrets
  echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT
}

echo $'\n\nRun' $INTRO $'\n'
if [ ! -z $TOKEN ]; then
  read -p "Use existing login link (y/n)?: " yn
  if [ $yn == "y" ]; then
    read -p "Use existing password (y/n)?: " yn
    if [ $yn != "y" ]; then
      echo $'\n\nPaste your argon hash:\n'
      read -r OLD_HASH
      export OLD_HASH
    fi
    echo "Running login development action." $'\n'
    echo "Please open your personal login link." $'\n'
    # Simulate wait for workflow dispatch
    enter $MD
    exit 0
  fi
fi
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
