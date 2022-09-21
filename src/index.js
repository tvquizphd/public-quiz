const { activate } = require("./activate");
const { verify } = require("./verify");
const { Octokit } = require("octokit");

function unStar(git) {
  const octokit = new Octokit({
    auth: git.owner_token
  });
  const star_api = `/user/starred/${git.owner}/${git.repo}`;
  octokit.request(`DELETE ${star_api}`).catch(e => {
    console.error(e.message);
  });
}

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return;
  }
  const git = {
    owner: "tvquizphd",
    owner_token: args[0],
    repo: "public-quiz-device"
  }
  const msg_a = "Activating with Master Password!";
  if (args.length >= 3) {
    console.log(msg_a);
    try {
      await activate({
        git,
        client_id: args[1],
        master_pass: args[2]
      });
    }
    catch (e) {
      console.error("Unable to Activate.");
      console.error(e.message);
      return { git };
    }
  }
  const msg_v = "Verifying that you can Log in!";
  console.log(msg_v);
  try {
    await verify({ git });
    return { git };
  }
  catch (e) {
    console.error("Unable to Verify.");
    console.error(e.message);
    return { git };
  }
})().then(({ git }) => {
  unStar(git);
}).catch((e) => {
  console.error("Unexpected Error Occured");
  console.error(e.message);
});
