import type { Git } from "./util/types";
declare type ConfigureInputs = {
    git: Git;
    tok: string;
    delay: number;
    client_id: string;
    wiki_config: WikiConfig;
};
declare type WikiConfig = {
    home: string;
    tmp: string;
};
interface Cleanup {
    (): Promise<void>;
}
interface Activate {
    (i: ConfigureInputs): Promise<Cleanup>;
}
declare const activate: Activate;
export { activate };
