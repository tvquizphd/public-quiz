## Setup

- Create `secret-tv-access` environment for GitHub actions to use.
- Choose a secure `MASTER_PASSWORD`. Write on paper and set in environment secrets.
- [Make an OAuth App](https://github.com/settings/developers). Write its `CLIENT_ID` in environment secrets.
- [Make a personal token](https://github.com/settings/tokens) with `repo` and `project` scope. Write as `MY_TOKEN` in environment secrets.

## Usage

- Click "Run Workflow" for [this GitHub Action](https://github.com/tvquizphd/public-quiz-device/actions/workflows/expect_user_code.yaml).
- Copy the URL in the workflow logs, then enter password and use the authentication code as directed.

Your secret device is now [a connected application](https://github.com/settings/applications).

- Login via [your new private project](https://github.com/tvquizphd?tab=projects).

## Local Testing

Install `pnpm` and `node 18`

```
wget -qO- https://get.pnpm.io/install.sh | sh -
pnpm env use --global 18
```

Install dependencies

```
pnpm gyp
CXX=gcc pnpm install
```

Replace values in `{{ }}` to run the following commands:

Make a secret login link with two-step verification:

```
pnpm run activate {{MY_TOKEN}} {{CLIENT_ID}} {{MASTER_PASS}}
```

Login at the login link, which automatically triggers:
```
pnpm run login {{MY_TOKEN}}
```
