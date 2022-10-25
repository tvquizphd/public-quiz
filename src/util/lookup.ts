import type { NameInterface as I } from "../config/sock.js";
import type { Command } from "../config/sock.js";
import type { Socket } from "../config/sock.js";

function findSub (inputs: I, sub: string): Command {
  const out = inputs.commands.filter((c: Command) => {
    return c.subcommand == sub;
  }).pop();
  if (!out) {
    throw new Error(`Cannot find ${sub} command`);
  }
  return out;
}

function findOp (inputs: I, sub: string): string {
  const command = findSub(inputs, sub);
  const out = inputs.sockets.find(({ text }: Socket) => {
    return text == command.prefix;
  })?.suffix || null;
  if (!out) {
    throw new Error(`Cannot find ${sub} command`);
  }
  return out;
}

function opId (inputs: I, sub: string): string {
  const command = findSub(inputs, sub);
  const op = findOp(inputs, sub);
  return op + command.command;
}

export {
  opId,
  findOp,
  findSub
}
