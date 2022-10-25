import { toProjectSock } from "project-sock";
import { ProjectChannel } from "project-sock";
import type { Namespace } from "../config/sock.js";
import type { Git } from "./types.js";

export type Socket = {
  sock: ProjectChannel;
  get: (id: string, tag: string) => Promise<unknown>;
  give: (id: string, tag: string, msg: any) => void;
}
export type SockInputs = {
  namespace: Namespace,
  delay: number,
  git: Git
}
interface ToSock {
  (inputs: SockInputs, key: string): Promise<Socket>;
}

const toSock: ToSock = async (inputs, key) => {
  const { project } = inputs.namespace[key];
  const { git, delay } = inputs;
  const sock_inputs = {
    delay: delay,
    owner: git.owner,
    title: project.title,
    scope: project.prefix,
    token: git.owner_token
  };
  return await toProjectSock(sock_inputs);
}

export {
  toSock
}
