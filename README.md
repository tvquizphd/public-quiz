## Registration

- Add [GitHub Pages](../../settings/pages) sourced from GitHub Actions to this repository.
- Set [personal OAuth App](https://github.com/settings/developers) client ID as this repository's description.

Follow these steps on [pass.tvquizphd.com](https://pass.tvquizphd.com):

1. Copy a temporary public key for ECIES encryption.
2. Paste to this repo's wiki's `Home.md` to trigger registration.
3. Use new one-time code on GitHub as to authorize the OAuth App.
4. Choose a secure master password.

The page will generate a link to visit on each login.

## Login and Usage

Master passwords never leave your browser. After ~60s, [key exchange][PAKE] login:

- Authenticates your password against the [output of a pseudorandom function][OPRF].
- Returns a single-session [AES-GCM][GCM] key for authenticated encryption.

Then, all queries or mutations related to your passwords:

- Are encrypted/decrypted locally with the [Argon2][Argon2] hash of your password.
- Move to/from GitHub Actions encrypted with your single-session AES-GCM key.

## Local Testing

Install `pnpm` and `node 18`

```
wget -qO- https://get.pnpm.io/install.sh | sh -
pnpm env use --global 18
```

Install dependencies

```
pnpm install -g node-gyp
CXX=gcc pnpm install
```

Replace values in `< >` to run the following commands:

Make a secret login link with two-step verification:

```
pnpm develop <MY_TOKEN> <CLIENT_ID>
```

Login at the login link, which should trigger:

```
pnpm develop <MY_TOKEN>
```

## Building for production 

Update the version in `package.json` and with a tag:

```
git tag v1.x.y
git push origin main --tags
```
On each pushed tag, the `build` workflow will:

- Create a pull request for compiled (`tsc`) packaged (`pkg`) linux executable
- Upload the `docs` directory to GitHub Pages.

[PAKE]: https://blog.cloudflare.com/opaque-oblivious-passwords/
[OPRF]: https://www.npmjs.com/package/oprf#security-guarantees
[Argon2]: https://github.com/p-h-c/phc-winner-argon2
[GCM]: https://www.aes-gcm.com/
