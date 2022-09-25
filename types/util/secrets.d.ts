import type { Git } from "./types";
declare type Inputs = {
    secret_name: string;
    git: Git;
};
declare type AddInputs = Inputs & {
    secret: string;
};
declare const deleteSecret: (inputs: Inputs) => Promise<void>;
declare const addSecret: (inputs: AddInputs) => Promise<void>;
export { deleteSecret, addSecret };
