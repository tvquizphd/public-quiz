import { fromB64urlQuery } from "project-sock";
import { createDecipheriv } from 'crypto';
import { needKeys } from "./keys";

import type { Encrypted } from "./encrypt";

type DSI = {
  key: Uint8Array,
  data: Encrypted,
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

const hasEncryptionKeys = (v: any): v is Encrypted => {
  try {
    needKeys(v, ["ev", "iv", "tag"]);
  }
  catch {
    return false;
  }
  return true;
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

const decryptSecret = ({ key, data }: DSI) => {
  return decrypt(key, data.ev, data.iv, data.tag);
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
  throw new Error("Could not decrypt query");
}

export {
  decryptQueryMaster
}
