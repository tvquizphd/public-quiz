import type { Git } from "./types.js";
import type { NameTree } from "./pasted.js";
declare type Inputs = {
    env: string;
    git: Git;
};
declare type SetTextInputs = Inputs & {
    secret: string;
    name: string;
};
declare type SetInputs = Inputs & NameTree;
declare const isProduction: (env: string) => boolean;
declare const setSecretText: (inputs: SetTextInputs) => Promise<void>;
declare const setSecret: (inputs: SetInputs) => Promise<void>;
export { setSecretText, setSecret, isProduction };
