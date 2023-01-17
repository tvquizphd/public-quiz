import { toB64urlQuery } from "sock-secret";
import { digestNewPass } from './password.js';
import { getRandomValues } from 'crypto';
import { createCipheriv } from 'crypto';

import type { Digest } from "./password.js";

export type QMI = {
  plain_text: string,
  master_key: Uint8Array
}

type EKI = {
  digest: Digest,
  key: Uint8Array
}

type ESI = {
  secret: Uint8Array,
  key: Uint8Array
}

type ESSI = {
  secret_text: string,
  password: string
}

export type Encrypted = { 
  tag: Uint8Array, 
  ev: Uint8Array,
  iv: Uint8Array
}

interface Encrypt {
  (k: Uint8Array, s: Uint8Array): Encrypted
}

export type Secrets = {
  salt: Uint8Array,
  key: Encrypted,
  data: Encrypted
}
const toNumBytes = (n: number) => {
  return getRandomValues(new Uint8Array(n));
}

const textToBuffer = (t: string) => {
  const a = new TextEncoder().encode(t);
  return Buffer.from(a);
}

const encrypt: Encrypt = (key, secret) => {
  const alg = 'AES-256-gcm';
  const iv = Buffer.from(toNumBytes(16));
  const cipher = createCipheriv(alg, key, iv);
  const ev = Buffer.concat([
    cipher.update(secret),
    cipher.final()
  ]);
  const tag = (cipher as any).getAuthTag();
  return { 
    tag: new Uint8Array(tag), 
    ev: new Uint8Array(ev),
    iv: new Uint8Array(iv)
  };
}

const encryptKey = (inputs: EKI) => {
  const { hash } = inputs.digest;
  return encrypt(hash, inputs.key);
}

const encryptSecret = (inputs: ESI) => {
  return encrypt(inputs.key, inputs.secret);
}

const encryptSecrets = async (inputs: ESSI): Promise<Secrets> => {
  // Creation of hash from password
  const inputs_0 = { pass: inputs.password };
  const digest = await digestNewPass(inputs_0);
  const secret = textToBuffer(inputs.secret_text);
  const key = Buffer.from(toNumBytes(32));

  // Return encrypted key and secrets
  return {
    salt: digest.salt,
    key: encryptKey({ digest, key }),
    data: encryptSecret({ secret, key })
  };
}

const encryptQueryMaster = async (inputs: QMI): Promise<string> => {
  const t = inputs.plain_text;
  const key = inputs.master_key;
  const secret = new TextEncoder().encode(t);
  const data = encryptSecret({ secret, key });
  return toB64urlQuery({ data });
}

export {
  encryptSecrets,
  encryptQueryMaster
}
