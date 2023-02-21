# Public Quiz

Your own password service, run for free, by you, on GitHub.

### [Setup and usage ⏩](#setup)

Developers can [test locally or remotely](#testing) and should evaluate [security claims](#security-claims).

## Setup

Read this on [your new fork][FORK_THIS], and [enable GitHub Actions](../../actions).

![enable actions](https://user-images.githubusercontent.com/75504552/219168117-532b555a-c1ea-4745-92fc-a4ffbf4ada8a.png)

Then, set up [GitHub Pages](../../settings/pages) from "actions" and set your ["github-pages" environment](../../settings/environments) to run on any branch or tag.

![ok2](https://user-images.githubusercontent.com/75504552/219478867-95cbae17-8888-4348-9fbe-dec7a85e6726.png)


Finally, publish a [pre-release](../../releases/new) (any tag name you create is fine).

![ok1](https://user-images.githubusercontent.com/75504552/219478759-32a4a252-ab3b-4530-bc6a-e561bf933d64.png)


### Register

Refresh the [latest release](../../releases/latest) until you see a link. In 8 clicks, you'll have a GitHub App on your fork and an updated [release](../../releases/latest). Choose a master password, and you'd have a new login link. Keep your login link and master password privately on each device.

### Configure

The service runs from `UTC 12:03` until `UTC 2:13`. To change this, clone your fork and run `pnpm timer`.

## Security claims

During installation, you and your workflow exchange [OPRF][OPRF] keys. Then, you and your workflows share encrypted messages using [a shared secret][PAKE]. To yield that secret, a login workflow runs a [key exchange][PAKE] with its own [pepper][OPRF] and the salt in your login link. Then, you have a one-off session key for [authenticated][GCM] encryption.

Afterwards, your passwords are always encrypted both with an [Argon2][Argon2] hash unknown to your workflows and with your [shared secret][PAKE] for each login session.

### Security limitations

To **update or delete** you passwords, 
- You need your master password
- **AND** your personal login link

Reset your master password if you reveal it as well as your login link. Don't give others write access to your fork: ⚠️ Don't add [collaborators][HELP_COLLAB] to your fork; ☠️ Don't let your GitHub account [be compromised][HELP_SECURE].

If they have write access to your fork, they can **erase** your data.

## Testing

### Remotely

When re-running installation workflow, first:

- Delete [your old app](https://github.com/settings/apps)
- Create a new [pre-release](../../releases/new)
- Remove [PRODUCTION-LOGIN](../../settings/environments)
- Then navigate to your Pages site

### Locally

- In [environment.csv](./client/environment.csv), set `REMOTE` to `your_username/public-quiz`.
- Open a terminal, and clone your forked repository:

```properties
YOU=your_username
REPO_URL=$YOU/public-quiz
git clone git@github.com:$REPO_URL.git
cd public-quiz
```

Install `pnpm`, `node 18`, and dependencies:

```properties
wget -qO- https://get.pnpm.io/install.sh | sh -
pnpm env use --global 18
pnpm install -g node-gyp
CXX=gcc pnpm install
```

#### Automated Testing

Run `pnpm test:config` to cache your GitHub username and password.
Then run `pnpm test` to run all client-side tests.
Run `pnpm test:ideas` to start making new tests.

#### Manual Testing

Run `pnpm dev clean`, then open `localhost:8000` in a browser. To clean up after manual tests, delete [your old development app](https://github.com/settings/apps) and remove `.env`. Ensure `pnpm dev clean` or `pnpm dev` is running to resume testing. To update expired local installation tokens, run `bash develop.bash UPDATE`.

[HELP_COLLAB]: https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-access-to-your-personal-repositories/inviting-collaborators-to-a-personal-repository
[HELP_SECURE]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure
[HELP_PROJECTS]: https://docs.github.com/en/issues/planning-and-tracking-with-projects
[HELP_PAGES]: https://pages.github.com/

[FORK_THIS]: https://github.com/tvquizphd/public-quiz/fork
[PAKE]: https://blog.cloudflare.com/opaque-oblivious-passwords/
[OPRF]: https://www.npmjs.com/package/oprf#security-guarantees
[Argon2]: https://github.com/p-h-c/phc-winner-argon2
[GCM]: https://www.aes-gcm.com/
