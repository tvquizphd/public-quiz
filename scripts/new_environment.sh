STAGE="secret-tv-access"
ROOT="https://api.github.com"
REPO="tvquizphd/public-quiz-device"

RESULT=$(curl \
-X PUT \
-H "Accept: application/vnd.github+json" \
-H "Authorization: Bearer ${GITHUB_TOKEN}" \
$ROOT/repos/$REPO/environments/$STAGE);
echo $RESULT
