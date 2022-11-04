interface ToAppInput {
    code: string;
}
declare type AppStrings = {
    client_id: string;
    client_secret: string;
};
declare type JWK = {
    kty: 'RSA';
    n: string;
    e: string;
    d: string;
    p: string;
    q: string;
    dp: string;
    dq: string;
    qi: string;
};
export declare type AppOutput = AppStrings & {
    jwk: JWK;
};
interface ToApp {
    (i: ToAppInput): Promise<AppOutput>;
}
interface ToInstallInput {
    code: string;
    app: AppOutput;
}
declare type InStrings = {
    scope: string;
    access_token: string;
    refresh_token: string;
};
export declare type Installed = InStrings & {
    expires_in: string;
    refresh_token_expires_in: string;
};
interface ToInstall {
    (i: ToInstallInput): Promise<Installed>;
}
declare function isJWK(o: JsonWebKey): o is JWK;
declare const toPEM: (key: JWK) => string;
declare const toApp: ToApp;
declare const toInstall: ToInstall;
export { toPEM, isJWK, toApp, toInstall };
