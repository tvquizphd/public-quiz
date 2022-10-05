STAGE="development"
ROOT="https://api.github.com"
REPO="tvquizphd/public-quiz-device"

curl \
-H "Accept: application/vnd.github+json" \
-H "Authorization: Bearer ${GITHUB_TOKEN}" \
$ROOT/repos/$REPO/deployments?environment=$STAGE \
| jq -e '.[0].environment'
