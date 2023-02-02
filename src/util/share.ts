import type { Git } from "./types.js";
import { request } from "@octokit/request";

type ShareIn = {
  git: Git,
  body: string,
  release_id: number 
}
interface Share {
  (i: ShareIn): Promise<void>;
}

const vShare: Share = async ({ git, body, release_id }) => {
  const { repo, owner, owner_token } = git;
  const api_root = "https://api.github.com";
  const authorization = 'bearer ' + owner_token;
  const api_url = `${api_root}/repos/{owner}/{repo}/releases/{release_id}`;
  const make_latest = true;
  await request(`PATCH ${api_url}`, {
    owner, make_latest, repo, release_id, body,
    headers: { authorization }
  });
}

export { vShare };
