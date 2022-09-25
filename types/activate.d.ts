import type { Git } from "./util/types";
declare type ConfigureInputs = {
    git: Git;
    delay: number;
    client_id: string;
    master_pass: string;
};
declare const activate: (config_in: ConfigureInputs) => Promise<unknown>;
export { activate };
