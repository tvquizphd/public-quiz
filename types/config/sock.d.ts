export declare type Project = {
    title: string;
    prefix: string;
};
export declare type Socket = {
    text: string;
    prefix: string;
    suffix: string;
};
export declare type Command = Socket & {
    subcommand: string;
    command: string;
};
export interface NameInterface {
    commands: Command[];
    sockets: Socket[];
    project: Project;
}
declare type Obj<T> = Record<string, T>;
export declare type Namespace = Obj<NameInterface>;
declare const configureNamespace: (env: string) => Namespace;
export { configureNamespace };
