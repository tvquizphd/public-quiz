
const getAuthorizable = (client_id) => {
  const keys = { client_id, scope: 'repo' }
  const authPath = 'github.com/login/device/code';
  const deviceParameters = new URLSearchParams(keys);
  const authorizable = `https://${authPath}?${deviceParameters}`;
  const headers = { 'Content-Type': 'application/json' };
  return { authorizable, headers };
}

const authorizeUser = async (client_id) => {
  const { authorizable, headers } = getAuthorizable(client_id);
  fetch(authorizable, { headers, method: 'POST' });
};

const main = () => {
  const inputs = process.argv.slice(2);
  if (inputs.length < 1) {
    console.error('Missing first argument: CLIENT_ID');
    return;
  }
  const [client_id] = inputs;
  authorizeUser(client_id).then(() => {
    console.log('Authorized');
  }).catch((error) => {
    console.error('Not Authorized');
    console.error(error.message)
  });
}
main();
