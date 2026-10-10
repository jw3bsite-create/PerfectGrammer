// Einfache LCS-Vergleiche für Zeichen und Wörter.

export type DiffOp<T> = { op: 'gleich' | 'fehlt' | 'zuviel'; items: T[] };

/** Liefert für jedes Element von a den Index des zugeordneten Elements in b oder -1. */
export function lcsAlign<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): number[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = Länge der LCS von a[i..] und b[j..]
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const match = new Array<number>(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) {
      match[i] = j;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return match;
}

/**
 * Vergleicht eine Antwort mit der Lösung Zeichen für Zeichen.
 * „fehlt“: steht in der Lösung, nicht in der Antwort; „zuviel“: steht nur in der Antwort.
 */
export function charDiff(answer: string, solution: string): DiffOp<string>[] {
  const a = Array.from(answer);
  const s = Array.from(solution);
  const match = lcsAlign(s, a);
  const ops: DiffOp<string>[] = [];
  const push = (op: DiffOp<string>['op'], ch: string) => {
    const last = ops[ops.length - 1];
    if (last && last.op === op) last.items.push(ch);
    else ops.push({ op, items: [ch] });
  };
  let ai = 0;
  for (let si = 0; si < s.length; si++) {
    const mj = match[si];
    if (mj < 0) {
      push('fehlt', s[si]);
      continue;
    }
    while (ai < mj) push('zuviel', a[ai++]);
    push('gleich', s[si]);
    ai = mj + 1;
  }
  while (ai < a.length) push('zuviel', a[ai++]);
  return ops;
}

/** Levenshtein-Abstand, um die nächstliegende Lösung zu finden. */
export function editDistance(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  let prev = new Array(y.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length];
}

export function closest(answer: string, options: string[]): string {
  let best = options[0] ?? '';
  let bestD = Infinity;
  for (const o of options) {
    const d = editDistance(answer, o);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}
