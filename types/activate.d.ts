import type { Git } from "./util/types";
declare type HasClient = {
    client_id: string;
};
declare type BasicInputs = {
    wiki_config: WikiConfig;
    git: Git;
};
declare type CoreInputs = BasicInputs & {
    prod: boolean;
    delay: number;
};
declare type MainInputs = CoreInputs & HasClient;
declare type MainTokenInputs = HasClient & {
    git: Git;
    tok: string;
};
declare type WikiConfig = {
    home: string;
    tmp: string;
};
interface ActivateCode {
    (i: MainInputs): Promise<boolean>;
}
interface ActivateToken {
    (i: MainTokenInputs): Promise<boolean>;
}
interface Cleanup {
    (): Promise<boolean>;
}
interface Activate {
    (t: string, i: MainInputs): Promise<Cleanup>;
}
declare const activate: Activate;
declare const activation: (ActivateCode | ActivateToken)[];
export { activation, activate };
