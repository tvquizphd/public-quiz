#!/bin/bash
trap "exit" INT
SET_SESSION=$(cat .env | egrep "^ROOT__SESSION")
SESSION=$(sed -r "s@.*=.(.+).@\1@" <<< $SET_SESSION)
GIT_URL=$(git config --get remote.origin.url)
#GIT_URL=$(git config --get remote.john.url) # TODO
REMOTE=$(sed -r "s@.*[:/](.+/.+)@\1@" <<< $GIT_URL)
RANDO=$(openssl rand -hex 3)
DEPLOYMENT="INT-TEST-$RANDO"
export DEPLOYMENT
export REMOTE
SECRET_TXT="./secret.txt"
CLIENT_IN="./client/pub.txt"
CLIENT_OUT="./tmp-dev/msg.txt"
CSV="./client/environment.csv"
mkdir -p "./tmp-dev"
echo "" > $SECRET_TXT
echo "REMOTE,$REMOTE" > $CSV
echo "DEPLOYMENT,$DEPLOYMENT" >> $CSV

if [ "$1" == "UPDATE" ]; then
  PUB_CTLI=$(head -n 1 $CLIENT_IN)
  pnpm develop UPDATE TOKEN $PUB_CTLI
  exit 0
fi

enter () {
  pnpm develop DEV INBOX 
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
  echo "" > $1
}

if [ ! -z $SESSION ]; then
  enter $CLIENT_OUT
  exit 0
fi
echo "" > .env
echo "" > $CLIENT_IN
echo "" > $CLIENT_OUT

pnpm develop SETUP PUB OPAQUE 
echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN

pnpm develop SETUP APP $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN

pnpm develop SETUP TOKEN $(tail -n 1 $SECRET_TXT)
echo $(head -n 1 $SECRET_TXT) > $CLIENT_IN

enter $CLIENT_OUT
