import { fromB64urlQuery } from 'project-sock';
import { hash, argon2d } from 'argon2';

import { needKeys } from "./keys";

export type Digest = {
  hash: Uint8Array,
  salt: Uint8Array,
}
export type Pass = Record<"pass", string>;
interface Digester {
  (t: string): Promise<Digest>
}
interface DigestPass {
  (p: Pass): Promise<Digest>
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

const digest: Digester = async (text) => {
  const options = { type: argon2d };
  const url = await hash(text, options);
  const [s64, h64] = url.split('$').slice(-2);
  const coded = `?salt=:${s64}&hash=:${h64}`;
  const coded_url = toUniformUrl(coded);
  const output = fromB64urlQuery(coded_url);
  if (isDigest(output)) {
    return output;
  }
  throw new Error("Could not digest password");
}

const digestNewPass: DigestPass = async ({ pass }) => {
  const text = pass.normalize('NFC');
  return await digest(text);
}

export {
  digestNewPass
};
