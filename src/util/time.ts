const printSeconds = (secs: number): string => {
  const dt = 1000 * secs;
  const date = new Date(dt);
  const iso = date.toISOString();
  const mm_ss = iso.substring(14, 19);
  const m = parseInt(mm_ss.slice(0, 2));
  const s = parseInt(mm_ss.slice(3));
  return `PT${m}M${s}S`
}

export {
  printSeconds
}
