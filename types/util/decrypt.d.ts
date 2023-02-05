/// <reference types="node" />
import type { Encrypted } from "./encrypt.js";
declare type DSI = {
    key: Uint8Array;
    data: Encrypted;
};
declare type HasError = {
    error: string;
};
export declare type QMI = {
    master_key: Uint8Array;
    search: string;
};
declare type QM = {
    master_key: Uint8Array;
    plain_text: string;
};
interface DecryptQuery {
    (s: string, pass: string): Promise<QM>;
}
declare function isBytes(o: any): o is Uint8Array;
declare const hasEncryptionKeys: (v: any) => v is Encrypted;
declare const tryDecryptSecret: (opts: DSI & HasError) => Buffer;
declare const decryptSecret: ({ key, data }: DSI) => Buffer;
declare const decryptQueryMaster: (inputs: QMI) => QM;
declare const decryptQuery: DecryptQuery;
export { isBytes, decryptQueryMaster, decryptQuery, decryptSecret, hasEncryptionKeys, tryDecryptSecret };
