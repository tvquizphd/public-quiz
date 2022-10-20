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
declare const decryptQueryMaster: (inputs: QMI) => QM;
declare const decryptQuery: DecryptQuery;
export { isBytes, decryptQueryMaster, decryptQuery };
