import { ProjectChannel } from "project-sock";
import type { Namespace } from "../config/sock.js";
import type { Git } from "./types.js";
declare type OpId = string | undefined;
export declare type Socket = {
    sock: ProjectChannel;
    get: (id: OpId, tag: string) => Promise<unknown>;
    give: (id: OpId, tag: string, msg: any) => void;
};
export declare type SockInputs = {
    namespace: Namespace;
    delay: number;
    git: Git;
};
interface ToSock {
    (inputs: SockInputs, key: string): Promise<Socket>;
}
declare const toSock: ToSock;
export { toSock };
