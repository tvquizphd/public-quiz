import type { Git } from "./util/types";
declare type ConfigIn = {
    login: boolean;
    delay: number;
    pep: string;
    tok: string;
    git: Git;
};
declare type Output = string;
interface Verify {
    (i: ConfigIn): Promise<Output>;
}
declare const verify: Verify;
export { verify };
