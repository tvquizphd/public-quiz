export type Trio = [string, string, string];

export type Git = {
  repo: string,
  owner: string,
  owner_token: string
}

interface ClientRegister {
 (pass: string, id: string, op: string): Promise<boolean>;
}

interface ClientAuthenticate {
 (pass: string, id: string, t: number, op: string): Promise<string>;
}

type Pepper = Record<'ks' | 'ps' | 'Ps' | 'Pu' | 'c', Uint8Array>;
export type User = {
  id: string,
  pepper: Pepper
}
interface ServerRegister {
 (t: number, op: string): Promise<User>;
}
interface ServerAuthenticate {
 (id: string, pep: Pepper, op: string): Promise<string>;
}

export type Op = {
  clientRegister: ClientRegister,
  serverRegister: ServerRegister,
  clientAuthenticate: ClientAuthenticate,
  serverAuthenticate: ServerAuthenticate
}
