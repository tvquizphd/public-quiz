import { fromB64urlQuery } from 'sock-secret';
import argon2 from 'argon2';

import { needKeys } from "./keys.js";
import type { Options } from 'argon2';

type HasSalt = {
  salt: Uint8Array
}
type HasHash = {
  hash: Uint8Array
}
export type Digest = HasSalt & HasHash;
export type Pass = Record<"pass", string>;
export type SaltedPass = HasSalt & Pass;
export type ArgonOpts = Partial<Options> & {
  raw: false
};
type Opts = Partial<HasSalt>;
interface Digester {
  (t: string, o: Opts): Promise<Digest>
}
interface DigestNewPass {
  (p: Pass): Promise<Digest>
}
interface DigestPass {
  (p: SaltedPass): Promise<Digest>
}

const isDigest = (v: any): v is Digest => {
  try {
    needKeys(v, ["hash", "salt"]);
  }
  catch {
    return false;
  }
  return true;
}

const toUniformUrl = (str: string): string => {
  return str.replaceAll('+','-').replaceAll('/','_');
}

const digest: Digester = async (text, opts) => {
  const options: ArgonOpts = { 
    type: argon2.argon2d,
    raw: false
  };
  if (opts.salt) {
    options.salt = Buffer.from(opts.salt);
  }
  const url = await argon2.hash(text, options);
  const [s64, h64] = url.split('$').slice(-2);
  const coded = `#salt=:${s64}&hash=:${h64}`;
  const coded_url = toUniformUrl(coded);
  const output = fromB64urlQuery(coded_url);
  if (isDigest(output)) {
    return output;
  }
  throw new Error("Could not digest password");
}

const digestNewPass: DigestNewPass = async ({ pass }) => {
  const text = pass.normalize('NFC');
  return await digest(text, {});
}

const digestPass: DigestPass = async ({ pass, salt }) => {
  const text = pass.normalize('NFC');
  return await digest(text, { salt });
}

export {
  digestNewPass, digestPass
};
