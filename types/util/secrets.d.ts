import type { Git } from "./types.js";
import type { NameTree } from "./pasted.js";
declare type Inputs = {
    delay: number;
    env: string;
    git: Git;
};
declare type SetInputs = Inputs & NameTree;
declare const isProduction: (env: string) => boolean;
declare const setSecret: (inputs: SetInputs) => Promise<void>;
export { setSecret, isProduction };
