const { activate } = require("./activate");
const { verify } = require("./verify");

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return;
  }
  const msg_a = "Activating with Master Password!";
  if (args.length >= 3) {
    console.log(msg_a);
    try {
      await activate({
        my_token: args[0],
        client_id: args[1],
        master_pass: args[2]
      });
    }
    catch (e) {
      console.error("Unable to Activate.");
      throw (e);
      return console.error(e.message);
    }
  }
  const msg_v = "Verifying that you can Log in!";
  console.log(msg_v);
  try {
    return await verify({
      my_token: args[0]
    });
  }
  catch (e) {
    console.error("Unable to Verify.");
    return console.error(e.message);
  }
})();
