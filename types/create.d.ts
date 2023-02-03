import type { Git } from "./util/types.js";
import type { NodeAny, TreeAny } from "sock-secret";
interface ToAppInput {
    code: string;
}
declare type AppStrings = {
    client_id: string;
    client_secret: string;
};
declare type JWK = {
    kty: 'RSA';
    n: string;
    e: string;
    d: string;
    p: string;
    q: string;
    dp: string;
    dq: string;
    qi: string;
};
export declare type AppOutput = AppStrings & {
    id: string;
    jwk: JWK;
};
interface ToApp {
    (i: ToAppInput): Promise<AppOutput>;
}
export declare type HasToken = {
    token: string;
};
export declare type Installed = HasToken & {
    expiration: string;
};
export declare type Installation = {
    installed: Installed;
    app: AppOutput;
    shared: string;
};
export declare type ObjAny = TreeAny | {
    [key: string]: unknown;
};
export interface Permissions {
    [key: string]: string;
}
export declare type UserInstallRaw = {
    id: string;
    permissions: Permissions;
};
export declare type UserInstall = UserInstallRaw & {
    git: Git;
    app: AppOutput;
};
interface ToInstall {
    (i: UserInstall): Promise<Installed>;
}
declare function parseInstall(o: TreeAny): UserInstallRaw;
declare function isObjAny(u: unknown): u is ObjAny;
declare function isInstallation(o: NodeAny): o is Installation;
declare function isJWK(o: ObjAny): o is JWK;
declare const toPEM: (key: JWK) => string;
declare const toApp: ToApp;
declare const toInstall: ToInstall;
declare const toSign: (app: AppOutput) => string;
export { isObjAny, toPEM, isJWK, toSign, toApp, toInstall, isInstallation, parseInstall };
