declare module '@nthparty/opaque' {

  import type { SocketWrapper } from "project-sock";

  interface ClientRegister {
   (pass: string, id: string, op: string): Promise<boolean>;
  }

  interface ClientAuthenticate {
   (pass: string, id: string, t: number, op: string): Promise<string>;
  }
  type PepperKeys = 'ks' | 'ps' | 'Ps' | 'Pu' | 'c';
  export type Pepper = Record<PepperKeys, Uint8Array>;
  type User = {
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
  const OP: (Sock: SocketWrapper) => Promise<Op>;
  export default OP;
}
