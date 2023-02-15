import type { Trio } from "./util/types.js";
import type { Installation, HasToken } from "./create.js";
import type { CommandTreeList } from "sock-secret";
import type { TreeAny } from "sock-secret";
import type { LoginStart, LoginEnd, HasShared } from "./util/pasted.js";
import type { ServerFinal } from "opaque-low-io";
import type { Ops } from 'opaque-low-io';
declare type CommandKeys = ("RESET" | "OPEN_IN" | "OPEN_NEXT" | "OPEN_OUT" | "CLOSE_IN");
declare type MailKeys = ("USER" | "SESSION");
declare type HasNewUser = {
    user: HasShared;
};
declare type HasServerFinal = {
    final: ServerFinal;
};
export declare type Commands = Record<CommandKeys, string>;
export declare type MailTypes = Record<MailKeys, string>;
interface ToSyncOp {
    (): Promise<Ops>;
}
export declare type SecretOut = {
    secrets: CommandTreeList;
    for_pages: string;
    for_next: string;
};
declare type RegisterInputs = {
    pep: string;
    tree: LoginStart;
};
declare type Inputs = {
    commands: Commands;
};
declare type InputsFirst = Inputs & RegisterInputs & {
    pub_ctli: CommandTreeList;
    shared: string;
    reset: boolean;
};
declare type InputsFinal = Inputs & {
    final: ServerFinal;
    tree: LoginEnd;
};
declare type InputsUpdateUser = {
    mail_types: MailTypes;
    preface: CommandTreeList;
    installation: Installation;
};
declare type InputsMail = HasToken & {
    table: string;
    trio: Trio;
    mail_types: MailTypes;
    installation: Installation;
};
interface Start {
    (i: InputsFirst): Promise<SecretOut>;
}
interface Login {
    (i: InputsFinal): Promise<HasToken>;
}
interface Mail {
    (i: InputsMail): Promise<SecretOut>;
}
interface UpdateUser {
    (i: InputsUpdateUser): Promise<SecretOut>;
}
declare function hasNewUser(o: TreeAny): o is HasNewUser;
declare function hasServerFinal(o: TreeAny): o is HasServerFinal;
declare const toSyncOp: ToSyncOp;
declare const vStart: Start;
declare const vLogin: Login;
declare const updateUser: UpdateUser;
declare const vMail: Mail;
export { toSyncOp, vStart, vLogin, vMail, updateUser, hasNewUser, hasServerFinal };
