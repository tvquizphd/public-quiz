#!/bin/bash
#npx actions-hourly 50 1AM 1PM
ACTION="update_token.yaml"
ROOT=".github/workflows/"
TMP=".timer.tmp.yaml"
OUT="$ROOT$ACTION"

retime=^1?[0-9][AP]M$
read -p "When to wake up token updater?: " up
while ! [[ "$up" =~ ${retime} ]] ; do
  read -p "When? [1-12]AM - [1-12]PM: " up
done
read -p "When to pause? [empty for no pause]: " fin
while ! [[ -z "$fin" ]] && ! [[ "$fin" =~ ${retime} ]] ; do
  read -p "When? [1-12]AM - [1-12]PM: " fin
done
dn="${fin:=$up}"
JSON=$(npx actions-hourly 50 "$up" "$dn")
INFO=$(jq -r '.utc' <<< $JSON)
LOCAL=$(jq -r '.local' <<< $JSON)
YAML=$(jq -r '.crons_yaml' <<< $JSON)
echo "You asked for $LOCAL"
echo "Timed $ACTION for $INFO"

echo "on:" > "$TMP"
echo "  workflow_dispatch:" >> "$TMP"
echo "  schedule:" >> "$TMP"
echo "$YAML" >> "$TMP" 
sed -i "" '4,$s/^/    /' "$TMP"
npx merge-yaml-cli -i "$OUT" "$TMP" -o $OUT
sed -i "" 's/^.on.:$/on:/' $OUT
rm "$TMP"

echo "Please run:"
echo "git add .github"
echo "git commit -m timer"
echo "git push origin main"
