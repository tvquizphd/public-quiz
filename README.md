## Setup

- Create `secret-tv-access` environment for GitHub actions to use.
- [Make an OAuth App](https://github.com/settings/developers). Write its `CLIENT_ID` in environment secrets.
- [Make a personal token](https://github.com/settings/tokens) with `repo` and `project` scope. Write as `MY_TOKEN` in environment secrets.

## Usage

- Star the repository to begin activation process.
- Click the link in the "Activate" project in [your private projects](https://github.com/tvquizphd?tab=projects).
- Then enter password and follow instructions to use the GitHub authentication code.

Now, the password manager can access [a connected application](https://github.com/settings/applications).

- Click the link in the "Login" project in [your private projects](https://github.com/tvquizphd?tab=projects).
- Then enter password to begin managing your services, usernames, and passwords.

Reuse the same login link whenever you return.

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
