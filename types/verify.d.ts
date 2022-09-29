import type { Git } from "./util/types";
declare type ConfigIn = {
    delay: number;
    pep: string;
    git: Git;
};
declare type Output = string | void;
interface Verify {
    (i: ConfigIn): Promise<Output>;
}
declare const verify: Verify;
export { verify };
