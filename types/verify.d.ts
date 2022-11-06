import type { Git } from "./util/types.js";
import type { Socket } from "./util/socket.js";
import type { Op, Ops } from 'opaque-low-io';
import type { Inputs as InIn } from "./inbox.js";
declare type UserInputs = {
    git: Git;
    delay: number;
    env: string;
};
declare type UserOutputs = {
    Opaque: Op;
    Sock: Socket;
};
interface ToUserSock {
    (i: UserInputs): Promise<UserOutputs>;
}
interface ToSyncOp {
    (): Promise<Ops>;
}
declare type ConfigIn = {
    reset: boolean;
    login: boolean;
    delay: number;
    pep: string;
    env: string;
    git: Git;
};
declare type Inputs = {
    inbox_in: InIn;
    log_in: ConfigIn;
};
interface Verifier {
    (i: Inputs): Promise<void>;
}
declare const toUserSock: ToUserSock;
declare const toSyncOp: ToSyncOp;
declare const verifier: Verifier;
export { verifier, toUserSock, toSyncOp };
