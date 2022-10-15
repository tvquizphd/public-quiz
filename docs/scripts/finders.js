import { toProjectSock } from "project-sock";

// TODO: package and distribute

function findSub (inputs, sub) {
  return inputs.commands.filter((c) => {
    return c.subcommand == sub;
  }).pop();
}

function findOp (inputs, sub) {
  const command = findSub(inputs, sub);
  return inputs.sockets.find(({ text }) => {
    return text == command.prefix;
  }).suffix;
}

function opId (inputs, sub) {
  const command = findSub(inputs, sub);
  const op = findOp(inputs, sub);
  return op + command.command;
}

async function toSock(inputs, key) {
  const { project } = inputs[key];
  const { git, delay } = inputs;
  const sock_inputs = {
    delay: delay,
    token: git.token,
    owner: git.owner,
    title: project.title,
    scope: project.prefix
  };
  return await toProjectSock(sock_inputs);
}

export { opId, toSock, findOp, findSub };
