import type { Git, Trio } from "./util/types";
export interface Creds {
    secret?: string;
    name: string;
}
export interface OkCreds extends Creds {
    secret: string;
}
declare type HasTrio = Record<"trio", Trio>;
declare type Inputs = HasTrio & {
    creds: OkCreds;
    delay: number;
    git: Git;
};
declare function isOkCreds(c: Creds): c is OkCreds;
declare const outbox: (inputs: Inputs) => Promise<boolean>;
export { isOkCreds, outbox };
