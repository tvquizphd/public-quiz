const { toProjectSock } = require("project-sock");
const OP = require('@nthparty/opaque');

const verify = (config_in) => {
  const v = "v";
  const user = "root";
  const times = 1000;
  const inputs = {
    scope: v,
    title: "verify",
    owner: "tvquizphd",
    token: config_in.my_token
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
