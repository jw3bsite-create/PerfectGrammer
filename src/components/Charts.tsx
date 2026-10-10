import { useLayoutEffect, useRef, useState } from 'react';
import { formatDay } from '../lib/dates';

export interface Point {
  key: string;
  label: string;
  value: number | null;
  detail?: string;
}

/**
 * Liniendiagramm mit einer Reihe: 2px-Linie, Punkte mit Ring, Fadenkreuz und Tooltip.
 * Jeder Punkt ist per Tastatur erreichbar und führt per Klick zu den Aufgaben.
 */
export function LineChart({
  points,
  max,
  format,
  onSelect,
  title,
}: {
  points: Point[];
  max?: number;
  format: (v: number) => string;
  onSelect?: (p: Point) => void;
  title: string;
}) {
  // In echten Pixeln zeichnen, damit Schrift und Linien auf jedem Bildschirm gleich groß bleiben.
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setW(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 200;
  const pad = { l: 44, r: 12, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const top = max ?? niceMax(Math.max(1, ...values));
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const [hover, setHover] = useState<number | null>(null);

  // Linie mit Lücken für Wochen ohne Daten
  const segs: string[] = [];
  let cur = '';
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segs.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (cur) segs.push(cur);

  const ticks = [0, top / 2, top];
  // Wochenbeschriftung nur so dicht, wie sie lesbar bleibt; die jüngste Woche ist immer beschriftet.
  const labelEvery = Math.max(1, Math.ceil((points.length * 52) / iw));
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          (points.length - 1 - i) % labelEvery === 0 ? (
            <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
        {segs.map((d, i) => (
          <path key={`a${i}`} d={`${d}`} className="series" />
        ))}
        {hp ? <line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={pad.t + ih} stroke="var(--border-strong)" strokeWidth={1} /> : null}
        <rect x={pad.l - 10} y={pad.t} width={iw + 20} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={() => hp && hp.value !== null && onSelect?.(hp)} style={{ cursor: onSelect ? 'pointer' : 'default' }} />
        {points.map((p, i) =>
          p.value === null ? null : (
            <circle
              key={p.key}
              className="dot"
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 6 : 4}
              tabIndex={0}
              role="button"
              aria-label={`${p.label}: ${format(p.value)}${p.detail ? `, ${p.detail}` : ''}`}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onPointerEnter={() => setHover(i)}
              onClick={() => onSelect?.(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(p);
                }
              }}
            />
          ),
        )}
      </svg>
      {hp ? (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: `${(x(hover!) / W) * 100}%`,
            top: 0,
            transform: `translateX(${hover! > points.length / 2 ? '-105%' : '5%'})`,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '8px 10px',
            boxShadow: 'var(--shadow)',
            pointerEvents: 'none',
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 650, fontSize: 15 }}>{hp.value === null ? 'keine Aufgaben' : format(hp.value)}</div>
          <div className="muted">Woche ab {formatDay(hp.key, true)}</div>
          {hp.detail ? <div className="muted">{hp.detail}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function niceMax(v: number): number {
  // Nur Werte mit ganzzahliger Hälfte, damit die mittlere Linie eine glatte Zahl trägt.
  const steps = [2, 4, 10, 20, 40, 50, 100, 200, 400, 500, 1000];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 1000) * 1000;
}
