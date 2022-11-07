import { request } from "@octokit/request";
import _sodium from 'libsodium-wrappers';

const sodiumize = async (git, value) => {
  const { owner, repo, token } = git;
  const api_root = `/repos/${owner}/${repo}/actions`;
  const api_url = `${api_root}/secrets/public-key`;
  const authorization = `token ${git.token}`;
  const get_r = await request(`GET ${api_url}`, {
    headers: { authorization }
  });
  const { key, key_id } = get_r.data;
  const buff_key = Buffer.from(key, 'base64');
  const buff_in = Buffer.from(value);
  await _sodium.ready;
  const seal = _sodium.crypto_box_seal;
  const encryptedBytes = seal(buff_in, buff_key);
  const buff_out = Buffer.from(encryptedBytes);
  const ev = buff_out.toString('base64');
  return { key_id, ev };
}

const check = async (git, now, secret_name) => {
  const api_root = `/repos/${git.owner}/${git.repo}/actions`;
  const api_url = `${api_root}/secrets/${secret_name}`;
  const authorization = `token ${git.token}`;
  let out = {
    updated: 0
  };
  while (out.updated < now) {
    try {
      const o = await request(`GET ${api_url}`, {
        headers: { authorization }
      });
      out.updated = Date.parse(o.data.updated_at);
    }
    catch (e) {
      if (e?.status !== 404) throw e;
    }
  }
  return true;
}

const main = async (secret_text) => {
  const git = {
    owner: "tvquizphd",
    repo: "public-quiz-device",
    token: process.argv[2] || ""
  };
  const secret_name = 'TEMP_OUT';
  const now = (new Date()).getTime();
  const e_secret = await sodiumize(git, secret_text);
  const api_root = `/repos/${git.owner}/${git.repo}/actions`;
  const api_url = `${api_root}/secrets/${secret_name}`;
  const authorization = `token ${git.token}`;
  await request(`PUT ${api_url}`, {
    repo: git.repo,
    owner: git.owner,
    key_id: e_secret.key_id,
    encrypted_value: e_secret.ev,
    headers: { authorization }
  });
  await check(git, now, secret_name);
  await new Promise(r => setTimeout(r, 5000));
}

const text = "hello_world";
main(text).then(() => console.log('done'));
