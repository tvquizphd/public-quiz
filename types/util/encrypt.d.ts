export declare type QMI = {
    plain_text: string;
    master_key: Uint8Array;
};
declare type ESSI = {
    secret_text: string;
    password: string;
};
export declare type Encrypted = {
    tag: Uint8Array;
    ev: Uint8Array;
    iv: Uint8Array;
};
export declare type Secrets = {
    salt: Uint8Array;
    key: Encrypted;
    data: Encrypted;
};
declare const encryptSecrets: (inputs: ESSI) => Promise<Secrets>;
declare const encryptQueryMaster: (inputs: QMI) => Promise<string>;
export { encryptSecrets, encryptQueryMaster };
