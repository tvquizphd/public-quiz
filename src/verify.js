const { toProjectSock } = require("project-sock");
const OP = require('@nthparty/opaque');

const verify = (config_in) => {
  const { git } = config_in;
  const user = "root";
  const times = 1000;
  const v = "v";
  const inputs = {
    scope: v,
    title: "verify",
    owner: git.owner,
    token: git.owner_token
  };
  return new Promise(async (resolve) => {
    const sock = await toProjectSock(inputs);
    const Opaque = await OP(sock);
  	const { pepper } = await Opaque.serverRegister(times, v);
    Opaque.serverAuthenticate(user, pepper, v).then((token) => {
      sock.sock.project?.finish().then(() => {
        resolve('Verified');
      });
    });
    console.log('Waiting');
  });
}

exports.verify = verify;
