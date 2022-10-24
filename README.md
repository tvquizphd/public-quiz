## Registration

- Add [GitHub Pages](../../settings/pages) sourced from GitHub Actions to this repository.
- Set [OAuth App](https://github.com/settings/developers) client ID as this repository's description.

Follow all steps on [pass.tvquizphd.com](https://pass.tvquizphd.com):

1. Copy one-time ECIES public key.
2. Paste key to the wiki's `Home.md`.
3. Use one-time GitHub code for [OAuth App](https://github.com/settings/applications).
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

- [Fork this repository][FORK_THIS] to e.g `my_github_username`
- Open a terminal, and clone your forked repository:

```
REPO_URL=my_github_username/public-quiz-device
git clone git@github.com:$REPO_URL.git
cd public-quiz-device
```

Install `pnpm`, `node 18`, and dependencies:

```
wget -qO- https://get.pnpm.io/install.sh | sh -
pnpm env use --global 18
pnpm install -g node-gyp
CXX=gcc pnpm install
```

In a separate terminal, run:

```
cd public-quiz-device
npx http-server docs -p 8000
```

Run `bash develop.bash` twice or more, following instructions.

1. On 1st run, it registers your master password.
  - It uses the OAuth App in this repostory's description.
  - The new OAuth token in `.env` is encrypted in a new login link.
2. Afterwards, `bash develop.bash` allows revisiting your login link.
  - If you want to make a new login link, press `n` after running.
  - To use your existing login link, press `y` after running.

## Building for production 

Update the version in `package.json` and with a tag:

```
git tag v3.x.y
git push origin main --tags
```
On each pushed tag, the `build` workflow will:

- Create a pull request for compiled (`tsc`) packaged (`pkg`) linux executable
- Upload the `docs` directory to GitHub Pages.

[FORK_THIS]: https://github.com/tvquizphd/public-quiz-device/fork
[PAKE]: https://blog.cloudflare.com/opaque-oblivious-passwords/
[OPRF]: https://www.npmjs.com/package/oprf#security-guarantees
[Argon2]: https://github.com/p-h-c/phc-winner-argon2
[GCM]: https://www.aes-gcm.com/
