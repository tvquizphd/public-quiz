import type { ClientOut, NewClientOut } from "opaque-low-io";
import type { Secrets } from "./encrypt.js";
import type { TreeAny, NodeAny } from "sock-secret";
import type { UserInstall } from "../create.js";
import type { AppOutput } from "../create.js";
import type { Git, Trio } from "./types.js";
export declare type HasGit = {
    git: Git;
};
export declare type WikiConfig = {
    home: string;
    tmp: string;
};
export declare type UserIn = HasGit & {
    delay: number;
    prod: boolean;
    wiki_config: WikiConfig;
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
export declare type Pasted = {
    C: Secrets;
    S?: ServerAuthData;
};
export declare type UserApp = Pasted & {
    S: ServerAuthData;
};
declare type DevInboxIn = {
    user_in: UserIn;
    inst: string;
    sec: Trio;
};
interface ReadUserInstall {
    (u: InstallIn): Promise<UserInstall>;
}
interface ReadUserApp {
    (u: UserIn): Promise<UserApp>;
}
interface ReadDevInbox {
    (u: DevInboxIn): Promise<null>;
}
interface ReadLoginStart {
    (u: UserIn): Promise<boolean>;
}
interface ReadLoginEnd {
    (u: UserIn): Promise<boolean>;
}
declare type Tries = {
    max_tries: number;
    dt: number;
};
interface ToTries {
    (u: number): Tries;
}
interface ToPastedText {
    (s: string): Promise<string>;
}
declare type GitOutput = {
    repo_url: string;
    tmp_dir: string;
    tmp_file: string;
};
interface UseGit {
    (i: UserIn): GitOutput;
}
declare type Obj = Record<string, unknown>;
declare type NameTree = {
    command: string;
    tree: TreeAny;
};
interface ToNameTree {
    (t: string): NameTree;
}
interface FromNameTree {
    (t: NameTree): string;
}
declare function isObj(u: unknown): u is Obj;
declare function isTree(u: NodeAny): u is TreeAny;
declare type ClientAuthData = NewClientOut["client_auth_data"];
declare function isLoginStart(o: NodeAny): o is ClientAuthData;
declare type ClientAuthResult = ClientOut["client_auth_result"];
declare function isLoginEnd(o: NodeAny): o is ClientAuthResult;
declare const useGit: UseGit;
declare const toPastedText: ToPastedText;
declare const toTries: ToTries;
declare const toBytes: (s: string) => Uint8Array;
declare const toInstallation: (inst: string) => import("../create.js").Installation;
declare const readDevInbox: ReadDevInbox;
declare const readLoginStart: ReadLoginStart;
declare const readLoginEnd: ReadLoginEnd;
declare const readUserApp: ReadUserApp;
declare const readUserInstall: ReadUserInstall;
declare const toNameTree: ToNameTree;
declare const fromNameTree: FromNameTree;
export { readUserApp, readUserInstall, toTries, toPastedText, useGit, isTree, isLoginStart, isLoginEnd, toNameTree, fromNameTree, readLoginStart, readLoginEnd, isObj, readDevInbox, toBytes, toInstallation };
