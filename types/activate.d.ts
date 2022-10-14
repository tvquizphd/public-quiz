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
declare const activate: (config_in: ConfigureInputs) => Promise<unknown>;
export { activate };
