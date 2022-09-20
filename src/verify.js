const { toProjectSock } = require("project-sock");
const OP = require('@nthparty/opaque');

const main = () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return;
  }
  const v = "v";
  const user = "root";
  const times = 1000;
  const inputs = {
    scope: v,
    token: args[0],
    title: "verify",
    owner: "tvquizphd"
  };
  (async () => {
    const sock = await toProjectSock(inputs);
    const Opaque = await OP(sock);
  	const { pepper } = await Opaque.serverRegister(times, v);
    Opaque.serverAuthenticate(user, pepper, v).then((token) => {
      sock.sock.project?.finish();
    });
    console.log('Waiting');
  })();
}
main();
