// Datos de la NFL para El Snap: juegos, el juego completo, posiciones, líderes y jugadores, de los datos públicos
// de ESPN (sin clave). Todo pasa por get(), que guarda en memoria un rato y se rinde a los 12 s.

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const V2 = 'https://site.api.espn.com/apis/v2/sports/football/nfl';
const WEB = 'https://site.web.api.espn.com/apis';

const cache = new Map();
/** JSON con caché en memoria (ttl en s) y límite de 12 s */
export async function get(url, ttl = 30) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < ttl * 1000) return hit.data;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cache.set(url, { at: Date.now(), data });
        return data;
    } finally {
        clearTimeout(timer);
    }
}
/** El primero de varios que responda (para datos que ESPN publica en más de un lugar) */
async function first(urls, ttl) {
    let err;
    for (const u of urls) {
        try {
            return await get(u, ttl);
        } catch (e) {
            err = e;
        }
    }
    throw err;
}

// ---------------------------------------------------------------- Los 32 equipos (respaldo si ESPN no trae colores)

export const DIVISIONS = {
    'AFC Este': ['BUF', 'MIA', 'NE', 'NYJ'],
    'AFC Norte': ['BAL', 'CIN', 'CLE', 'PIT'],
    'AFC Sur': ['HOU', 'IND', 'JAX', 'TEN'],
    'AFC Oeste': ['DEN', 'KC', 'LV', 'LAC'],
    'NFC Este': ['DAL', 'NYG', 'PHI', 'WSH'],
    'NFC Norte': ['CHI', 'DET', 'GB', 'MIN'],
    'NFC Sur': ['ATL', 'CAR', 'NO', 'TB'],
    'NFC Oeste': ['ARI', 'LAR', 'SF', 'SEA']
};
const COLORS = { ARI: '97233f', ATL: 'a71930', BAL: '241773', BUF: '00338d', CAR: '0085ca', CHI: '0b162a', CIN: 'fb4f14', CLE: '472a08', DAL: '002a5c', DEN: 'fb4f14', DET: '0076b6', GB: '203731', HOU: '03202f', IND: '002c5f', JAX: '006778', KC: 'e31837', LV: '000000', LAC: '0080c6', LAR: '003594', MIA: '008e97', MIN: '4f2683', NE: '002244', NO: 'b39b6b', NYG: '0b2265', NYJ: '125740', PHI: '004c54', PIT: '000000', SF: 'aa0000', SEA: '002244', TB: 'd50a0a', TEN: '0c2340', WSH: '5a1414' };
export const divisionOf = (abbr) => Object.keys(DIVISIONS).find((d) => DIVISIONS[d].includes(abbr)) || '';
export const logoOf = (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${String(abbr).toLowerCase()}.png`;
export const headshot = (id) => `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;

const hex = (c, abbr) => `#${/^[0-9a-f]{6}$/i.test(c || '') ? c : COLORS[abbr] || '64748b'}`;
/** Equipo de ESPN con lo que usa la app */
export function team(t = {}, extra = {}) {
    const abbr = t.abbreviation || '';
    return {
        id: String(t.id ?? ''),
        abbr,
        name: t.shortDisplayName || t.name || abbr,
        full: t.displayName || t.name || abbr,
        city: t.location || '',
        color: hex(t.color, abbr),
        alt: hex(t.alternateColor, abbr),
        logo: t.logo || t.logos?.[0]?.href || (abbr ? logoOf(abbr) : ''),
        ...extra
    };
}

// ---------------------------------------------------------------- Textos de estado en español

export const statusEs = (s = '') =>
    s
        .replace(/\b(\d)(st|nd|rd|th)\b/gi, '$1º')
        .replace(/^End of (\dº)/i, 'Fin del $1')
        .replace(/Halftime/i, 'Medio tiempo')
        .replace(/Final\/OT/i, 'Final (prórroga)')
        .replace(/Delayed/i, 'Retrasado')
        .replace(/Postponed/i, 'Pospuesto')
        .replace(/Canceled/i, 'Cancelado')
        .replace(/ - /, ' · ');
const POS_ES = { QB: 'Quarterback', RB: 'Corredor', FB: 'Fullback', WR: 'Receptor', TE: 'Ala cerrada', OT: 'Tackle ofensivo', G: 'Guardia', C: 'Centro', DE: 'Ala defensiva', DT: 'Tackle defensivo', LB: 'Linebacker', CB: 'Esquinero', S: 'Safety', K: 'Pateador', P: 'Despejador', LS: 'Snapper largo' };
export const posEs = (abbr, fallback) => POS_ES[abbr] || fallback || abbr || '';

// ---------------------------------------------------------------- Juegos (marcador de la semana)

export const scoreboard = ({ week, seasontype, dates } = {}) => {
    const q = new URLSearchParams();
    if (week) q.set('week', week);
    if (seasontype) q.set('seasontype', seasontype);
    if (dates) q.set('dates', dates);
    return get(`${SITE}/scoreboard${q.toString() ? `?${q}` : ''}`, 20);
};

/** Un juego del marcador listo para su tarjeta */
export function eventCard(e) {
    const comp = e.competitions?.[0] || {};
    const cs = comp.competitors || [];
    const side = (h) => {
        const c = cs.find((x) => x.homeAway === h) || {};
        return team(c.team, { score: c.score ?? '', record: c.records?.[0]?.summary || c.record?.[0]?.summary || '', winner: !!c.winner, home: h === 'home' });
    };
    const st = e.status?.type || comp.status?.type || {};
    const sit = comp.situation || null;
    const leaders = (comp.leaders || [])
        .map((l) => ({ cat: l.name, label: { passingYards: 'Pase', rushingYards: 'Carrera', receivingYards: 'Recepción' }[l.name] || l.shortDisplayName, who: l.leaders?.[0]?.athlete?.shortName || l.leaders?.[0]?.athlete?.displayName || '', value: l.leaders?.[0]?.displayValue || '', id: l.leaders?.[0]?.athlete?.id }))
        .filter((l) => l.who);
    return {
        id: String(e.id),
        date: e.date || comp.date,
        state: st.state || 'pre',
        detail: statusEs(st.shortDetail || st.detail || ''),
        period: e.status?.period || comp.status?.period || 0,
        clock: e.status?.displayClock || '',
        teams: [side('away'), side('home')],
        tv: comp.broadcasts?.flatMap((b) => b.names || [])[0] || comp.geoBroadcasts?.[0]?.media?.shortName || '',
        venue: comp.venue?.fullName || '',
        odds: comp.odds?.[0]?.details || '',
        ou: comp.odds?.[0]?.overUnder ?? null,
        note: comp.notes?.[0]?.headline || '',
        leaders,
        situation: sit && {
            down: sit.down,
            distance: sit.distance,
            text: sit.down > 0 ? `${sit.down}ª y ${sit.yardsToEndzone != null && sit.yardsToEndzone <= sit.distance ? 'gol' : sit.distance}` : '',
            spot: sit.possessionText || '',
            possession: String(sit.possession ?? ''),
            redZone: !!sit.isRedZone,
            lastPlay: sit.lastPlay?.text || ''
        }
    };
}

// ---------------------------------------------------------------- Un juego completo

export const summary = (id, live) => get(`${SITE}/summary?event=${id}`, live ? 12 : 60);

/** Lo que muestra la pantalla del juego además de las jugadas (eso lo traduce nfl.js) */
export function gameExtras(s) {
    const comp = s.header?.competitions?.[0] || {};
    const cs = comp.competitors || [];
    const byHA = (h) => cs.find((c) => c.homeAway === h) || {};
    const lines = ['away', 'home'].map((h) => (byHA(h).linescores || []).map((l) => Number(l.value ?? l.displayValue ?? 0)));
    const info = s.gameInfo || {};
    const boxTeams = s.boxscore?.teams || [];
    const statRows = [];
    if (boxTeams.length === 2) {
        const [a, b] = ['away', 'home'].map((h) => boxTeams.find((t) => String(t.team?.id) === String(byHA(h).team?.id)) || boxTeams[h === 'away' ? 0 : 1]);
        for (const st of a.statistics || []) {
            const o = (b.statistics || []).find((x) => x.name === st.name);
            statRows.push({ name: st.name, label: STAT_ES[st.name] || st.label, a: st.displayValue, b: o?.displayValue ?? '' });
        }
    }
    // Índice de los jugadores del juego: por «P.Mahomes» (como salen en el texto de cada jugada) y por apellido
    const athletes = {};
    const byLast = {};
    const addAthlete = (a, team) => {
        if (!a || !(a.displayName || a.shortName)) return;
        const name = a.displayName || a.shortName;
        const info = { id: a.id, name, jersey: a.jersey || a.displayJersey || '', pos: a.position?.abbreviation || '', team, headshot: a.headshot?.href || (a.id ? headshot(a.id) : '') };
        const parts = name.split(' ');
        const last = parts.slice(1).join(' ') || name;
        for (const k of [shortKey(name), shortKey(a.shortName || ''), name]) if (k) athletes[k] = { ...athletes[k], ...info, jersey: info.jersey || athletes[k]?.jersey || '' };
        (byLast[last] ||= []).push(info);
    };
    const players = (s.boxscore?.players || []).map((p) => ({
        team: String(p.team?.id ?? ''),
        cats: (p.statistics || []).map((c) => ({
            name: c.name,
            label: CAT_ES[c.name] || c.text || c.name,
            labels: c.labels || [],
            rows: (c.athletes || []).map((a) => {
                addAthlete(a.athlete, String(p.team?.id ?? ''));
                return { id: a.athlete?.id, name: a.athlete?.displayName || '', short: a.athlete?.shortName || a.athlete?.displayName || '', jersey: a.athlete?.jersey || '', headshot: a.athlete?.headshot?.href || (a.athlete?.id ? headshot(a.athlete.id) : ''), stats: a.stats || [] };
            }),
            totals: c.totals || []
        }))
    }));
    for (const t of s.leaders || []) for (const c of t.leaders || []) for (const l of c.leaders || []) addAthlete(l.athlete, String(t.team?.id ?? ''));
    for (const r of s.rosters || []) for (const g of r.roster || r.entries || []) addAthlete(g.athlete || g, String(r.team?.id ?? ''));
    /** Busca a un jugador por cómo sale en la jugada («P.Mahomes», «A.St. Brown», «Ja.Chase») */
    const find = (n) => {
        if (!n) return null;
        if (athletes[n]) return athletes[n];
        const last = n.includes('.') ? n.slice(n.indexOf('.') + 1).trim() : n;
        const list = byLast[last];
        return list && list.length === 1 ? list[0] : list?.find((x) => x.name[0] === n[0]) || null;
    };
    const scoring = (s.scoringPlays || []).map((p) => ({ q: p.period?.number, clock: p.clock?.displayValue, team: p.team?.abbreviation, text: p.text, type: p.scoringType?.displayName || p.type?.text, away: p.awayScore, home: p.homeScore }));
    const leaders = (s.leaders || []).map((t) => ({
        team: String(t.team?.id ?? ''),
        cats: (t.leaders || []).map((c) => ({ name: c.name, label: LEAD_ES[c.name] || c.displayName, who: c.leaders?.[0]?.athlete?.displayName || '', id: c.leaders?.[0]?.athlete?.id, value: c.leaders?.[0]?.displayValue || '', headshot: c.leaders?.[0]?.athlete?.headshot?.href }))
    }));
    const officials = (info.officials || []).map((o) => ({ name: o.displayName || o.fullName, role: OFFICIAL_ES[o.position?.displayName] || o.position?.displayName || '' }));
    const odds = s.pickcenter?.[0] || s.odds?.[0] || null;
    const predictor = s.predictor ? { away: Number(s.predictor.awayTeam?.gameProjection ?? NaN), home: Number(s.predictor.homeTeam?.gameProjection ?? NaN) } : null;
    const injuries = (s.injuries || []).map((t) => ({ team: String(t.team?.id ?? ''), list: (t.injuries || []).slice(0, 8).map((i) => ({ name: i.athlete?.displayName || '', pos: i.athlete?.position?.abbreviation || '', status: INJ_ES[i.status] || i.status || '' })) }));
    // Situación de ahora: cómo quedó la última jugada de la serie en curso
    const lastPlay = s.drives?.current?.plays?.[s.drives.current.plays.length - 1];
    const end = lastPlay?.end || null;
    const sit = end && end.down ? { down: end.down, distance: end.distance, ytg: end.yardsToEndzone, spot: end.possessionText || '', team: String(end.team?.id ?? '') } : null;
    const recBy = (h, type) => (byHA(h).record || byHA(h).records || []).find((r) => r.type === type)?.summary || '';
    return {
        find,
        sit,
        recordsBy: ['away', 'home'].map((h) => ({ total: recBy(h, 'total'), home: recBy(h, 'home'), road: recBy(h, 'road') || recBy(h, 'away') })),
        date: comp.date,
        lines,
        statRows,
        players,
        scoring,
        leaders,
        venue: info.venue ? { name: info.venue.fullName, city: [info.venue.address?.city, info.venue.address?.state].filter(Boolean).join(', '), grass: info.venue.grass } : null,
        attendance: info.attendance || null,
        weather: info.weather ? { temp: info.weather.temperature ?? info.weather.highTemperature, text: info.weather.displayValue || info.weather.conditionId || '' } : null,
        officials,
        tv: comp.broadcasts?.[0]?.media?.shortName || comp.broadcasts?.[0]?.type?.shortName || '',
        odds: odds ? { details: odds.details, ou: odds.overUnder, provider: odds.provider?.name } : null,
        predictor: predictor && Number.isFinite(predictor.away) ? predictor : null,
        injuries,
        records: ['away', 'home'].map((h) => byHA(h).record?.[0]?.summary || byHA(h).records?.[0]?.summary || '')
    };
}

/** «Patrick Mahomes» → «P.Mahomes» (como ESPN escribe los nombres en cada jugada) */
const shortKey = (n) => {
    const s = String(n || '').trim();
    if (!s) return '';
    if (/^[A-Z][\w'’]*\.\s?\S/.test(s)) return s.replace(/\.\s+/, '.');
    const [first, ...rest] = s.split(' ');
    return rest.length ? `${first[0]}.${rest.join(' ')}` : s;
};

const STAT_ES = {
    firstDowns: 'Primeros downs',
    thirdDownEff: 'Tercera oportunidad',
    fourthDownEff: 'Cuarta oportunidad',
    totalOffensivePlays: 'Jugadas',
    totalYards: 'Yardas totales',
    yardsPerPlay: 'Yardas por jugada',
    totalDrives: 'Series',
    netPassingYards: 'Yardas por pase',
    completionAttempts: 'Completos-intentos',
    yardsPerPass: 'Yardas por pase (prom.)',
    interceptions: 'Intercepciones lanzadas',
    sacksYardsLost: 'Sacks recibidos (yardas)',
    rushingYards: 'Yardas por tierra',
    rushingAttempts: 'Acarreos',
    yardsPerRushAttempt: 'Yardas por acarreo',
    redZoneAttempts: 'Zona roja (TD-intentos)',
    totalPenaltiesYards: 'Pañuelos (yardas)',
    turnovers: 'Pérdidas de balón',
    fumblesLost: 'Balones sueltos perdidos',
    defensiveTouchdowns: 'TD de la defensa',
    possessionTime: 'Tiempo de posesión'
};
const CAT_ES = { passing: 'Pase', rushing: 'Carrera', receiving: 'Recepción', fumbles: 'Balones sueltos', defensive: 'Defensa', interceptions: 'Intercepciones', kickReturns: 'Retornos de patada', puntReturns: 'Retornos de despeje', kicking: 'Patadas', punting: 'Despejes' };
const LEAD_ES = { passingYards: 'Pase', rushingYards: 'Carrera', receivingYards: 'Recepción', passingLeader: 'Pase', rushingLeader: 'Carrera', receivingLeader: 'Recepción', sacks: 'Sacks', totalTackles: 'Tackles', interceptions: 'Intercepciones' };
const OFFICIAL_ES = { Referee: 'Árbitro principal', Umpire: 'Umpire', 'Down Judge': 'Juez de línea', 'Line Judge': 'Juez de línea', 'Field Judge': 'Juez de campo', 'Side Judge': 'Juez lateral', 'Back Judge': 'Juez de fondo', 'Replay Official': 'Repetición' };
const INJ_ES = { Out: 'Fuera', Questionable: 'Dudoso', Doubtful: 'Muy dudoso', 'Injured Reserve': 'Lista de lesionados', Probable: 'Probable', Active: 'Activo' };

// ---------------------------------------------------------------- Posiciones

const statVal = (stats, name) => stats.find((s) => s.name === name || s.type === name);

/** Posiciones por conferencia y división (los 32 equipos) */
export async function standings() {
    const data = await get(`${V2}/standings`, 300);
    const rows = [];
    const walk = (node, conf) => {
        const c = node.abbreviation && /^(AFC|NFC)$/.test(node.abbreviation) ? node.abbreviation : conf;
        for (const en of node.standings?.entries || []) {
            const st = en.stats || [];
            const v = (n) => statVal(st, n);
            const t = team(en.team);
            rows.push({
                ...t,
                conf: c || (divisionOf(t.abbr).startsWith('AFC') ? 'AFC' : 'NFC'),
                division: divisionOf(t.abbr),
                w: Number(v('wins')?.value ?? 0),
                l: Number(v('losses')?.value ?? 0),
                t: Number(v('ties')?.value ?? 0),
                pct: v('winPercent')?.displayValue || '',
                pf: Number(v('pointsFor')?.value ?? 0),
                pa: Number(v('pointsAgainst')?.value ?? 0),
                diff: Number(v('differential')?.value ?? v('pointDifferential')?.value ?? 0),
                streak: v('streak')?.displayValue || '',
                seed: Number(v('playoffSeed')?.value ?? 0) || null,
                gb: v('gamesBehind')?.displayValue || '',
                home: v('Home')?.displayValue || v('home')?.summary || '',
                away: v('Road')?.displayValue || v('road')?.summary || '',
                div: v('vs. Div.')?.displayValue || v('divisionRecord')?.displayValue || '',
                clincher: en.note?.description || v('clincher')?.displayValue || ''
            });
        }
        for (const ch of node.children || []) walk(ch, c);
    };
    walk(data);
    const sorted = (list) => list.sort((a, b) => b.w + b.t / 2 - (a.w + a.t / 2) - (b.l - a.l) * 0.001 || b.diff - a.diff);
    const divisions = Object.keys(DIVISIONS).map((d) => ({ name: d, teams: sorted(rows.filter((r) => r.division === d)) }));
    const conf = (c) => rows.filter((r) => r.conf === c).sort((a, b) => (a.seed || 99) - (b.seed || 99) || b.w - a.w);
    return { season: data.seasons?.[0]?.year || data.season?.year || '', divisions, afc: conf('AFC'), nfc: conf('NFC'), all: rows };
}

// ---------------------------------------------------------------- Líderes de la temporada

const LEADER_ES = { passingYards: 'Yardas por pase', rushingYards: 'Yardas por tierra', receivingYards: 'Yardas por recepción', passingTouchdowns: 'TD por pase', rushingTouchdowns: 'TD por tierra', receivingTouchdowns: 'TD por recepción', receptions: 'Recepciones', sacks: 'Sacks', interceptions: 'Intercepciones', totalTackles: 'Tackles', QBRating: 'Rating del QB', quarterbackRating: 'Rating del QB', totalPoints: 'Puntos', kickReturnYards: 'Yardas de retorno' };

/** Líderes por categoría: [{ name, label, leaders: [{ id, name, team, value, headshot }] }] */
export async function leaders() {
    const data = await first([`${WEB}/site/v3/sports/football/nfl/leaders`, `${SITE}/leaders`], 600);
    const cats = data.leaders?.categories || data.categories || data.leaders || [];
    return cats
        .map((c) => ({
            name: c.name,
            label: LEADER_ES[c.name] || c.displayName || c.name,
            leaders: (c.leaders || []).slice(0, 10).map((l) => {
                const a = l.athlete || {};
                const tm = l.team || a.team || {};
                return { id: a.id, name: a.displayName || a.fullName || '', short: a.shortName || a.displayName || '', pos: a.position?.abbreviation || '', team: tm.abbreviation || '', teamColor: hex(tm.color, tm.abbreviation), value: l.displayValue ?? l.value ?? '', headshot: a.headshot?.href || (a.id ? headshot(a.id) : '') };
            })
        }))
        .filter((c) => c.leaders.length);
}

// ---------------------------------------------------------------- Jugador

/** Ficha: datos, resumen de la temporada y últimos juegos */
export async function athlete(id) {
    const [bio, over, log] = await Promise.allSettled([get(`${WEB}/common/v3/sports/football/nfl/athletes/${id}`, 600), get(`${WEB}/common/v3/sports/football/nfl/athletes/${id}/overview`, 600), get(`${WEB}/common/v3/sports/football/nfl/athletes/${id}/gamelog`, 600)]);
    if (bio.status !== 'fulfilled') throw bio.reason;
    const a = bio.value.athlete || bio.value;
    const t = a.team ? team(a.team) : null;
    const ov = over.status === 'fulfilled' ? over.value : {};
    const summaryStats = (a.statsSummary?.statistics || []).map((s) => ({ label: s.shortDisplayName || s.displayName, value: s.displayValue, rank: s.rankDisplayValue || '' }));
    const season = ov.statistics ? { labels: ov.statistics.displayNames || ov.statistics.labels || [], splits: (ov.statistics.splits || []).map((sp) => ({ name: sp.displayName, stats: sp.stats || [] })) } : null;
    let games = [];
    if (log.status === 'fulfilled') {
        const lg = log.value;
        const evs = lg.events || {};
        const labels = lg.labels || lg.displayNames || [];
        const regular = (lg.seasonTypes || [])[0];
        const statsBy = {};
        for (const cat of regular?.categories || []) for (const ev of cat.events || []) statsBy[ev.eventId] = ev.stats || [];
        games = Object.entries(evs)
            .map(([eid, e]) => ({ id: eid, date: e.gameDate, week: e.week, opp: e.opponent?.abbreviation || '', oppLogo: e.opponent?.logo || '', atVs: e.atVs || '', result: e.gameResult || '', score: e.score || '', stats: statsBy[eid] || [] }))
            .sort((x, y) => new Date(y.date) - new Date(x.date))
            .slice(0, 8);
        games.labels = labels;
    }
    return {
        id: String(a.id ?? id),
        name: a.displayName || a.fullName || '',
        first: a.firstName || '',
        last: a.lastName || '',
        jersey: a.jersey || a.displayJersey || '',
        pos: a.position?.abbreviation || '',
        posName: posEs(a.position?.abbreviation, a.position?.displayName),
        team: t,
        headshot: a.headshot?.href || headshot(a.id ?? id),
        height: a.displayHeight || '',
        weight: a.displayWeight || '',
        age: a.age || '',
        born: [a.birthPlace?.city, a.birthPlace?.state, a.birthPlace?.country].filter(Boolean).join(', '),
        college: a.college?.name || a.college?.shortName || '',
        exp: a.displayExperience || (a.experience?.years != null ? `${a.experience.years} años` : ''),
        status: a.status?.type || a.status?.name || '',
        summaryStats,
        season,
        games,
        news: (ov.news || []).slice(0, 3).map((n) => ({ title: n.headline, url: n.links?.web?.href || '' }))
    };
}
