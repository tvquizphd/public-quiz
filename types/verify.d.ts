import type { SockServer } from "sock-secret";
import type { UserIn } from "./util/pasted.js";
import type { Git, Trio } from "./util/types.js";
import type { TreeAny } from "sock-secret";
import type { ServerFinal } from "opaque-low-io";
import type { Op, Ops } from 'opaque-low-io';
declare type Need = "first" | "last";
declare type Needs = Record<Need, string[]>;
declare type SockInputs = {
    git: Git;
    env: string;
    secrets: TreeAny;
    lister?: Lister | null;
    needs: Partial<Needs>;
};
declare type UserOutputs = {
    Sock: SockServer;
    Opaque: Op;
};
interface ToUserSock {
    (i: SockInputs): Promise<UserOutputs>;
}
interface ToSyncOp {
    (): Promise<Ops>;
}
declare type SecretOut = {
    for_pages: string;
    for_next: string;
};
declare type ConfigIn = {
    reset: boolean;
    login: boolean;
    delay: number;
    pep: string;
    env: string;
    git: Git;
};
declare type Register = {
    sid: string;
    pw: Uint8Array;
};
declare type Inputs = {
    finish: string;
    command: string;
    tree: TreeAny;
    user_in: UserIn;
    log_in: ConfigIn;
};
declare type InputsFirst = Inputs & Register;
declare type InputsFinal = Inputs & ServerFinal & {
    trio: Trio;
    inst: string;
    ses: string;
};
declare type Lister = {
    (): Promise<string[]>;
};
interface Start {
    (i: InputsFirst): Promise<SecretOut>;
}
interface Login {
    (i: InputsFinal): Promise<SecretOut>;
}
declare const toUserSock: ToUserSock;
declare const toSyncOp: ToSyncOp;
declare const vStart: Start;
declare const vLogin: Login;
export { toUserSock, toSyncOp, vStart, vLogin };
