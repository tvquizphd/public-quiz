import type { TreeAny, NodeAny } from "project-sock";
import type { Git } from "./types.js";
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
export declare type UserInstall = {
    code: string;
};
export declare type UserApp = UserInstall & {
    server_auth_data: ServerAuthData;
};
export declare type Pasted = UserInstall & {
    server_auth_data?: ServerAuthData;
};
interface ReadUserInstall {
    (u: UserIn): Promise<UserInstall>;
}
interface ReadUserApp {
    (u: UserIn): Promise<UserApp>;
}
export declare function isTree(u: NodeAny): u is TreeAny;
declare const readUserApp: ReadUserApp;
declare const readUserInstall: ReadUserInstall;
export { readUserApp, readUserInstall };
