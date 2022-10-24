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
echo "" > $CSV
echo "REMOTE,$REMOTE" >> $CSV
echo "DEPLOYMENT,$DEPLOYMENT" >> $CSV
echo $'\n\nRun' $INTRO $'\n'
if [ ! -z $TOKEN ]; then
  read -p "Use existing login link (y/n)?: " yn
  if [ $yn == "y" ]; then
    echo "Running login development action." $'\n'
    echo "Please open your personal login link." $'\n'
    pnpm develop $TOKEN
    exit 0
  fi
fi
WIKI_IN="./tmp-wiki/$(basename $REMOTE).wiki"
URL=https://api.github.com/repos/$REMOTE
JSON=$(curl -s -H "Accept: application/vnd.github+json" $URL)
PARSE="console.log(JSON.parse(process.argv[1]).description)"
CLIENT=$(node -e $PARSE <<< "" "$JSON");
SECRET_TXT="./secret.txt"
WIKI_OUT="./docs/Home.md"
echo $'\n\nPaste your one-time public key:\n'
read -r PUB
mkdir -p $WIKI_IN
echo "$PUB" > $WIKI_IN/Home.md
pnpm develop NONE $CLIENT
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT
pnpm develop NONE $CLIENT $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT
pnpm develop NONE $CLIENT $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $WIKI_OUT
