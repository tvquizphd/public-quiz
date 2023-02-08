# Public Quiz Device

- For users: [Setup and usage](#setup) and 🔑 [Security claims](#security-claims).
- Developers should read about [testing](#testing).

## Setup

Read this on [your new fork][FORK_THIS], set up [GitHub Pages](../../settings/pages) from "actions", and publish a [pre-release](../../releases/new).

<img width="700" alt="Set GitHub Pages from Actions and Publish Prerelease" src="https://user-images.githubusercontent.com/75504552/216326060-d31c0dab-0b16-4c4a-a8f6-9b21b4adcea3.png">

### Register

Refresh the [release](../../releases/latest) page, and follow the link when posted.

- Create GitHub App. and copy a key to the latest [release](../../releases/latest).
- Install the GitHub App on your fork. Then, choose your master password.

Keep your new "login link" and master password privately on each device.

## Security claims

During installation, your workflow makes public an [OPRF-derived][OPRF] key. You also reveal your own installation key. Afterwards, you and your workflows share encrypted messages using [a shared secret][PAKE]. Each login attempts a password-authenticated [key exchange][PAKE] by:

- Authenticating your password against [OPRF key][OPRF] known only to your workflow.
- Returning a temporary session [AES-GCM][GCM] key for authenticated encryption.

Afterwards, your passwords are always encrypted twice:

- With an [Argon2][Argon2] hash unkwnown to your workflows.
- With a single-session [shared secret][PAKE] with your workflows.

### Security limitations

To **update or delete** you passwords, 
- You need your master password
- **AND** your personal login link

**Immediately** reset your master password if you reveal your password AND your login link. 
**Don't give others write access to your fork**:

- ⚠️ Don't add [collaborators][HELP_COLLAB] to your fork
- ☠️ Don't let your GitHub account [be compromised][HELP_SECURE]

If they have write access to your fork, they can **erase** your data.

## Testing

### Remotely

When re-running installation workflow, first:

- Delete [your old app](https://github.com/settings/apps)
- Delete [the old environment](../../settings/environments)
- Create a new [pre-release](../../releases/new)
- Then navigate to your Pages site

### Locally

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

Run `pnpm dev`, then open `localhost:8000` in a browser.

To re-install the environment:
  - Delete [your old development app](https://github.com/settings/apps)
  - Exit (`ctrl-C`) `pnpm dev` and run `pnpm dev clean`

[HELP_COLLAB]: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-access-to-your-personal-repositories/inviting-collaborators-to-a-personal-repository
[HELP_SECURE]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure
[HELP_PROJECTS]: https://docs.github.com/en/issues/planning-and-tracking-with-projects
[HELP_PAGES]: https://pages.github.com/

[FORK_THIS]: https://github.com/tvquizphd/public-quiz-device/fork
[PAKE]: https://blog.cloudflare.com/opaque-oblivious-passwords/
[OPRF]: https://www.npmjs.com/package/oprf#security-guarantees
[Argon2]: https://github.com/p-h-c/phc-winner-argon2
[GCM]: https://www.aes-gcm.com/
