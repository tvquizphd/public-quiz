## Setup

- Create `secret-tv-access` environment for GitHub actions to use.
- Choose a secure `MASTER_PASS`. Write on paper and set in environment secrets.
- [Make an OAuth App](https://github.com/settings/developers). Write its `CLIENT_ID` in environment secrets.
- [Make a personal token](https://github.com/settings/tokens) with `repo` and `project` scope. Write as `MY_TOKEN` in environment secrets.

## Usage

- Star this repo (unstar first if needed).
- View the "Activate" project in [your private projects](https://github.com/tvquizphd?tab=projects).
- Then enter password and follow instructions to use the GitHub authentication code.

Your secret device is now [a connected application](https://github.com/settings/applications).

- View the "Login" project in [your private projects](https://github.com/tvquizphd?tab=projects).
- Then enter password and follow instructions to manage your passwords.

Reuse the login link whenever you return.

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
pnpm develop <MY_TOKEN> <CLIENT_ID> <MASTER_PASS>
```

Login at the login link, which should trigger:

```
pnpm develop <MY_TOKEN>
```

## Building for production 

Update the version in `package.json` and with a tag:

```
git tag v0.x.y
git push origin main --tags
```
On each pushed tag, the `build` workflow will:

- Create a pull request for compiled (`tsc`) packaged (`pkg`) linux executable
- Upload the `docs` directory to GitHub Pages.
