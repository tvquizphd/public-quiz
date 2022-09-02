## Usage

- Click "Run Workflow" for [this GitHub Action](https://github.com/tvquizphd/public-quiz-device/actions/workflows/expect_user_code.yaml).
- Copy the code from [an issue in your secret repository](https://github.com/tvquizphd/secret-tv-device/issues).
- Enter the code in the [GitHub Device Auth Interface](https://github.com/login/device). Grant access.

You'll see your secret device in [your connected applications](https://github.com/settings/applications).

- Visit the link [in the issue in your secret repository](https://github.com/tvquizphd/secret-tv-device/issues).


## Local Testing

Install `pnpm` and `node 17`

```
wget -qO- https://get.pnpm.io/install.sh | sh -
pnpm env use --global 17
```

Replace values in `{{ }}` to run this:

```
pnpm run code {{ secret.CLIENT_ID }}
```
