interface NeedKeys {
  (o: Record<string, any>, k: string[]): void
}

const needKeys: NeedKeys = (obj, keys) => {
  const obj_keys = Object.keys(obj).join(' ');
  for (const key of keys) {
    if ('error' in obj) {
      throw new Error(obj.error);
    }
    if (!(key in obj)) {
      throw new Error(`${key} not in [${obj_keys}]`);
    }
  }
}

export {
  needKeys
}
