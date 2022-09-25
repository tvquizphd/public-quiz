import type { Git, Trio } from "./util/types";
import type { Creds } from "./verify";
export interface OkCreds extends Creds {
    session: string;
}
declare type HasSec = Record<"sec", Trio>;
declare type Inputs = HasSec & {
    creds: OkCreds;
    delay: number;
    git: Git;
};
declare const outbox: (inputs: Inputs) => Promise<boolean>;
export { outbox };
