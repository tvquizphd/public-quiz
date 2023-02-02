export declare type Five = [string, string, string, string, string];
export declare type Quad = [string, string, string, string];
export declare type Trio = [string, string, string];
export declare type Duo = [string, string];
export declare type Git = {
    repo: string;
    owner: string;
    owner_token: string;
};
declare function isFive(args: string[]): args is Five;
declare function isQuad(args: string[]): args is Quad;
declare function isTrio(args: string[]): args is Trio;
declare function isDuo(args: string[]): args is Duo;
export { isQuad, isTrio, isDuo, isFive };
