import type { Git, Trio } from "./util/types.js";
export interface Creds {
    name: string;
    login: boolean;
    registered: boolean;
    secret?: string;
}
export interface OkCreds extends Creds {
    secret: string;
}
declare type HasTrio = Record<"trio", Trio>;
declare type Inputs = HasTrio & {
    creds: OkCreds;
    delay: number;
    env: string;
    git: Git;
};
declare function isOkCreds(c: Creds): c is OkCreds;
declare const outbox: (inputs: Inputs) => Promise<boolean>;
export { isOkCreds, outbox };
