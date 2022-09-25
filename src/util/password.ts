import { getRandomValues, randomInt } from 'crypto';
import { fromB64urlQuery } from 'project-sock';
import { hash, argon2d } from 'argon2';

export type Digest = {
  hash: Uint8Array,
  salt: Uint8Array,
}
export type Pass = Record<"pass", string>;
interface Digester {
  (t: string, o: {}): Promise<Digest>
}
interface DigestPass {
  (p: Pass): Promise<Digest>
}

const toUniformUrl = (str: string): string => {
  return str.replaceAll('+','-').replaceAll('/','_');
}

const digest: Digester = async (text, opts) => {
  const options = {...opts, type: argon2d };
  const url = await hash(text, options);
  const [s64, h64] = url.split('$').slice(-2);
  const coded = `?salt=:${s64}&hash=:${h64}`;
  const coded_url = toUniformUrl(coded);
  return fromB64urlQuery(coded_url);
}

const digestNewPass: DigestPass = async ({ pass }) => {
  const text = pass.normalize('NFC');
  return await digest(text, {});
}

export {
  digestNewPass
};
