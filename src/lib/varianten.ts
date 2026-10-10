import data from '../content/varianten.json';

interface Rule {
  re: RegExp;
  to: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const RULES: Rule[] = [];
for (const gruppe of data.gruppen as string[][]) {
  const [canon, ...others] = gruppe;
  for (const o of others) {
    RULES.push({ re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(o)}(?![\\p{L}\\p{N}])`, 'gu'), to: canon });
    if (upperFirst(o) !== o) {
      RULES.push({ re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(upperFirst(o))}(?![\\p{L}\\p{N}])`, 'gu'), to: upperFirst(canon) });
    }
  }
}

/** Ersetzt gleichwertige Schreibungen durch die erste Form ihrer Gruppe. */
export function canonicalVariants(s: string): string {
  let out = s;
  for (const r of RULES) out = out.replace(r.re, r.to);
  return out;
}

export const VARIANTEN_GRUPPEN: string[][] = data.gruppen as string[][];
