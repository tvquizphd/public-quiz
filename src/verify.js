const { toLocalSock } = require("./sock");
const OP = require('@nthparty/opaque');

const main = () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return;
  }
  const v = "v";
  const inputs = {
    token: args[0],
    scope: v,
    title: "verify",
    owner: "tvquizphd"
  };
  (async () => {
    const sock = toLocalSock();
    const Opaque = await OP(sock);
    (async () => {
      const { pepper } = await Opaque.serverRegister(1000, v);
      Opaque.serverAuthenticate("root", pepper, v).then((token) => {
        sock.project?.finish();
        console.log({token});
      });
    })();
    const pass = inputs.token;
    Opaque.clientRegister(pass, "root", v);
    Opaque.clientAuthenticate(pass, "root", 1000, v).then((session) => {
      console.log({session})
    })
    console.log('Waiting');
  })();
}
main();
