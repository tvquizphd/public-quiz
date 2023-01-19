import type { Git } from "./types.js";
declare type ShareIn = {
    git: Git;
    body: string;
    release_id: number;
};
interface Share {
    (i: ShareIn): Promise<void>;
}
declare const vShare: Share;
export { vShare };
