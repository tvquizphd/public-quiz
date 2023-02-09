import type { Git } from "./types.js";
import type { NameTree } from "./pasted.js";
export declare type SecretInputs = {
    delay: number;
    env: string;
    git: Git;
};
export declare type SetInputs = SecretInputs & NameTree;
declare const isProduction: (env: string) => boolean;
declare const setSecret: (inputs: SetInputs) => Promise<void>;
export { setSecret, isProduction };
