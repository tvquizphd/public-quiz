STAGE="development"
ROOT="https://api.github.com"
REPO="tvquizphd/public-quiz-device"

STATUS=`curl -Is \
-H "Accept: application/vnd.github+json" \
-H "Authorization: Bearer ${GITHUB_TOKEN}" \
$ROOT/user/starred/$REPO | grep HTTP | cut -d ' ' -f2`;
echo $STATUS
