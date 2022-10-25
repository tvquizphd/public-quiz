import type { Git, Trio } from "./util/types.js";
declare type HasSec = Record<"sec", Trio>;
export declare type Inputs = HasSec & {
    ses: string;
    env: string;
    delay: number;
    git: Git;
};
declare type Output = {
    trio: Trio;
};
interface Inbox {
    (i: Inputs): Promise<Output>;
}
declare const inbox: Inbox;
export { inbox };
