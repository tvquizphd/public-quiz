import { fromB64urlQuery } from "sock-secret";
import { createDecipheriv } from 'crypto';
import { digestPass } from './password.js';
import { needKeys } from "./keys.js";

import type { Encrypted } from "./encrypt.js";

type DSI = {
  key: Uint8Array,
  data: Encrypted,
}
type DKI = {
  hash: Uint8Array,
  key: Encrypted,
}
type HasError = {
  error: string
}
export type QMI = {
  master_key: Uint8Array,
  search: string
}
type QM = {
  master_key: Uint8Array,
  plain_text: string
}
interface Decrypt {
  (k: Uint8Array, ev: Uint8Array, iv: Uint8Array, tag: Uint8Array): Buffer;
}
interface DecryptQuery {
  (s: string, pass: string): Promise<QM>
}

function isBytes(o: any): o is Uint8Array {
  return ArrayBuffer.isView(o);
}

const hasEncryptionKeys = (v: any): v is Encrypted => {
  try {
    needKeys(v, ["ev", "iv", "tag"]);
  }
  catch {
    return false;
  }
  const values = [v.ev, v.iv, v.tag];
  return values.every(isBytes);
}

const decrypt: Decrypt = (key, ev, iv, tag) => {
  const alg = 'AES-256-gcm';
  const decipher = createDecipheriv(alg, key, iv);
  (decipher as any).setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ev),
    decipher.final()
  ]);
}

const tryDecryptSecret = (opts: DSI & HasError) => {
  try {
    return decryptSecret(opts);
  }
  catch {
    throw new Error(opts.error);
  }
}

const decryptSecret = ({ key, data }: DSI) => {
  return decrypt(key, data.ev, data.iv, data.tag);
}

const decryptKey = ({ hash, key }: DKI) => {
  return decrypt(hash, key.ev, key.iv, key.tag);
}

const decryptQueryMaster = (inputs: QMI): QM => {
  const { master_key: key, search } = inputs;
  const { data } = fromB64urlQuery(search);
  if (hasEncryptionKeys(data)) {
    const out = decryptSecret({ data, key });
    return {
      master_key: new Uint8Array(key),
      plain_text: new TextDecoder().decode(out)
    }
  }
  throw new Error("Invalid encryption data");
}

const decryptQuery: DecryptQuery = async (search, pass) => {
  const inputs = fromB64urlQuery(search);
  const { salt, key } = inputs;
  if (hasEncryptionKeys(key) && isBytes(salt)) {
    const { hash } = await digestPass({ pass, salt });
    const master_key = await decryptKey({ hash, key });
    return decryptQueryMaster({ search, master_key });
  }
  throw new Error("Invalid decryption key or salt");
}

export {
  isBytes, decryptQueryMaster, decryptQuery, decryptSecret, hasEncryptionKeys,
  tryDecryptSecret
}
