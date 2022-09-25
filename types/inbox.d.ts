import type { Git, Trio } from "./util/types";
declare type HasSec = Record<"sec", Trio>;
declare type Inputs = HasSec & {
    session: string;
    delay: number;
    git: Git;
};
declare const inbox: (inputs: Inputs) => Promise<boolean>;
export { inbox };
