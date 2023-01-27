import type { Git, Trio } from "./util/types.js";
import type { LoginStart, LoginEnd } from "./util/pasted.js";
import type { ServerFinal } from "opaque-low-io";
import type { Ops } from 'opaque-low-io';
declare type CommandKeys = ("OPEN_IN" | "OPEN_NEXT" | "OPEN_OUT" | "CLOSE_IN" | "CLOSE_USER" | "CLOSE_MAIL");
export declare type Commands = Record<CommandKeys, string>;
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
declare type RegisterInputs = {
    tree: LoginStart;
};
declare type LoginInputs = {
    tree: LoginEnd;
};
declare type Inputs = {
    log_in: ConfigIn;
    commands: Commands;
};
declare type InputsFirst = Inputs & RegisterInputs;
declare type InputsFinal = Inputs & LoginInputs & {
    final: ServerFinal;
    trio: Trio;
    inst: string;
    ses: string;
};
interface Start {
    (i: InputsFirst): Promise<SecretOut>;
}
interface Login {
    (i: InputsFinal): Promise<SecretOut>;
}
declare const toSyncOp: ToSyncOp;
declare const vStart: Start;
declare const vLogin: Login;
export { toSyncOp, vStart, vLogin };
