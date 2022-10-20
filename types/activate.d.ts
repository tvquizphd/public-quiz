import type { Git } from "./util/types";
declare type HasClient = {
    client_id: string;
};
declare type HasGit = {
    git: Git;
};
declare type BasicInputs = HasClient & HasGit;
declare type CoreInputs = HasGit & {
    wiki_config: WikiConfig;
    prod: boolean;
    delay: number;
};
declare type MainCodeInputs = BasicInputs & CoreInputs;
declare type MainTokenInputs = BasicInputs & {
    code_outputs: CodeOutputs;
    tok: string;
};
declare type WikiConfig = {
    home: string;
    tmp: string;
};
declare type HasDevice = {
    device_code: string;
};
declare type HasMaster = {
    master_key: Uint8Array;
};
declare type Pasted = {
    pub: Uint8Array;
};
declare type HasPubMaster = Pasted & HasMaster;
declare type CodeOutputs = HasDevice & HasPubMaster;
export declare type SecretInputs = Git | CodeOutputs;
declare type GitInputs = HasGit & {
    secret: string;
};
export declare type SecretOutputs = {
    for_pages: string;
    for_next: string;
};
interface ActivateCode {
    (i: MainCodeInputs): Promise<SecretOutputs>;
}
interface ActivateToken {
    (i: MainTokenInputs): Promise<SecretOutputs>;
}
interface GitDecrypt {
    (i: GitInputs): Promise<SecretInputs>;
}
declare type Activation = [
    ActivateCode,
    ActivateToken
];
declare function isGit(a: SecretInputs): a is Git;
declare const gitDecrypt: GitDecrypt;
declare const activation: Activation;
export { isGit, gitDecrypt, activation, };
