/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import type { Git } from "./types.js";
declare type AddInputs = {
    secret: string;
    name: string;
    env: string;
    git: Git;
};
declare const isProduction: ({ argv }: NodeJS.Process) => boolean;
declare const addSecret: (inputs: AddInputs) => Promise<void>;
export { addSecret, isProduction };
