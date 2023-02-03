import type { ClientOut, NewClientOut } from "opaque-low-io";
import type { Installed } from "../create.js";
import type { TreeAny } from "sock-secret";
import type { UserInstall } from "../create.js";
import type { AppOutput } from "../create.js";
import type { Git, Trio } from "./types.js";
import type { Encrypted, Secrets } from "./encrypt.js";
export declare type HasGit = {
    git: Git;
};
export declare type DevConfig = {
    home: string;
    tmp: string;
};
export declare type UserIn = HasGit & {
    delay: number;
    prod: boolean;
    dev_config: DevConfig;
};
declare type HasSessionHash = {
    session_hash: Uint8Array;
};
declare type InstallIn = HasGit & {
    delay: number;
    app: AppOutput;
};
declare type ItemInC = {
    "body": Uint8Array;
    "mac_tag": Uint8Array;
};
declare type ServerAuthData = {
    As: Uint8Array;
    Xs: Uint8Array;
    beta: Uint8Array;
    c: Record<"pu" | "Pu" | "Ps", ItemInC>;
};
export declare type UserApp = {
    C: Secrets;
    S: ServerAuthData;
};
declare type InboxIn = {
    inst: string;
    table: string;
};
declare type DevInboxIn = InboxIn & {
    user_in: UserIn;
};
interface ReadUserInstall {
    (u: InstallIn): Promise<UserInstall>;
}
interface ReadUserApp {
    (u: UserIn): Promise<UserApp>;
}
interface ReadReset {
    (u: UserIn): Promise<boolean>;
}
interface ReadInbox {
    (u: InboxIn): Promise<Trio>;
}
interface ReadDevInbox {
    (u: DevInboxIn): Promise<void>;
}
interface ReadLoginStart {
    (u: UserIn): Promise<boolean>;
}
interface ReadLoginEnd {
    (u: UserIn): Promise<boolean>;
}
export declare type NameTree = {
    command: string;
    tree: TreeAny;
};
interface ToNameTree {
    (t: string): NameTree;
}
declare function hasSessionHash(u: TreeAny): u is HasSessionHash;
declare function isEncrypted(d: TreeAny): d is Encrypted;
export declare type LoginStart = {
    client_auth_data: NewClientOut["client_auth_data"];
};
declare function isLoginStart(nt: TreeAny): nt is LoginStart;
export declare type LoginEnd = {
    client_auth_result: ClientOut["client_auth_result"];
};
declare function isLoginEnd(nt: TreeAny): nt is LoginEnd;
declare const readUserApp: ReadUserApp;
declare const toBytes: (s: string) => Uint8Array;
declare const useGitInstalled: (git: Git, installed: Installed) => Git;
declare const toInstallation: (inst: string) => import("../create.js").Installation;
declare const readInbox: ReadInbox;
declare const readDevInbox: ReadDevInbox;
declare const readDevReset: ReadReset;
declare const readLoginStart: ReadLoginStart;
declare const readLoginEnd: ReadLoginEnd;
declare const readUserInstall: ReadUserInstall;
declare const toNameTree: ToNameTree;
export { readUserApp, readUserInstall, isEncrypted, isLoginStart, isLoginEnd, toNameTree, useGitInstalled, readLoginStart, readLoginEnd, readDevInbox, toBytes, toInstallation, readInbox, readDevReset, hasSessionHash };
