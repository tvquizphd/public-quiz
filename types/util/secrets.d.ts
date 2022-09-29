/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import type { Git } from "./types";
declare type Inputs = {
    name: string;
    git: Git;
};
declare type AddInputs = Inputs & {
    secret: string;
};
declare const isProduction: ({ argv }: NodeJS.Process) => boolean;
declare const deleteSecret: (inputs: Inputs) => Promise<void>;
declare const addSecret: (inputs: AddInputs) => Promise<void>;
export { deleteSecret, addSecret, isProduction };
