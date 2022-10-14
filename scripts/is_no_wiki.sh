ROOT="https://api.github.com"
REPO="tvquizphd/public-quiz-device"

JSON=$(curl \
-H "Accept: application/vnd.github+json" \
-H "Authorization: Bearer ${GITHUB_TOKEN}" \
$ROOT/repos/$REPO/pages);
PAGES_URL=$(jq -r '.html_url' <<< $JSON);
TEXT=$(curl $PAGES_URL/Home.md);
CONTENTS=$(tr -d "\n" <<< $TEXT);
echo "Home.md contains '$CONTENTS'";
