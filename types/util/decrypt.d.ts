export declare type QMI = {
    master_key: Uint8Array;
    search: string;
};
declare type QM = {
    master_key: Uint8Array;
    plain_text: string;
};
declare const decryptQueryMaster: (inputs: QMI) => QM;
export { decryptQueryMaster };
