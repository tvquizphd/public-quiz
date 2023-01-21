import type { AppOutput } from "../create.js";
import type { Git } from "./types.js";
declare type AddInputs = {
    app: AppOutput;
    secret: string;
    name: string;
    env: string;
    git: Git;
};
declare const isProduction: (env: string) => boolean;
declare const addSecret: (inputs: AddInputs) => Promise<void>;
export { addSecret, isProduction };
