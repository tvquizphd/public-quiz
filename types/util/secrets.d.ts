import type { Git } from "./types.js";
declare type AddInputs = {
    secret: string;
    name: string;
    env: string;
    git: Git;
};
declare const isProduction: (env: string) => boolean;
declare const addSecret: (inputs: AddInputs) => Promise<void>;
export { addSecret, isProduction };
