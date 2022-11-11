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
CSV="./docs/environment.csv"
echo "REMOTE,$REMOTE" > $CSV
echo "DEPLOYMENT,$DEPLOYMENT" >> $CSV
echo "DEV_PATH_ROOT,$(pwd)" >> $CSV
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
    pnpm develop LOGIN $TOKEN
    exit 0
  fi
fi
WIKI_IN="./tmp-wiki/$(basename $REMOTE).wiki"
mkdir -p $WIKI_IN
SECRET_TXT="./secret.txt"
WIKI_OUT="./docs/pub.txt"
MD=$WIKI_IN/Home.md
echo "" > $SECRET_TXT
echo "" > $WIKI_OUT
echo "" > .env
echo "" > $MD

pnpm develop PUB DEV OPAQUE 
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT

echo "Awaiting filesystem access..."
until [ -s $MD ]; do
  echo "HELLO"
  sleep 1
done
echo $'... ready!\n'

pnpm develop APP DEV $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT

pnpm develop TOKEN DEV $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT

pnpm develop AUTH DEV $(tail -n 1 $SECRET_TXT)
