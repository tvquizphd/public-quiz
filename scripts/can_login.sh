STAGE="development"
ROOT="https://api.github.com"
REPO="tvquizphd/public-quiz-device"

JSON=$(curl \
-H "Accept: application/vnd.github+json" \
-H "Authorization: Bearer ${GITHUB_TOKEN}" \
$ROOT/repos/$REPO/deployments?environment=$STAGE);
RESULT=$(jq -r '.[0].environment' <<< $JSON);
echo $RESULT
