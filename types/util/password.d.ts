declare type HasSalt = {
    salt: Uint8Array;
};
declare type HasHash = {
    hash: Uint8Array;
};
export declare type Digest = HasSalt & HasHash;
export declare type Pass = Record<"pass", string>;
export declare type SaltedPass = HasSalt & Pass;
interface DigestNewPass {
    (p: Pass): Promise<Digest>;
}
interface DigestPass {
    (p: SaltedPass): Promise<Digest>;
}
declare const digestNewPass: DigestNewPass;
declare const digestPass: DigestPass;
export { digestNewPass, digestPass };
