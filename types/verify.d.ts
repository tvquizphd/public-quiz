import type { Git } from "./util/types";
export declare type Creds = Record<"session", string | void>;
declare type ConfigIn = {
    delay: number;
    git: Git;
};
declare const verify: (config_in: ConfigIn) => Promise<Creds>;
export { verify };
