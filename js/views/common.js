// Piezas de NFL que comparten las pantallas: texto sobre el color de un equipo, horas y cuentas regresivas,
// el campito mini (lo que en El Play es el diamante de bases) y la vista del campo de cada jugada real.
import { yardLabel } from '../field.js';
import { roster } from '../nfl.js';
import { QUARTER } from '../game.js';

/** Texto que se lee sobre un color (inkOn de El Play) */
export const inkOn = (hex) => {
    const v = parseInt(String(hex).replace('#', '').slice(0, 6), 16);
    return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) > 160 ? '#14151a' : '#ffffff';
};
export const teamVars = (t) => `--c:${t.color};--on:${inkOn(t.color)}`;

export const timeOf = (d) => new Date(d).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
export const dayOf = (d) => {
    const s = new Date(d).toLocaleDateString('es', { weekday: 'short', day: 'numeric' }).replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
};
export const longDay = (d) => {
    const s = new Date(d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
};
/** «en 2 h 15 min» si falta poco (menos de 6 h) */
export const soon = (d, hours = 6) => {
    const ms = new Date(d) - Date.now();
    if (ms <= 0 || ms > hours * 3600e3) return '';
    const m = Math.round(ms / 60e3);
    return m < 60 ? `en ${m} min` : `en ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};
export const dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const qName = (q) => (q >= 5 ? 'Prórroga' : QUARTER[q] || '');
export const qShort = (q) => (q >= 5 ? 'OT' : `${q}º`);

/**
 * Campito mini: el ataque va a la derecha; zona de anotación del rival con su color, línea de golpeo azul,
 * línea de primera amarilla y el balón. `own` = yardas desde su propia línea de gol.
 */
export function miniField(att, def, own, toGo, w = 64, h = 22) {
    if (own == null || Number.isNaN(own)) return `<svg class="minifield" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><rect width="${w}" height="${h}" rx="4" fill="#2b7a3b"/></svg>`;
    const ez = w * 0.08;
    const X = (yd) => ez + ((w - 2 * ez) * Math.max(0, Math.min(100, yd))) / 100;
    const los = X(own);
    const fd = toGo != null && own + toGo < 100 ? X(own + toGo) : null;
    let lines = '';
    for (let i = 1; i < 10; i++) lines += `<path d="M${X(i * 10)} 2V${h - 2}" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/>`;
    return `<svg class="minifield" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><rect width="${w}" height="${h}" rx="4" fill="#2e7d3f"/><rect width="${ez}" height="${h}" rx="0" fill="${att.color}"/><rect x="${w - ez}" width="${ez}" height="${h}" fill="${def.color}"/>${lines}${fd ? `<path d="M${fd} 1V${h - 1}" stroke="#facc15" stroke-width="1.6"/>` : ''}<path d="M${los} 1V${h - 1}" stroke="#60a5fa" stroke-width="1.6"/><ellipse cx="${los}" cy="${h / 2}" rx="3.2" ry="2.1" fill="#8a4b22" stroke="#fff" stroke-width=".7"/></svg>`;
}

/** Yardas desde su propia línea de gol a partir de «KC 35» */
export const ownFrom = (text, abbr) => {
    const m = /([A-Z]{2,3}) (\d{1,2})/.exec(text || '');
    if (!m) return /50/.test(text || '') ? 50 : null;
    return m[1] === abbr ? Number(m[2]) : 100 - Number(m[2]);
};

const dirOf = (team, q) => ((team === 0) === (q % 2 === 1) ? 1 : -1);
/** Vista del campo de una jugada real (cambian de lado cada cuarto) y su especificación completa */
export function playView(rec, teams) {
    const dir = dirOf(rec.team, rec.q);
    const ytg = rec.spec?.ytg ?? rec.ytg ?? 75;
    const losX = dir > 0 ? 110 - ytg : 10 + ytg;
    const leftIdx = dirOf(0, rec.q) > 0 ? 0 : 1;
    const left = teams[leftIdx];
    const right = teams[1 - leftIdx];
    const withColor2 = (t) => ({ ...t, color2: t.color2 || mix(t.color, '#ffffff', 0.55) });
    return {
        spec: { offR: roster(), defR: roster(), ...rec.spec, ytg },
        view: { losX, dir, offTeam: withColor2(teams[rec.team]), defTeam: withColor2(teams[1 - rec.team]), firstX: rec.firstX != null ? losX + dir * rec.firstX : null, left, right, losLabel: yardLabel(losX, left, right) }
    };
}
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => `#${rgb(a).map((c, i) => Math.round(c + (rgb(b)[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;

/** Color de la etiqueta de cada jugada (como los de El Play: anotación dorada, pase azul, carrera verde, pérdida roja) */
export const tagColor = (r) =>
    r.pts ? 'var(--gold)' : r.flag ? '#ca8a04' : r.turnover || r.kind === 'sack' ? 'var(--strike, #dc2626)' : r.kind === 'pass' || r.kind === 'flea' || r.kind === 'hail' ? 'var(--inplay, #2563eb)' : r.kind === 'run' || r.kind === 'scramble' ? 'var(--ball, #16a34a)' : /punt|kickoff|fg|xp|onside/.test(r.kind || '') ? '#7c3aed' : 'var(--muted)';
