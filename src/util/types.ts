export type Five = [string, string, string, string, string];
export type Quad = [string, string, string, string];
export type Trio = [string, string, string];
export type Duo = [string, string];

export type Git = {
  repo: string,
  owner: string,
  owner_token: string
};

function isFive(args: string[]): args is Five {
  return args.length === 5;
}

function isQuad(args: string[]): args is Quad {
  return args.length === 4;
} 

function isTrio(args: string[]): args is Trio {
  return args.length === 3;
} 

function isDuo(args: string[]): args is Duo {
  return args.length === 2;
}

export { isQuad, isTrio, isDuo, isFive };
