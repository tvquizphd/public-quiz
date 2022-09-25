export declare type Digest = {
    hash: Uint8Array;
    salt: Uint8Array;
};
export declare type Pass = Record<"pass", string>;
interface DigestPass {
    (p: Pass): Promise<Digest>;
}
declare const digestNewPass: DigestPass;
export { digestNewPass };
