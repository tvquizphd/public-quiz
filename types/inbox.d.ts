import type { Git, Trio } from "./util/types";
declare type HasSec = Record<"sec", Trio>;
declare type Inputs = HasSec & {
    session: string;
    delay: number;
    git: Git;
};
declare type Secrets = Record<string, string>;
declare type Output = {
    secrets: Secrets;
    trio: Trio;
};
interface Inbox {
    (i: Inputs): Promise<Output>;
}
declare const inbox: Inbox;
export { inbox };
