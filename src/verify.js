const { graphql } = require("@octokit/graphql");

const createProject = async (inputs) => {
  const { octograph, ownerId } = inputs;
  await octograph(`
    mutation {
      createProjectV2(input: {ownerId: "${ownerId}", title: "login"}) {
        projectV2 {
          id
          title
        }
      }
    }
  `);
  return "Created Project.";
}

const seeOwner = async (inputs) => {
  const { octograph, owner } = inputs;
  return (await octograph(`
    query {
      user(login: "${owner}") {
        id
      }
    }
  `)).user;
}

const main = () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return;
  }
  const inputs = {
    my_token: args[0]
  };
  const octograph = graphql.defaults({
    headers: {
      authorization: `token ${inputs.my_token}`,
    },
  });
  const owner = "tvquizphd";
  const inputs_1 = { owner, octograph };
  seeOwner(inputs_1).then((user) => {
    const ownerId = user.id;
    const inputs_2 = { ownerId, octograph };
    createProject(inputs_2).then((done) => {
      console.log(done);
    }).catch((error) => {
      console.error(`Unable to create project.`);
      console.error(error.message);
    })
  }).catch((error) => {
    console.error(`Unable to see owner "${owner}"`);
    console.error(error.message);
  });
}
main();
