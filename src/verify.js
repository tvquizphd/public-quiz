const { toProjectSock } = require("./sock");
const { nester, fromB64urlObj } = require("./b64url");
const OP = require('@nthparty/opaque');

const main = () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return;
  }
  const inputs = {
    token: args[0],
    title: "verify",
    scope: "verify",
    owner: "tvquizphd"
  };
  (async () => {
    const sock = await toProjectSock(inputs);
    const Opaque = await OP(sock);
  	const { pepper } = await Opaque.serverRegister(1000, "_");
    Opaque.serverAuthenticate("root", pepper, "_").then((token) => {
      console.log(token)
    });
    console.log('Waiting');
  })();
}
main();
