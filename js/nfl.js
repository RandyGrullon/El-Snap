// NFL de verdad: los juegos de la semana y cada jugada con los datos públicos de ESPN (site.api.espn.com, sin clave).
// Aquí se traduce cada jugada de ESPN (tipo, yardas, yarda de inicio, down y el texto oficial en inglés) a una
// especificación del motor de jugadas, con los nombres reales de los jugadores y el texto en español.
import { FOULS, foulSpot } from './plays.js';

const API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/** Juegos de una semana (sin semana: la actual) */
export const getScoreboard = ({ week, seasontype } = {}) => {
    const q = new URLSearchParams();
    if (week) q.set('week', week);
    if (seasontype) q.set('seasontype', seasontype);
    return getJSON(`${API}/scoreboard${q.toString() ? `?${q}` : ''}`);
};
/** Todo de un juego: marcador, series con sus jugadas y probabilidad de ganar */
export const getSummary = (id) => getJSON(`${API}/summary?event=${id}`);

// ---------------------------------------------------------------- Equipos

const hex = (c, fb) => (c && /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : fb);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => `#${rgb(a).map((c, i) => Math.round(c + (rgb(b)[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
const far = (a, b) => Math.hypot(...rgb(a).map((c, i) => c - rgb(b)[i])) > 90;

/** Equipo de ESPN con lo que usa la app: nombre, abreviatura, colores y logo */
export function teamOf(t, fallback) {
    const color = hex(t.color, fallback);
    return {
        id: String(t.id),
        name: t.shortDisplayName || t.name || t.abbreviation,
        city: t.location || '',
        abbr: t.abbreviation,
        color,
        color2: mix(color, '#ffffff', 0.55),
        alt: hex(t.alternateColor, '#ffffff'),
        logo: t.logo || t.logos?.[0]?.href || ''
    };
}

/** Si los dos colores se parecen, el local usa su color alterno (o uno que contraste) */
function separate(away, home) {
    if (far(away.color, home.color)) return;
    const alt = far(home.alt, away.color) && far(home.alt, '#2b7a3b') ? home.alt : '#f8fafc';
    home.color = alt;
    home.color2 = mix(alt, '#ffffff', 0.4);
}

// ---------------------------------------------------------------- Texto oficial

const NAME = String.raw`([A-Z][\w'’.-]*\.\s?[A-Z][\w'’-]+(?:\s(?:Jr|Sr|II|III|IV)\.?)?)`;
const re = (s, f = '') => new RegExp(s, f);
const pick = (r, s) => r.exec(s)?.[1] || '';
const clean = (s = '') =>
    s
        .replace(/^\(\s*[\d:]+\s*\)\s*/, '')
        .replace(/\((?:Shotgun|No Huddle|Pistol|No Huddle, Shotgun|Run formation|Punt formation|Field Goal formation)\)\s*/gi, '')
        .trim();
/** El último nombre entre paréntesis (el que hizo la atrapada, el tackle o el sack) */
const lastParen = (s) => {
    const all = [...s.matchAll(/\(([^()]+)\)/g)].map((m) => m[1]).filter((x) => re(NAME).test(x) && !/kick|Center|Holder/i.test(x));
    return all.length ? pick(re(NAME), all[all.length - 1]) : '';
};
const forYards = (s) => {
    if (/for no gain/i.test(s)) return 0;
    const m = /for (-?\d+) yards?/i.exec(s);
    return m ? Number(m[1]) : null;
};
const SIDE = (s) => (/\bleft\b/i.test(s) ? -1 : /\bright\b/i.test(s) ? 1 : 0);

const FOUL_MAP = [
    [/false start/i, 'false_start'],
    [/offensive holding/i, 'holding'],
    [/offside|neutral zone|encroachment/i, 'offside'],
    [/delay of game/i, 'delay'],
    [/defensive pass interference/i, 'dpi'],
    [/roughing the passer/i, 'roughing'],
    [/face ?mask/i, 'facemask']
];
const FOUL_ES = [
    [/defensive holding/i, 'Holding defensivo'],
    [/illegal formation/i, 'Formación ilegal'],
    [/illegal shift/i, 'Movimiento ilegal'],
    [/illegal motion/i, 'Movimiento ilegal'],
    [/unnecessary roughness/i, 'Rudeza innecesaria'],
    [/unsportsmanlike/i, 'Conducta antideportiva'],
    [/intentional grounding/i, 'Pase intencional al suelo'],
    [/illegal block/i, 'Bloqueo ilegal'],
    [/illegal use of hands/i, 'Uso ilegal de las manos'],
    [/offensive pass interference/i, 'Interferencia ofensiva'],
    [/too many men/i, 'Demasiados jugadores en el campo'],
    [/illegal contact/i, 'Contacto ilegal'],
    [/tripping/i, 'Zancadilla'],
    [/horse collar/i, 'Tackle por el cuello (horse collar)'],
    [/taunting/i, 'Provocación'],
    [/ineligible/i, 'Jugador inelegible adelante'],
    [/illegal forward pass/i, 'Pase adelante ilegal'],
    [/roughing the kicker|running into the kicker/i, 'Golpear al pateador'],
    [/clipping/i, 'Bloqueo por detrás'],
    [/disqualification/i, 'Expulsión']
];

const RESULT_ES = {
    Touchdown: 'Touchdown',
    'Field Goal': 'Gol de campo',
    FG: 'Gol de campo',
    Punt: 'Despeje',
    Fumble: 'Balón suelto',
    Interception: 'Intercepción',
    INT: 'Intercepción',
    Downs: 'Cuarta fallida',
    'Missed FG': 'Gol de campo fallado',
    'Blocked FG': 'Patada bloqueada',
    'Blocked Punt': 'Despeje bloqueado',
    Safety: 'Safety',
    'End of Half': 'Fin de la mitad',
    'End of Game': 'Fin del juego',
    'End of 4th Quarter': 'Fin del juego'
};
export const resultEs = (r) => RESULT_ES[r] || r || '';
export const driveEs = (d = '') =>
    d
        .replace(/(\d+) plays?/i, (_, n) => `${n} ${n === '1' ? 'jugada' : 'jugadas'}`)
        .replace(/(-?\d+) yards?/i, (_, n) => `${n} yd`)
        .replace(/, /g, ' · ');

const POS_NAMES = { qb: 'el QB', rb: 'el corredor', x: 'el receptor', z: 'el receptor', sl: 'el receptor', te: 'el ala cerrada', k: 'el pateador', p: 'el despejador', de: 'el ala defensiva', dt: 'el tackle defensivo', lb: 'el linebacker', cb: 'el esquinero', nb: 'el esquinero', fs: 'el safety', ss: 'el safety', ret: 'el regresador' };
const NUMS = { qb: 12, rb: 28, x: 11, z: 13, sl: 17, te: 87, k: 3, p: 8, de: 94, dt: 99, lb: 54, cb: 24, nb: 31, fs: 32, ss: 29, ret: 84 };
/** Plantilla con los nombres que trae la jugada (los demás por su posición) */
export const roster = (names = {}) => Object.fromEntries(Object.keys(NUMS).map((k) => [k, { num: NUMS[k], n: names[k] || POS_NAMES[k] }]));
const allDef = (n) => (n ? { de: n, dt: n, lb: n, cb: n, nb: n, fs: n, ss: n } : {});

const ord = (d) => `${d}ª`;
const gainEs = (g) => (g > 0 ? `gana ${g} ${g === 1 ? 'yarda' : 'yardas'}` : g < 0 ? `pierde ${-g} ${g === -1 ? 'yarda' : 'yardas'}` : 'sin ganancia');
const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 11);

// ---------------------------------------------------------------- De ESPN al motor

/**
 * Traduce el resumen de un juego: equipos (0 = visitante, 1 = local), estado, jugadas listas para animar
 * (con marcador antes y después) y series.
 */
export function mapGame(s) {
    const comp = s.header?.competitions?.[0] || {};
    const cs = comp.competitors || [];
    const awayC = cs.find((c) => c.homeAway === 'away') || cs[0];
    const homeC = cs.find((c) => c.homeAway === 'home') || cs[1];
    const box = Object.fromEntries((s.boxscore?.teams || []).map((t) => [String(t.team.id), t.team]));
    const away = teamOf({ ...awayC.team, ...(box[awayC.team.id] || {}) }, '#1e4fd8');
    const home = teamOf({ ...homeC.team, ...(box[homeC.team.id] || {}) }, '#e11d48');
    separate(away, home);
    const teams = [away, home];
    const byId = { [away.id]: 0, [home.id]: 1 };
    const byAbbr = { [away.abbr]: 0, [home.abbr]: 1 };
    const st = comp.status?.type || {};
    const status = { state: st.state || 'pre', detail: st.shortDetail || st.detail || '', clock: comp.status?.displayClock || '', period: comp.status?.period || 0, date: comp.date };
    const score = [Number(awayC.score || 0), Number(homeC.score || 0)];
    const wpBy = {};
    for (const w of s.winprobability || []) wpBy[w.playId] = 1 - w.homeWinPercentage - (w.tiePercentage || 0) / 2;

    const prevDrives = s.drives?.previous || [];
    const cur = s.drives?.current;
    const drives = cur && !prevDrives.some((d) => d.id === cur.id) ? [...prevDrives, cur] : prevDrives;
    const recs = [];
    const driveInfo = [];
    let last = [0, 0];
    let wp = 0.5;
    let lastYtg = 75;
    drives.forEach((d, di) => {
        const dTeam = byAbbr[d.team?.abbreviation] ?? byId[String(d.team?.id)] ?? null;
        driveInfo.push({ team: dTeam ?? 0, desc: driveEs(d.description), result: resultEs(d.displayResult || d.result), live: d === cur && status.state === 'in' });
        for (const p of d.plays || []) {
            const after = [Number(p.awayScore ?? last[0]), Number(p.homeScore ?? last[1])];
            if (wpBy[p.id] != null) wp = wpBy[p.id];
            const made = mapPlay(p, { teams, byId, byAbbr, dTeam, before: last, after, drive: di });
            for (const r of made) {
                r.wp = wp;
                if (r.ytg == null) r.ytg = lastYtg;
                else if (!/xp|2pt|kickoff|onside/.test(r.kind || '')) lastYtg = r.ytg;
                recs.push(r);
            }
            last = after;
        }
    });
    return { teams, status, score, recs: splitPats(recs), drives: driveInfo, hasWp: Object.keys(wpBy).length > 0 };
}

function mapPlay(p, G) {
    const type = (p.type?.text || '').toLowerCase();
    const raw = (p.text || '').trim();
    const text = clean(raw);
    const q = p.period?.number || 1;
    const clock = p.clock?.displayValue || '';
    const s0 = p.start || {};
    const s1 = p.end || {};
    const td = /touchdown/.test(type) || /TOUCHDOWN/.test(raw);
    const scored = [G.after[0] - G.before[0], G.after[1] - G.before[1]];
    const scorer = scored[0] > 0 ? 0 : scored[1] > 0 ? 1 : -1;
    const base = { id: p.id, q, clock, raw, drive: G.drive, before: { score: G.before }, after: { score: G.after } };

    // Separadores y situaciones sin jugada
    if (/end (of )?(period|quarter|half|game|regulation)|end quarter|coin toss|end of/i.test(type) || /^END (QUARTER|GAME|OF)/i.test(text)) {
        return [{ ...base, sep: true, label: /game|regulation/i.test(type + text) ? 'Final del juego' : /half/i.test(type + text) ? 'Medio tiempo' : `Fin del ${q}º cuarto`, team: G.dTeam ?? 0 }];
    }
    if (/two.?minute/i.test(type + text)) return [{ ...base, team: G.dTeam ?? 0, kind: 'timeout', label: 'Aviso de 2 minutos', es: 'Aviso de 2 minutos: el reloj se detiene', spec: { kind: 'timeout', variant: 'twomin' } }];
    if (/timeout/i.test(type)) {
        const who = /by ([A-Z]{2,3})/i.exec(text)?.[1];
        const ti = G.byAbbr[who?.toUpperCase()];
        const team = G.teams[ti];
        return [{ ...base, team: ti ?? G.dTeam ?? 0, kind: 'timeout', label: 'Tiempo fuera', es: team ? `Tiempo fuera de ${team.name}` : 'Tiempo fuera', spec: { kind: 'timeout', sub: team ? `Lo pide ${team.name}` : 'Tiempo fuera oficial' } }];
    }

    // Quién ataca y desde dónde
    let off = G.dTeam ?? G.byId[String(s0.team?.id)] ?? 0;
    const kickFrom = /kicks.*?from ([A-Z]{2,3}) (\d+)/i.exec(text);
    if (/kickoff/.test(type) && kickFrom && G.byAbbr[kickFrom[1]] != null) off = G.byAbbr[kickFrom[1]];
    const offAbbr = G.teams[off].abbr;
    let ytg = s0.yardsToEndzone;
    if (ytg == null || ytg <= 0 || ytg >= 100) {
        const m = /([A-Z]{2,3}) (\d{1,2})/.exec(s0.possessionText || s0.downDistanceText || '');
        ytg = m ? (m[1] === offAbbr ? 100 - Number(m[2]) : Number(m[2])) : 65;
    }
    if (kickFrom) ytg = kickFrom[1] === offAbbr ? 100 - Number(kickFrom[2]) : Number(kickFrom[2]);
    ytg = Math.min(99, Math.max(1, ytg));
    const down = s0.down || 0;
    const dist = s0.distance || 10;
    const gain = p.statYardage ?? forYards(text) ?? 0;
    const spotU = (abbr, n) => (abbr === offAbbr ? Number(n) : 100 - Number(n)) - (100 - ytg);
    const first = s1.down === 1 && !td && down > 0 && gain >= dist;
    const downs = down === 4 && gain < dist && !td;
    const seed = hash(p.id || text);
    const r = { ...base, team: off, ytg, downText: down ? `${ord(down)} y ${dist >= ytg ? 'gol' : dist}` : null, spot: s0.possessionText || '', firstX: down && dist < ytg ? dist : null };
    const pts = scorer >= 0 ? { team: scorer, n: scored[scorer], abbr: G.teams[scorer].abbr } : null;
    const out = (spec, label, es, extra = {}) => [{ ...r, spec: { seed, ytg, offR: roster(), defR: roster(), ...spec }, kind: spec.kind, label, es, pts, yards: extra.yards ?? null, first: !!spec.first, turnover: !!extra.turnover, flag: !!spec.penalty, ...extra }];

    // Nombres
    const passer = pick(re(NAME + String.raw`\s+(?:pass|sacked|scrambles|spiked|kneels)`), text);
    const target = pick(re(String.raw`(?:pass(?: incomplete)?(?: short| deep)?(?: left| middle| right)? to|intended for)\s+` + NAME), text);
    const rusher = pick(re(NAME + String.raw`\s+(?:up the middle|left|right|scrambles|kneels|rushed|to\s|for\s)`), text);
    const stopper = lastParen(text);

    // Faltas
    if (/penalty/.test(type) || (/PENALTY on/i.test(text) && /No Play/i.test(text))) {
        const m = /PENALTY on ([A-Z]{2,3})-?[^,]*,\s*([^,]+?),\s*(\d+) yards?/i.exec(text);
        if (/declined|offsetting/i.test(text) || !m) return [{ ...r, label: 'Pañuelo', es: /offsetting/i.test(text) ? 'Faltas compensadas: se repite el intento' : 'Falta declinada', spec: { seed, ytg, kind: 'presnap', penalty: { code: 'other', name: 'Faltas compensadas', team: 'off', yards: 0, when: 'pre' } }, kind: 'presnap', flag: true, pts: null }];
        const foulName = m[2].trim();
        const yards = Number(m[3]);
        const team = m[1] === offAbbr ? 'off' : 'def';
        const code = FOUL_MAP.find(([x]) => x.test(foulName))?.[1] || 'other';
        const nameEs = code !== 'other' ? FOULS[code].name : FOUL_ES.find(([x]) => x.test(foulName))?.[1] || foulName;
        const endYtg = s1.yardsToEndzone;
        const to = endYtg != null && (s1.team?.id == null || G.byId[String(s1.team.id)] === off) ? ytg - endYtg : team === 'off' ? -yards : yards;
        const noPlay = /No Play/i.test(text);
        const action = text.split(/PENALTY/i)[0];
        const pen = { code, name: nameEs, team, yards, to, when: 'during' };
        let spec;
        if (code === 'false_start' || code === 'offside' || code === 'delay' || (noPlay && !/ pass | sacked | left | right | up the middle/i.test(action))) spec = { kind: 'presnap', penalty: { ...pen, when: 'pre' } };
        else if (/sacked/i.test(action)) spec = { kind: 'sack', gain: Math.min(-1, forYards(action) ?? -5), penalty: pen };
        else if (/ pass /i.test(action)) spec = /incomplete/i.test(action) ? { kind: 'pass', variant: /deep/i.test(action) ? 'deep' : 'medium', result: 'incomplete', catchU: code === 'dpi' ? Math.max(3, Math.min(to, ytg + 4)) : undefined, penalty: pen, offR: roster({ qb: passer, x: target }), target: 'X', route: /deep/i.test(action) ? 'go' : 'out' } : { kind: 'pass', variant: 'short', gain: Math.max(1, Math.min(forYards(action) ?? 5, ytg - 1)), penalty: pen, offR: roster({ qb: passer, x: target }), target: 'X', route: 'out' };
        else spec = { kind: 'run', variant: /end/i.test(action) ? 'outside' : 'inside', side: SIDE(action) || undefined, gain: Math.max(-2, Math.min(forYards(action) ?? 3, ytg - 1)), penalty: pen, offR: roster({ rb: rusher }) };
        if (!noPlay && spec.kind !== 'presnap') spec.penalty.enforce = 'end';
        const who = G.teams[team === 'off' ? off : 1 - off];
        return out({ defR: roster(allDef(stopper)), offR: roster({ qb: passer, rb: rusher }), ...spec }, 'Pañuelo', `Pañuelo: ${nameEs.toLowerCase()} contra ${who.name} (${yards} yardas)`, { yards: to });
    }

    // Patadas
    if (/kickoff/.test(type)) {
        const kicker = pick(re(NAME + String.raw`\s+kicks`), text);
        const ret = pick(re(String.raw`\.\s+` + NAME + String.raw`\s+(?:to|pushed|ran|for|MUFFS)`), text) || pick(re(String.raw`(?:fair catch by|Touchback)\s*` + NAME), text);
        const offR = roster({ k: kicker });
        const defR = roster({ ret, ...allDef(stopper) });
        if (/onside/i.test(text)) {
            const recBy = /RECOVERED by ([A-Z]{2,3})/i.exec(text)?.[1];
            const own = recBy ? recBy === offAbbr : false;
            return out({ kind: 'onside', recover: own ? 'off' : 'def', offR, defR }, 'Patada corta', `Patada corta (onside): ${own ? `¡la recupera ${G.teams[off].name}!` : `la asegura ${G.teams[1 - off].name}`}`);
        }
        const kicked = Number(/kicks (\d+) yards?/i.exec(text)?.[1] || 65);
        const tb = /touchback/i.test(text);
        const land = tb ? Math.max(kicked, ytg + 2) : kicked;
        const retY = forYards(text.split(/kicks/i)[1] || '') ?? Math.max(0, gain);
        return out({ kind: 'kickoff', land: Math.min(land, ytg + 8), ret: Math.max(0, retY), touchback: tb, result: td ? 'td' : '', offR, defR }, 'Patada inicial', tb ? `${kicker || 'El pateador'} patea a la zona de anotación: touchback` : td ? `¡${ret || 'El regresador'} devuelve la patada hasta la zona de anotación!` : `Patada de ${kicker || 'inicio'}; ${ret || 'el regresador'} la regresa ${Math.max(0, retY)} yardas`, { yards: null });
    }
    if (/punt/.test(type)) {
        const punter = pick(re(NAME + String.raw`\s+punts`), text);
        const ret = pick(re(String.raw`(?:fair catch by\s+|\.\s+)` + NAME), text);
        const landY = Number(/punts (\d+) yards?/i.exec(text)?.[1] || 45);
        const tb = /touchback/i.test(text);
        const fair = /fair catch/i.test(text);
        const retY = fair || tb ? 0 : Math.max(0, forYards(text.split(/punts/i)[1] || '') ?? 0);
        if (/blocked/i.test(type + text)) return out({ kind: 'fg', result: 'blocked', offR: roster({ k: punter, p: punter }), defR: roster(allDef(stopper)) }, 'Despeje bloqueado', `¡Bloquean el despeje de ${punter || 'su pateador'}!`, { turnover: true });
        return out({ kind: 'punt', land: Math.min(landY, ytg + 6), ret: retY, fair, touchback: tb, offR: roster({ p: punter }), defR: roster({ ret, ...allDef(stopper) }) }, 'Despeje', tb ? `Despeje de ${landY} yardas de ${punter}: touchback` : fair ? `Despeje de ${landY} yardas de ${punter}; ${ret || 'el regresador'} pide fair catch` : `Despeje de ${landY} yardas de ${punter}; lo regresan ${retY} yardas`);
    }
    if (/field goal/.test(type)) {
        const kicker = pick(re(NAME + String.raw`\s+\d+\s+yard field goal`), text);
        const yds = /(\d+) yard field goal/i.exec(text)?.[1];
        const blocked = /blocked/i.test(type + text);
        const good = !blocked && /good/i.test(type + text) && !/no good|missed/i.test(type + text);
        const miss = /left/i.test(text) ? 'left' : 'right';
        return out({ kind: 'fg', result: blocked ? 'blocked' : good ? 'good' : 'miss', miss, offR: roster({ k: kicker }), defR: roster(allDef(stopper)) }, 'Gol de campo', blocked ? `¡Bloquean el gol de campo${yds ? ` de ${yds} yardas` : ''}!` : good ? `Gol de campo${yds ? ` de ${yds} yardas` : ''} de ${kicker}: ¡es bueno!` : `${kicker || 'El pateador'} falla el gol de campo${yds ? ` de ${yds} yardas` : ''}`, { turnover: !good });
    }
    if (/extra point/.test(type)) {
        const kicker = pick(re(NAME + String.raw`\s+extra point`), text);
        const good = !/no good|missed|blocked/i.test(type + text);
        return out({ kind: 'xp', ytg: 15, result: good ? 'good' : 'miss', miss: 'right', offR: roster({ k: kicker }) }, 'Punto extra', `Punto extra de ${kicker || 'su pateador'}: ${good ? 'bueno' : 'fallado'}`, { ytg: 15, firstX: null, downText: null });
    }
    if (/two.?point|2pt/.test(type)) {
        const ok = !/fail/i.test(text) && (scorer >= 0 || /succeeds/i.test(text));
        const viaPass = / pass /i.test(text);
        return out(viaPass ? { kind: '2pt', ytg: 2, sub: 'pass', variant: 'short', result: ok ? 'td' : 'incomplete', offR: roster({ qb: passer, te: target }), target: 'TE', route: 'out' } : { kind: '2pt', ytg: 2, sub: 'run', variant: 'inside', result: ok ? 'td' : '', gain: ok ? 2 : 1, offR: roster({ rb: rusher }) }, 'Conversión de 2', `Conversión de 2 ${viaPass ? 'por pase' : 'por tierra'}: ${ok ? '¡buena!' : 'falla'}`, { ytg: 2, firstX: null, downText: null });
    }

    // Jugadas desde la línea
    const defR = roster(allDef(stopper));
    if (/sack/.test(type) || / sacked /i.test(text)) {
        const safety = /safety/i.test(type + text);
        return out({ kind: 'sack', gain: Math.min(-1, gain), result: safety ? 'safety' : '', offR: roster({ qb: passer }), defR }, safety ? 'Safety' : 'Sack', safety ? `¡Safety! Capturan a ${passer} en su propia zona` : `Sack: ${stopper || 'la defensa'} captura a ${passer || 'el QB'}, ${gainEs(gain)}`, { yards: gain });
    }
    if (/interception/.test(type) || /INTERCEPTED/i.test(text)) {
        const by = pick(re(String.raw`INTERCEPTED by ` + NAME), text);
        const at = /INTERCEPTED by .*? at ([A-Z]{2,3}) (\d+)/i.exec(text);
        const catchU = at ? Math.min(spotU(at[1], at[2]), ytg + 8) : 12;
        const ret = Math.max(0, forYards(text.split(/INTERCEPTED/i)[1] || '') ?? 0);
        const variant = /deep/i.test(text) ? 'deep' : catchU > 10 ? 'medium' : 'short';
        const dir = SIDE(text);
        const tgt = dir < 0 ? ['X', variant === 'deep' ? 'go' : 'out'] : dir > 0 ? ['Z', variant === 'deep' ? 'go' : 'out'] : ['SL', 'slant'];
        return out({ kind: 'pass', variant, result: 'int', catchU: Math.max(2, catchU), ret, pick6: td, target: tgt[0], route: tgt[1], offR: roster({ qb: passer, [tgt[0].toLowerCase()]: target }), defR: roster(allDef(by)) }, td ? 'Pick-six' : 'Intercepción', td ? `¡Pick-six! ${by} intercepta a ${passer} y anota` : `¡Intercepción! ${by} se roba el pase de ${passer} y lo regresa ${ret} yardas`, { turnover: true });
    }
    if (/fumble/.test(type) || /FUMBLES/i.test(text)) {
        const recBy = /RECOVERED by ([A-Z]{2,3})/i.exec(text)?.[1];
        const lost = /opponent/.test(type) || (!!recBy && recBy !== offAbbr);
        const who = pick(re(NAME + String.raw`\s+FUMBLES`), text) || rusher || passer;
        if (!lost) return out({ kind: 'run', variant: 'inside', gain: Math.max(-3, Math.min(gain, ytg - 1)), offR: roster({ rb: who }), defR }, 'Balón suelto', `${who} suelta el balón pero lo recupera su equipo: ${gainEs(gain)}`, { yards: gain });
        const g = Math.max(1, Math.min(forYards(text) ?? 3, ytg - 2));
        return out({ kind: 'run', variant: 'inside', gain: g, fumble: true, scoop: td, offR: roster({ rb: who }), defR }, 'Balón suelto', td ? `¡${who} pierde el balón y la defensa anota!` : `¡Balón suelto! ${who} lo pierde y lo recupera la defensa`, { turnover: true });
    }
    if (/kneel/i.test(text)) return out({ kind: 'kneel', gain: Math.min(-1, gain), offR: roster({ qb: rusher || passer }) }, 'Rodilla', `${rusher || passer || 'El QB'} se arrodilla para gastar el reloj`, { yards: gain });
    if (/spiked/i.test(text)) return out({ kind: 'spike', gain: 0, offR: roster({ qb: passer }) }, 'Spike', `${passer || 'El QB'} clava el balón para parar el reloj`, { yards: 0 });
    if (/pass/.test(type) || / pass /i.test(text)) {
        const deep = /deep/i.test(text);
        const dir = SIDE(text.split(/ to |intended/i)[0]);
        const incomplete = /incompletion|incomplete/i.test(type + text);
        const variant = incomplete ? (deep ? 'deep' : 'medium') : gain >= 20 || (deep && gain >= 12) ? 'deep' : gain >= 9 ? 'medium' : gain < 0 ? 'screen' : 'short';
        const routeBy = { deep: dir < 0 ? ['X', 'go'] : dir > 0 ? ['Z', 'corner'] : ['Z', 'post'], medium: dir < 0 ? ['X', 'out'] : dir > 0 ? ['Z', 'out'] : ['Z', 'dig'], short: dir < 0 ? ['SL', 'slant'] : dir > 0 ? ['TE', 'out'] : ['SL', 'slant'] };
        const [tid, route] = variant === 'screen' ? ['RB', 'screen'] : routeBy[variant];
        const offR = roster({ qb: passer, [tid.toLowerCase()]: target });
        if (incomplete) return out({ kind: 'pass', variant, result: 'incomplete', target: tid, route, offR, defR, downs }, 'Incompleto', `Pase incompleto de ${passer}${target ? ` hacia ${target}` : ''}`, { yards: 0, turnover: downs });
        return out({ kind: 'pass', variant, gain: Math.min(gain, ytg), result: td ? 'td' : '', first, downs, target: tid, route, offR, defR }, td ? 'TD por aire' : 'Pase', td ? `¡Touchdown! Pase de ${gain} yardas de ${passer} a ${target}` : `Pase ${deep ? 'profundo ' : ''}de ${passer} a ${target}: ${gainEs(gain)}`, { yards: gain, turnover: downs });
    }
    if (/rush/.test(type) || rusher) {
        if (/scrambles/i.test(text)) return out({ kind: 'scramble', gain: Math.min(gain, ytg), slide: /slid/i.test(text), result: td ? 'td' : '', first, downs, offR: roster({ qb: rusher }), defR }, td ? 'TD por tierra' : 'Scramble', td ? `¡${rusher} sale corriendo y anota!` : `${rusher} sale corriendo: ${gainEs(gain)}`, { yards: gain, turnover: downs });
        const outside = /\bend\b/i.test(text);
        const where = /up the middle/i.test(text) ? 'por el medio' : `por la ${SIDE(text) < 0 ? 'izquierda' : 'derecha'}`;
        const sneak = dist <= 1 && gain <= 2 && /up the middle/i.test(text) && rusher && rusher === passer;
        return out({ kind: 'run', variant: sneak ? 'sneak' : outside ? 'outside' : 'inside', side: SIDE(text) || undefined, gain: Math.min(gain, ytg), result: td ? 'td' : '', first, downs, offR: roster({ rb: rusher, qb: sneak ? rusher : '' }), defR }, td ? 'TD por tierra' : 'Carrera', td ? `¡Touchdown! ${rusher} corre ${gain} yardas ${where}` : `${rusher} corre ${where}: ${gainEs(gain)}`, { yards: gain, turnover: downs });
    }
    // Lo que no se sabe animar queda en la lista con el texto oficial
    return [{ ...r, label: p.type?.text || 'Jugada', es: text, pts }];
}

/** Separa el punto extra (o la conversión) que ESPN mete dentro del texto del touchdown */
export function splitPats(recs) {
    const out = [];
    recs.forEach((r, i) => {
        const next = recs[i + 1];
        const hasPat = r.spec && r.pts && r.pts.n >= 7 && !(next && /xp|2pt/.test(next.spec?.kind || ''));
        if (!hasPat) return out.push(r);
        const extra = r.pts.n - 6;
        const tdScore = [...r.after.score];
        tdScore[r.pts.team] -= extra;
        const two = /TWO-POINT/i.test(r.raw);
        const kicker = pick(re(String.raw`\(` + NAME + String.raw`\s+kick\)`), r.raw) || pick(re(NAME + String.raw`\s+extra point`), r.raw);
        const scoringTeam = r.pts.team;
        out.push({ ...r, pts: { ...r.pts, n: 6 }, after: { score: tdScore } });
        out.push({
            ...r,
            id: `${r.id}-pat`,
            team: scoringTeam,
            ytg: two ? 2 : 15,
            downText: null,
            firstX: null,
            spot: '',
            yards: null,
            first: false,
            turnover: false,
            flag: false,
            kind: two ? '2pt' : 'xp',
            label: two ? 'Conversión de 2' : 'Punto extra',
            es: two ? `Conversión de 2: ${extra === 2 ? '¡buena!' : 'falla'}` : `Punto extra${kicker ? ` de ${kicker}` : ''}: ${extra >= 1 ? 'bueno' : 'fallado'}`,
            before: { score: tdScore },
            pts: extra > 0 ? { ...r.pts, n: extra } : null,
            spec: two ? { kind: '2pt', ytg: 2, sub: 'run', variant: 'inside', result: extra === 2 ? 'td' : '', gain: extra === 2 ? 2 : 1, seed: hash(`${r.id}p`) } : { kind: 'xp', ytg: 15, result: 'good', seed: hash(`${r.id}p`), offR: roster({ k: kicker }) }
        });
    });
    out.forEach((r, i) => (r.n = i));
    return out;
}
