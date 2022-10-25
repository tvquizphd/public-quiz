# Public Quiz Device

- ⏱️ [Setup and usage](#setup-and-usage)
- 🔑 [Security claims](#security-claims)
- ✍️ [Local testing](#local-testing)
- 📦 [Production](#production-builds)

## Setup and usage

- [Fork this repository][FORK_THIS] and add [GitHub Pages](../../settings/pages) via GitHub Actions.
  - Keep the description. It defines an [OAuth App](https://github.com/settings/applications/new) w/ Device Flow.
- ⭐ Star your fork to create your GitHub Pages environment.

**Register via your GitHub Pages URL**, like: [pass.tvquizphd.com](https://pass.tvquizphd.com):

1. Copy one-time ECIES public key to the link given for your fork's wiki.
3. Paste one-time GitHub code to add your [OAuth App](https://github.com/settings/applications).
4. Choose a secure master password.

The page gives you a link to bookmark. You must use your master password each time you use the link.

## Security claims

Before activation, GitHub pages publicly hosts public keys and asymmetrically encrypted messages. *Your master password, however, never leaves your browser*. Each login takes about 60 seconds to complete the password-authenticated [key exchange][PAKE] by.

- Authenticating your password against the [output of a pseudorandom function][OPRF].
- Returning a single-session [AES-GCM][GCM] key for authenticated encryption.

### After login, all queries or mutations related to your passwords:

- Are encrypted/decrypted locally with the [Argon2][Argon2] hash of your password.
- Move to/from GitHub Actions encrypted with your single-session AES-GCM key.

The symmetrically encrypted messages move to/from GitHub Actions via private GitHub Projects.

## Local Testing

- In [environment.csv](./docs/environment.csv), set `REMOTE` to `your_username/public-quiz-device`.
- Open a terminal, and clone your forked repository:

```properties
YOU=your_username
REPO_URL=$YOU/public-quiz-device
git clone git@github.com:$REPO_URL.git
cd public-quiz-device
```

Install `pnpm`, `node 18`, and dependencies:

```properties
wget -qO- https://get.pnpm.io/install.sh | sh -
pnpm env use --global 18
pnpm install -g node-gyp
CXX=gcc pnpm install
```

In a separate terminal, run:

```properties
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

## Production builds

Update the version in `package.json` and with a tag:

```properties
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
