import type { Options } from 'argon2';
declare type HasSalt = {
    salt: Uint8Array;
};
declare type HasHash = {
    hash: Uint8Array;
};
export declare type Digest = HasSalt & HasHash;
export declare type Pass = Record<"pass", string>;
export declare type SaltedPass = HasSalt & Pass;
export declare type ArgonOpts = Partial<Options> & {
    raw: false;
};
interface DigestNewPass {
    (p: Pass): Promise<Digest>;
}
interface DigestPass {
    (p: SaltedPass): Promise<Digest>;
}
declare const digestNewPass: DigestNewPass;
declare const digestPass: DigestPass;
export { digestNewPass, digestPass };
