export declare type Trio = [string, string, string];
export declare type Git = {
    repo: string;
    owner: string;
    owner_token: string;
};
interface ClientRegister {
    (pass: string, id: string, op: string): Promise<boolean>;
}
interface ClientAuthenticate {
    (pass: string, id: string, t: number, op: string): Promise<string>;
}
declare type Pepper = Record<'ks' | 'ps' | 'Ps' | 'Pu' | 'c', Uint8Array>;
export declare type User = {
    id: string;
    pepper: Pepper;
};
interface ServerRegister {
    (t: number, op: string): Promise<User>;
}
interface ServerAuthenticate {
    (id: string, pep: Pepper, op: string): Promise<string>;
}
export declare type Op = {
    clientRegister: ClientRegister;
    serverRegister: ServerRegister;
    clientAuthenticate: ClientAuthenticate;
    serverAuthenticate: ServerAuthenticate;
};
export {};
