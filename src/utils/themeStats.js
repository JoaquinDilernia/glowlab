export function computeThemeStats(stores) {
  const byCode = new Map();
  let undetectedCount = 0;

  for (const store of stores) {
    const theme = store.detectedTheme;
    if (!theme || !theme.code) {
      undetectedCount++;
      continue;
    }
    const existing = byCode.get(theme.code);
    if (existing) {
      existing.count += 1;
    } else {
      byCode.set(theme.code, {
        code: theme.code,
        name: theme.name || theme.code,
        custom: !!theme.custom,
        count: 1,
      });
    }
  }

  const knownThemes = Array.from(byCode.values()).sort((a, b) => b.count - a.count);

  return { knownThemes, undetectedCount };
}
