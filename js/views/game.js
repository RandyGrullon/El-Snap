// El juego: la pantalla de juego de El Play para la NFL. Marcador partido con los colores de cada equipo y,
// según el estado, la previa, el en vivo (el campo anima cada jugada y sigue el juego solo) o el final (la historia
// de «la jugada del juego», marcador por cuartos, así va el juego, anotaciones y series). Las hojas «Jugadas» y
// «Box score» son las de El Play; tocar cualquier jugada la anima en el campo.
import { $, $$, esc, I, badge, settings, toggleIn, toast, share, openSheet, PlayerView, wpChart } from '../ui.js';
import { Stage } from '../field.js';
import { buildPlay } from '../plays.js';
import { summary, gameExtras } from '../espn.js';
import { mapGame } from '../nfl.js';
import { teamVars, inkOn, timeOf, dayOf, longDay, soon, qName, qShort, miniField, ownFrom, playView, tagColor } from './common.js';

const NAME = /([A-Z][\w'’]*\.\s?[A-Z][\w'’-]+)/;
/** El protagonista de una jugada: en los pases, el que atrapa; en lo demás, el primero que se nombra */
const whoOf = (r) => {
    const all = (r.es || '').match(new RegExp(NAME.source, 'g')) || [];
    return (/pass|flea|hail/.test(r.kind || '') && !r.turnover ? all[all.length - 1] : all[0]) || '';
};
const BX_ES = { 'C/ATT': 'C/INT', YDS: 'YD', AVG: 'PROM', TD: 'TD', INT: 'INT', SACKS: 'SACKS', QBR: 'QBR', RTG: 'RTG', CAR: 'ACA', LONG: 'LARGA', REC: 'REC', TGTS: 'OBJ', TOT: 'TOT', SOLO: 'SOLO', TFL: 'TFL', PD: 'PD', 'QB HTS': 'GOLPES', FG: 'FG', PCT: 'PCT', XP: 'XP', PTS: 'PTS', NO: 'NO', TB: 'TB', 'In 20': 'DENTRO 20', FUM: 'BS', LOST: 'PERD', SACK: 'SACK', 'YDS/G': 'YD/J' };

export function gameView(el, { id, play: focusPlay }) {
    let alive = true;
    let timer = 0;
    let G = null;
    let X = null;
    let gc = null; // reproductor del en vivo
    let gcIdx = -1;
    let follow = true;
    let follTimer = 0;
    let storyIdx = 0;
    let storyStage = null;
    let storyTimer = 0;
    let flow = 'wp';
    let dmFilter = 'all';
    let plSide = -1;
    let updatedAt = Date.now();
    const ago = setInterval(() => {
        const u = $('.upd', el);
        if (u) u.textContent = `Actualizado hace ${Math.max(0, Math.round((Date.now() - updatedAt) / 1000))} s`;
    }, 1000);

    el.innerHTML = `<div class="screen game"><div class="hero"><div class="hh" style="--c:var(--raised)"></div><div class="hh home" style="--c:var(--raised)"></div><button class="hbtn l" aria-label="Atrás">${I.back}</button></div><div class="gbody"><div class="skel-card"></div><div class="skel-card"></div></div></div>`;
    const back = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
    $('.hbtn.l', el).onclick = back;

    async function load(first) {
        clearTimeout(timer);
        try {
            const s = await summary(id, G?.status.state === 'in');
            if (!alive) return;
            const prev = G;
            G = mapGame(s);
            X = gameExtras(s);
            const changed = !prev || prev.status.state !== G.status.state;
            if (first || changed) renderAll();
            else update(prev.recs.length);
            updatedAt = Date.now();
            if (G.status.state === 'in') timer = setTimeout(() => load(false), 10000);
            else if (G.status.state === 'pre') timer = setTimeout(() => load(false), 60000);
        } catch {
            if (!alive || G) return;
            $('.gbody', el).innerHTML = `<div class="sec empty-card">${I.info}<b>No se pudo cargar el juego</b><p class="muted">Revisa tu conexión. En algunas redes de trabajo o escuela los datos deportivos están bloqueados.</p><button class="pill2 sm on retry">Reintentar</button></div>`;
            $('.retry', el).onclick = () => load(true);
        }
    }

    const playable = () => G.recs.filter((r) => r.spec);
    /** Jugada lista para el motor, con los números reales de los que salen en ella */
    const specFor = (r) => {
        const pv = playView(r, G.teams);
        const names = [...Object.values(pv.spec.offR || {}), ...Object.values(pv.spec.defR || {})].map((x) => x?.n).filter(Boolean);
        pv.spec.jerseys = Object.fromEntries(names.map((n) => [n, X.find(n)?.jersey]).filter(([, j]) => j));
        return pv;
    };
    /** La jugada armada para el campo; si algo de ESPN viene raro, null (se muestra solo el texto) */
    const built = (r) => {
        try {
            const { spec, view } = specFor(r);
            return { play: buildPlay(spec), view };
        } catch {
            return null;
        }
    };
    /** Fotos y papel de los que participan en la jugada («En la jugada») */
    const whoHtml = (r) =>
        (r.who || []).length
            ? `<div class="inplay">${r.who
                  .map(([role, n]) => {
                      const a = X.find(n);
                      return `<span class="ipc"><img src="${esc(a?.headshot || '')}" alt="" onerror="this.style.visibility='hidden'"><span><small>${esc(role)}</small><b>${esc(a?.name || n)}</b>${a?.jersey ? `<em>#${esc(a.jersey)}${a.pos ? ` · ${esc(a.pos)}` : ''}</em>` : ''}</span></span>`;
                  })
                  .join('')}</div>`
            : '';
    // Las que cuentan para «la jugada del juego» y «las que más pesaron» (una rodilla al final no es la jugada del juego)
    const weighty = (r) => !/kneel|spike|timeout|xp|presnap/.test(r.kind || '');
    const lastPlayable = () => {
        for (let i = G.recs.length - 1; i >= 0; i--) if (G.recs[i].spec) return i;
        return -1;
    };
    const winner = () => (G.score[0] === G.score[1] ? -1 : G.score[0] > G.score[1] ? 0 : 1);
    const possIdx = () => {
        const t = X.sit?.team;
        if (t) return G.teams.findIndex((x) => x.id === t);
        const i = lastPlayable();
        return i >= 0 ? G.recs[i].team : -1;
    };

    // ------------------------------------------------------------ Marcador partido (GameHero)

    function hero() {
        const st = G.status.state;
        const [a, h] = G.teams;
        const w = st === 'post' ? winner() : -1;
        const poss = st === 'in' ? possIdx() : -1;
        const half = (i, t) => {
            const fav = settings.favs.includes(t.abbr);
            const ball = poss === i && !/medio|half/i.test(G.status.detail) ? `<span class="possb">${I.ball}</span>` : '';
            return `<div class="hh ${i ? 'home' : ''} ${w >= 0 && w !== i ? 'lose' : ''}" style="${teamVars(t)}"><button class="nm ${fav ? 'fav' : ''}" data-fav="${esc(t.abbr)}" aria-label="Equipo favorito: ${esc(t.name)}">${i ? '' : ball}<span>${esc(t.name)}</span>${fav ? I.starFill : I.star}${i ? ball : ''}</button>${st === 'pre' ? `<div class="ab">${esc(t.abbr)}</div>` : `<div class="sc">${G.score[i]}</div>`}<div class="rec">${esc(X.records[i] || '')}</div></div>`;
        };
        const halftime = /medio tiempo|half/i.test(G.status.detail);
        const status =
            st === 'in'
                ? `<span class="live"><i class="pulse"></i>${halftime ? 'Medio tiempo' : `En vivo${X.sit ? ` · ${X.sit.down}ª y ${X.sit.ytg != null && X.sit.ytg <= X.sit.distance ? 'gol' : X.sit.distance}` : ''}`}</span>`
                : st === 'post'
                  ? `<span>${/OT|prórroga/i.test(G.status.detail) ? 'Final (prórroga)' : 'Final'}</span>`
                  : `<span>${esc(dayOf(X.date || G.status.date))} · ${esc(timeOf(X.date || G.status.date))}${soon(X.date || G.status.date) ? ` · ${soon(X.date || G.status.date)}` : ''}</span>`;
        const q = G.status.period || 0;
        const qbadge = st === 'in' ? `<div class="qbadge"><i>${halftime ? '' : '▲'}</i><b>${halftime ? 'MT' : q >= 5 ? 'OT' : q}</b><small>${halftime ? 'Medio' : q >= 5 ? 'Prórroga' : 'Cuarto'}</small></div>` : '';
        return `${half(0, a)}${half(1, h)}<button class="hbtn l" aria-label="Atrás">${I.back}</button><div class="hstatus">${status}</div><button class="hbtn r share-g" aria-label="Compartir">${I.share}</button>${qbadge}`;
    }

    function renderHero() {
        const hEl = $('.hero', el);
        hEl.innerHTML = hero();
        $('.hbtn.l', hEl).onclick = back;
    }

    // ------------------------------------------------------------ Secciones

    function lineScore(compact) {
        const n = Math.max(4, X.lines[0].length, X.lines[1].length);
        const st = G.status.state;
        const cur = st === 'in' ? (G.status.period || 1) - 1 : -1;
        const w = st === 'post' ? winner() : -1;
        const lead = G.score[0] === G.score[1] ? -1 : G.score[0] > G.score[1] ? 0 : 1;
        const head = `<tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${i >= 4 ? (i === 4 ? 'OT' : `OT${i - 3}`) : i + 1}</th>`).join('')}<th>T</th></tr>`;
        const rows = G.teams
            .map((t, k) => {
                const cells = Array.from({ length: n }, (_, i) => {
                    const v = X.lines[k][i];
                    return `<td class="${i === cur ? 'cur' : ''} ${v == null ? 'empty' : ''}">${v == null ? (i < 4 ? '–' : '') : v}</td>`;
                }).join('');
                return `<tr class="${w >= 0 && w !== k ? 'lose' : ''}"><td class="t"><span style="--c:${t.color}"><i></i>${badge(t)}${esc(t.abbr)}</span></td>${cells}<td class="tot ${lead === k ? 'lead' : ''}"><b>${G.score[k]}</b></td></tr>`;
            })
            .join('');
        return `${compact ? '' : '<div class="sec-h"><span class="eyebrow">Marcador por cuartos</span></div>'}<table class="ls">${head}${rows}</table>`;
    }

    /** Así va el juego: probabilidad de ganar (con las jugadas que más pesaron) o puntos */
    function flowSec() {
        const recs = playable().filter((r) => r.wp != null);
        const [a, h] = G.teams;
        const st = G.status.state;
        if (!G.hasWp && !recs.length) return '';
        const hist = [0.5, ...recs.map((r) => r.wp)];
        const p = hist[hist.length - 1];
        const w = winner();
        const lead = p >= 0.5 ? 0 : 1;
        const swings = recs
            .map((r, i) => ({ r, d: r.wp - (i ? recs[i - 1].wp : 0.5), i: i + 1 }))
            .filter((x) => Math.abs(x.d) >= 0.02 && weighty(x.r))
            .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
            .slice(0, 3);
        const top =
            flow === 'wp'
                ? st === 'post' && w >= 0
                    ? `<div class="flow-top">${badge(G.teams[w])}<b>Ganó</b><small>${esc(G.teams[w].abbr)}</small></div>`
                    : `<div class="flow-top">${badge(G.teams[lead])}<b>${Math.round((lead ? 1 - p : p) * 100)}%</b><small>probabilidad de ${esc(G.teams[lead].abbr)}</small></div>`
                : `<div class="flow-top"><span class="fav-badge" style="${teamVars(a)}">${esc(a.abbr)} ${G.score[0]}</span><span class="fav-badge" style="${teamVars(h)}">${esc(h.abbr)} ${G.score[1]}</span></div>`;
        let chart;
        if (flow === 'wp') chart = `<div class="axis"><span>${esc(a.abbr)} ↑</span></div>${wpChart(G.teams, hist, { h: 132, marks: swings.map((s) => ({ i: s.i, color: G.teams[s.d > 0 ? 0 : 1].color })) })}<div class="axis"><span>${esc(h.abbr)} ↓</span></div>`;
        else chart = pointsChart();
        const sw =
            flow === 'wp' && swings.length
                ? `<div class="eyebrow" style="margin-top:12px">Las jugadas que más pesaron</div><div class="swings">${swings
                      .map((s) => {
                          const t = G.teams[s.d > 0 ? 0 : 1];
                          const who = whoOf(s.r) || t.abbr;
                          return `<button class="swing" data-n="${s.r.n}" style="--c:${t.color}"><span class="ch">+${Math.round(Math.abs(s.d) * 100)}%</span><span><b>${esc(s.r.label)}</b> · ${esc(who)}</span><em>${qShort(s.r.q)} ${esc(s.r.clock)}</em>${I.play}</button>`;
                      })
                      .join('')}</div><p class="note">Probabilidad de ganar según ESPN después de cada jugada. Toca una para verla animada.</p>`
                : '';
        return `<div class="sec-h"><span class="eyebrow">Así va el juego</span><div class="seg small flow-seg"><button data-f="wp" class="${flow === 'wp' ? 'on' : ''}">Probabilidad</button><button data-f="pts" class="${flow === 'pts' ? 'on' : ''}">Puntos</button></div></div>${top}${chart}${sw}`;
    }

    function pointsChart() {
        const recs = G.recs.filter((r) => r.after?.score);
        const W = 300;
        const H = 132;
        const max = Math.max(7, ...G.score) + 3;
        const n = Math.max(1, recs.length - 1);
        const line = (k) => [`0,${H}`, ...recs.map((r, i) => `${((i / n) * W).toFixed(1)},${(H - (r.after.score[k] / max) * H).toFixed(1)}`)].join(' ');
        return `<svg class="wp-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line(0)}" fill="none" stroke="${G.teams[0].color}" stroke-width="2.4" vector-effect="non-scaling-stroke"/><polyline points="${line(1)}" fill="none" stroke="${G.teams[1].color}" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg>`;
    }

    function scoringSec() {
        const list = G.recs.filter((r) => r.pts && r.spec);
        if (!list.length) return '';
        return `<div class="sec-h"><span class="eyebrow">Anotaciones</span></div><div class="swings">${list
            .map((r) => {
                const t = G.teams[r.pts.team];
                return `<button class="swing" data-n="${r.n}" style="--c:${t.color}"><span class="ch">+${r.pts.n} ${esc(t.abbr)}</span><span>${esc(r.es)}</span><em>${r.after.score[0]}–${r.after.score[1]}</em>${I.play}</button>`;
            })
            .join('')}</div>`;
    }

    /** Mapa de series: dónde empezó y terminó cada serie (lo que en El Play es el mapa de batazos) */
    function drivesSec() {
        const groups = new Map();
        for (const r of G.recs) if (r.spec && !/kickoff|onside|xp|2pt|timeout/.test(r.kind)) (groups.get(r.drive) || groups.set(r.drive, []).get(r.drive)).push(r);
        const rows = [...groups.entries()]
            .map(([di, recs]) => {
                const d = G.drives[di] || {};
                const t = G.teams[d.team ?? recs[0].team];
                if (dmFilter !== 'all' && String(dmFilter) !== String(d.team ?? recs[0].team)) return '';
                const start = 100 - (recs[0].ytg ?? 75);
                const last = recs[recs.length - 1];
                const end = last.pts ? 100 : Math.max(0, Math.min(100, 100 - (last.ytg ?? 75) + (last.yards ?? 0)));
                const l = Math.min(start, end);
                const wdt = Math.max(2, Math.abs(end - start));
                return `<div class="dm-row"><span>${badge(t, 'sm')}</span><div class="dm-track"><i style="--c:${t.color};left:${l}%;width:${wdt}%"></i></div><em class="${/Touchdown|Gol de campo/.test(d.result) ? 'good' : ''}">${esc(d.result || '')}</em></div>`;
            })
            .join('');
        if (!rows) return '';
        const [a, h] = G.teams;
        return `<div class="sec-h"><span class="eyebrow">Mapa de series</span><div class="seg small dm-seg"><button data-f="all" class="${dmFilter === 'all' ? 'on' : ''}">Ambos</button><button data-f="0" class="${dmFilter === '0' ? 'on' : ''}">${esc(a.abbr)}</button><button data-f="1" class="${dmFilter === '1' ? 'on' : ''}">${esc(h.abbr)}</button></div></div><div class="drives-map">${rows}</div><p class="note">Cada barra va de donde empezó la serie a donde terminó, siempre hacia la zona del rival (a la derecha).</p>`;
    }

    function detailsSec() {
        const items = [
            ['Estadio', X.venue?.name],
            ['Ciudad', X.venue?.city],
            ['Clima', X.weather && [X.weather.temp != null ? `${X.weather.temp} °F` : '', X.weather.text].filter(Boolean).join(' · ')],
            ['Público', X.attendance ? Number(X.attendance).toLocaleString('es') : ''],
            ['TV', X.tv],
            ['Apuestas', X.odds?.details && `${X.odds.details}${X.odds.ou ? ` · O/U ${X.odds.ou}` : ''}`]
        ].filter(([, v]) => v);
        if (!items.length && !X.officials.length) return '';
        return `<div class="sec-h"><span class="eyebrow">${I.info}Detalles del juego</span></div><div class="details">${items.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>${X.officials.length ? `<div class="eyebrow" style="margin-top:14px">Árbitros</div><div class="officials">${X.officials.map((o) => `${esc(o.role)}: <b>${esc(o.name)}</b>`).join('<br>')}</div>` : ''}`;
    }

    // ------------------------------------------------------------ Jugadores del juego (como «En el montículo» de El Play)

    function playersSec() {
        if (!X.players.length) return '';
        const st = G.status.state;
        if (plSide < 0) plSide = st === 'in' ? Math.max(0, possIdx()) : winner() >= 0 ? winner() : 0;
        const t = G.teams[plSide];
        const p = X.players.find((x) => x.team === t.id) || X.players[plSide];
        if (!p) return '';
        const cat = (n) => p.cats.find((c) => c.name === n);
        const val = (c, row, lab) => row.stats[c.labels.indexOf(lab)] ?? '';
        const num = (v) => Number(String(v).replace(/[^\d.-]/g, '')) || 0;
        const lines = {
            rushing: (c, r) => `${val(c, r, 'CAR')} aca · ${val(c, r, 'YDS')} yd${num(val(c, r, 'TD')) ? ` · ${val(c, r, 'TD')} TD` : ''}`,
            receiving: (c, r) => `${val(c, r, 'REC')} rec · ${val(c, r, 'YDS')} yd${num(val(c, r, 'TD')) ? ` · ${val(c, r, 'TD')} TD` : ''}`,
            defensive: (c, r) => `${val(c, r, 'TOT')} tackles${num(val(c, r, 'SACKS')) ? ` · ${val(c, r, 'SACKS')} sacks` : ''}`,
            interceptions: (c, r) => `${val(c, r, 'INT')} INT · ${val(c, r, 'YDS')} yd`
        };
        const role = { rushing: 'Carrera', receiving: 'Recepción', defensive: 'Defensa', interceptions: 'Intercepciones' };
        const tog = `<div class="tm-toggle pl-tog">${G.teams.map((x, i) => `<button data-pl="${i}" class="${i === plSide ? 'on' : ''}">${badge(x, 'sm')}${esc(x.abbr)}</button>`).join('')}</div>`;
        let html = `<div class="sec-h"><span class="eyebrow">Jugadores del juego</span>${tog}</div>`;
        const qbC = cat('passing');
        const qb = qbC?.rows[0];
        if (qb) {
            const onField = st === 'in' && possIdx() === plSide;
            html += `<div class="qb-card"><img src="${esc(qb.headshot)}" alt="" onerror="this.style.visibility='hidden'"><div><div class="eyebrow">${onField ? 'En el campo' : 'Quarterback'} · ${esc(t.abbr)}</div><b>${esc(qb.name)}</b><small>Quarterback${qb.jersey ? ` · #${esc(qb.jersey)}` : ''}</small></div></div><div class="tiles">${['C/ATT', 'YDS', 'TD', 'INT', 'RTG']
                .filter((l) => qbC.labels.includes(l))
                .map((l) => `<div><b>${esc(val(qbC, qb, l))}</b><span>${esc(BX_ES[l] || l)}</span></div>`)
                .join('')}</div>`;
        }
        const rows = [];
        for (const [name, n] of [
            ['rushing', 2],
            ['receiving', 3],
            ['defensive', 2],
            ['interceptions', 1]
        ]) {
            const c = cat(name);
            for (const r of c?.rows.slice(0, n) || []) rows.push(`<div class="lead-row"><img src="${esc(r.headshot)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(r.name)}</b><small>${esc(role[name])}${r.jersey ? ` · #${esc(r.jersey)}` : ''}</small></div><span class="v">${esc(lines[name](c, r))}</span></div>`);
        }
        html += rows.length ? `<div class="lead-rows">${rows.join('')}</div>` : '';
        return html + (st === 'in' ? '<p class="note">Se actualiza con cada jugada.</p>' : '');
    }

    // ------------------------------------------------------------ La historia del final (StoryRecap)

    function storySlides() {
        const recs = playable();
        const withWp = recs.filter((r) => r.wp != null);
        let best = null;
        let bd = -1;
        withWp.forEach((r, i) => {
            const d = Math.abs(r.wp - (i ? withWp[i - 1].wp : 0.5));
            if (d > bd && weighty(r)) {
                bd = d;
                best = r;
            }
        });
        if (!best) best = recs.filter((r) => r.pts && weighty(r)).sort((x, y) => (y.yards ?? 0) - (x.yards ?? 0))[0] || recs.filter(weighty).pop() || recs[recs.length - 1];
        const slides = [];
        if (best) slides.push({ kind: 'play', rec: best, delta: bd });
        const w = winner() >= 0 ? winner() : 0;
        const lead = X.leaders.find((l) => l.team === G.teams[w].id);
        if (lead?.cats.length) slides.push({ kind: 'stars', cats: lead.cats.slice(0, 3) });
        slides.push({ kind: 'line' });
        if (G.recs.some((r) => r.pts)) slides.push({ kind: 'scores' });
        return slides;
    }

    function story() {
        const w = winner() >= 0 ? winner() : 0;
        const t = G.teams[w];
        const light = inkOn(t.color) !== '#ffffff';
        const slides = storySlides();
        storyIdx = Math.min(storyIdx, slides.length - 1);
        const s = slides[storyIdx];
        let body = '';
        if (s.kind === 'play') {
            const r = s.rec;
            const who = whoOf(r);
            body = `<span class="st-tag">La jugada del juego</span><div class="st-head">${esc(who ? `${who}: ` : '')}${esc(r.label)}</div><div class="st-detail">${esc(qName(r.q))} · ${esc(r.clock)}${r.yards ? ` · ${r.yards > 0 ? '+' : ''}${r.yards} yd` : ''}${s.delta > 0 ? ` · ${Math.round(s.delta * 100)}% de probabilidad` : ''}</div><div class="st-box"><div class="stage"></div><div class="cap2">${esc(r.es)}</div></div>${whoHtml(r)}`;
        } else if (s.kind === 'stars') {
            body = `<span class="st-tag">Figuras del juego</span><div class="st-head">${esc(t.name)}</div>${s.cats.map((c) => `<div class="st-row"><img src="${esc(c.headshot || '')}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(c.who)}</b><small>${esc(c.label)} · ${esc(c.value)}</small></div></div>`).join('')}`;
        } else if (s.kind === 'line') {
            body = `<span class="st-tag">Marcador por cuartos</span><div class="st-ls">${lineScore(true)}</div><div class="st-big">${esc(G.teams[0].abbr)} ${G.score[0]} · ${esc(G.teams[1].abbr)} ${G.score[1]}</div>`;
        } else {
            body = `<span class="st-tag">Anotaciones</span>${G.recs
                .filter((r) => r.pts)
                .slice(-6)
                .map((r) => `<div class="st-row" style="padding:10px 14px"><div><b style="font-size:15px">${esc(G.teams[r.pts.team].abbr)} +${r.pts.n} · ${esc(r.label)}</b><small>${esc(qShort(r.q))} ${esc(r.clock)} · ${r.after.score[0]}–${r.after.score[1]}</small></div></div>`)
                .join('')}`;
        }
        return `<div class="storyc ${light ? 'light' : ''}" style="${teamVars(t)}"><div class="st-prog">${slides.map((_, i) => `<button data-s="${i}" class="${i <= storyIdx ? 'on' : ''}" aria-label="Parte ${i + 1}"></button>`).join('')}</div><div class="st-body">${body}</div><button class="st-nav p" ${storyIdx ? '' : 'disabled'} aria-label="Anterior">${I.left}</button><button class="st-nav n" ${storyIdx < slides.length - 1 ? '' : 'disabled'} aria-label="Siguiente">${I.chev}</button></div>`;
    }

    function mountStory() {
        clearTimeout(storyTimer);
        storyStage?.pause();
        const slot = $('.story-slot', el);
        if (!slot) return;
        slot.innerHTML = story();
        const box = $('.st-box .stage', slot);
        const s = storySlides()[storyIdx];
        if (box && s?.rec) {
            storyStage = new Stage(box, {
                onEnd: () => {
                    storyTimer = setTimeout(() => {
                        if (alive && storyStage) {
                            storyStage.seek(0);
                            storyStage.start();
                        }
                    }, 1400);
                }
            });
            const b = built(s.rec);
            if (b) {
                storyStage.setTeams(b.view.left, b.view.right);
                storyStage.load(b.play, b.view);
                storyStage.start();
            }
        }
    }

    // ------------------------------------------------------------ En vivo: el campo sigue cada jugada

    function situ() {
        const s = X.sit;
        const pi = possIdx();
        if (!s || pi < 0) return '';
        const att = G.teams[pi];
        const def = G.teams[1 - pi];
        const own = s.ytg != null ? 100 - s.ytg : ownFrom(s.spot, att.abbr);
        const spot = s.spot || (own == null ? '' : own === 50 ? '50' : own < 50 ? `${att.abbr} ${own}` : `${def.abbr} ${100 - own}`);
        return `<div class="situ"><div class="situ-card">${miniField(att, def, own, s.distance, 120, 40)}<div class="big">${s.down}ª y ${s.ytg != null && s.ytg <= s.distance ? 'gol' : s.distance}</div><div class="who"><b>${esc(att.abbr)} con el balón</b>${spot ? `<small>en ${esc(spot)}</small>` : ''}${s.ytg != null && s.ytg <= 20 ? '<div><span class="rz">ZONA ROJA</span></div>' : ''}</div></div></div>`;
    }

    function timeline() {
        const recs = G.recs.filter((r) => r.spec || r.sep);
        const last = recs.slice(-12).reverse();
        const cur = G.drives[G.drives.length - 1];
        const t = cur ? G.teams[cur.team] : null;
        let html = cur?.live && t ? `<div class="bub now">Serie de <b>${esc(t.name)}</b>${cur.desc ? ` · ${esc(cur.desc)}` : ''}</div>` : '';
        let q = null;
        last.forEach((r, i) => {
            if (r.sep) {
                html += `<div class="tl-sep">${esc(r.label)}</div>`;
                return;
            }
            if (q != null && r.q !== q) html += `<div class="tl-sep">${esc(qName(q))}</div>`;
            q = r.q;
            html += `<button class="bub play ${i === 0 ? 'last' : ''}" data-n="${r.n}" style="--tc:${tagColor(r)}"><span class="tag">${esc(r.label)}</span>${r.pts ? `<span class="scl">${esc(G.teams[0].abbr)} ${r.after.score[0]} · ${esc(G.teams[1].abbr)} ${r.after.score[1]}</span>` : ''}<span>${esc(r.es || r.raw)}</span><small>${esc(qShort(r.q))} ${esc(r.clock)}${r.downText ? ` · ${esc(r.downText)}` : ''}${r.spot ? ` · ${esc(r.spot)}` : ''}</small></button>`;
        });
        const more = playable().length - last.filter((r) => r.spec).length;
        return `<div class="sec-h"><span class="eyebrow">Últimas jugadas</span><span class="muted">Toca una para verla</span></div><div class="tl">${html || '<p class="muted">Todavía no hay jugadas.</p>'}${more > 0 ? `<button class="more-btn plays">Ver ${more} jugadas más</button>` : ''}</div>`;
    }

    function gcShow(i) {
        const r = G.recs[i];
        if (!r?.spec || !gc) return;
        clearTimeout(follTimer);
        gcIdx = i;
        const b = built(r);
        if (b) gc.show(b.play, b.view, r);
        $('.gc-title', el).innerHTML = `<b>${esc(r.label)}</b> <span class="muted">${esc(qShort(r.q))} ${esc(r.clock)}${r.downText ? ` · ${esc(r.downText)}` : ''}</span><p>${esc(r.es || '')}</p>${whoHtml(r)}`;
        if (b) gc.start();
        else if (follow) follTimer = setTimeout(() => gcStep(1), 1500);
    }
    const big = (r) => r.pts || r.turnover || r.flag || Math.abs(r.yards ?? 0) >= 20 || r.kind === 'sack';
    const gcStep = (d, onlyBig) => {
        let i = gcIdx + d;
        while (i >= 0 && i < G.recs.length && (!G.recs[i].spec || (onlyBig && !big(G.recs[i])))) i += d;
        if (i >= 0 && i < G.recs.length) gcShow(i);
    };
    function mountGamecast() {
        const slot = $('.gc-player', el);
        if (!slot) return;
        gc = new PlayerView(slot, {
            extra: `<button class="btn-round g-prev" aria-label="Jugada anterior">${I.prev}</button><button class="btn-round g-next" aria-label="Jugada siguiente">${I.next}</button><button class="tog g-follow ${follow ? 'on' : ''}" aria-pressed="${follow}">${I.zap}<span>Seguir</span></button>`,
            onEnd: () => {
                if (follow && settings.anim !== 'off') follTimer = setTimeout(() => gcStep(1, settings.anim === 'big'), 900);
            },
            onUser: () => clearTimeout(follTimer)
        });
        $('.g-prev', slot).onclick = () => gcStep(-1);
        $('.g-next', slot).onclick = () => gcStep(1);
        $('.g-follow', slot).onclick = (e) => {
            follow = !follow;
            e.currentTarget.classList.toggle('on', follow);
            e.currentTarget.setAttribute('aria-pressed', follow);
        };
        const start = focusPlay != null ? Number(focusPlay) : lastPlayable();
        if (start >= 0) gcShow(start);
    }

    // ------------------------------------------------------------ Previa

    function preview() {
        const [a, h] = G.teams;
        const pr = X.predictor;
        let wp = '';
        if (pr) {
            const pa = Math.round(pr.away);
            const ph = Math.round(pr.home);
            const fav = Math.abs(pa - ph) < 4 ? null : pa > ph ? a : h;
            wp = `<section class="sec"><div class="sec-h"><span class="eyebrow">Probabilidad de victoria</span>${fav ? `<span class="fav-badge" style="${teamVars(fav)}">Favorito · ${esc(fav.abbr)}</span>` : '<span class="fav-badge">Parejo</span>'}</div><div class="wpc-row"><div>${badge(a)}<b>${pa}%</b></div><div><b>${ph}%</b>${badge(h)}</div></div><div class="splitbar"><i style="--c:${a.color};flex:${pa}"></i><i style="--c:${h.color};flex:${ph}"></i></div><p class="note">Según el modelo de ESPN.</p></section>`;
        }
        const when = X.date || G.status.date;
        const info = `<section class="sec"><div class="info-rows"><div>${I.clock}<b>${esc(longDay(when))} · ${esc(timeOf(when))}</b>${soon(when, 72) ? `<span class="muted">${soon(when, 72)}</span>` : ''}</div>${X.venue ? `<div>${I.home}<span>${esc(X.venue.name)}${X.venue.city ? ` · ${esc(X.venue.city)}` : ''}</span></div>` : ''}${X.tv ? `<div>${I.tv}<span>${esc(X.tv)}</span></div>` : ''}${X.odds?.details ? `<div>${I.chart}<span>${esc(X.odds.details)}${X.odds.ou ? ` · O/U ${esc(X.odds.ou)}` : ''}</span></div>` : ''}</div></section>`;
        const leaders = X.leaders.some((l) => l.cats.length)
            ? `<section class="sec"><div class="sec-h"><span class="eyebrow">Quiénes destacan</span></div><div class="lead-rows">${X.leaders
                  .map((l) => {
                      const t = G.teams.find((x) => x.id === l.team) || a;
                      return l.cats
                          .slice(0, 3)
                          .map((c) => `<div class="lead-row"><img src="${esc(c.headshot || '')}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(c.who)}</b><small>${esc(t.abbr)} · ${esc(c.label)}</small></div><span class="v">${esc(c.value)}</span></div>`)
                          .join('');
                  })
                  .join('')}</div></section>`
            : '';
        const R = X.recordsBy;
        const form = R.some((r) => r.total)
            ? `<section class="sec"><div class="sec-h"><span class="eyebrow">Cómo llegan</span></div><table class="form-table"><tr><th></th><th>${badge(a, 'sm')} ${esc(a.abbr)}</th><th>${badge(h, 'sm')} ${esc(h.abbr)}</th></tr><tr><td>Récord</td><td>${esc(R[0].total)}</td><td>${esc(R[1].total)}</td></tr><tr><td>De visita / En casa</td><td>${esc(R[0].road)}</td><td>${esc(R[1].home)}</td></tr></table></section>`
            : '';
        const inj = X.injuries.some((t) => t.list.length)
            ? `<section class="sec"><div class="sec-h"><span class="eyebrow">Lesionados</span></div>${X.injuries
                  .map((it) => {
                      const t = G.teams.find((x) => x.id === it.team) || a;
                      return it.list.length ? `<div class="eyebrow" style="margin:8px 0 4px">${esc(t.abbr)}</div>${it.list.map((p) => `<div class="cmp-row" style="grid-template-columns:1fr auto"><span style="text-align:left;font-size:14px;color:var(--ink)">${esc(p.name)} <span class="muted">${esc(p.pos)}</span></span><b>${esc(p.status)}</b></div>`).join('')}` : '';
                  })
                  .join('')}</section>`
            : '';
        const on = settings.bells.includes(id);
        return `${wp}${info}${leaders}${form}${inj}<div class="abtns"><button class="abtn bell-g">${on ? I.bellOn : I.bell}${on ? 'Quitar aviso' : 'Avisarme cuando empiece'}</button><button class="abtn primary share-g">${I.share}Compartir</button></div>`;
    }

    // ------------------------------------------------------------ Armar la pantalla

    function renderAll() {
        renderHero();
        const st = G.status.state;
        const body = $('.gbody', el);
        gc?.destroy();
        gc = null;
        storyStage?.pause();
        if (st === 'pre') body.innerHTML = preview();
        else if (st === 'in')
            body.innerHTML = `${situ()}<section class="sec"><div class="sec-h"><span class="eyebrow">${I.field}En el campo</span><span class="muted upd">Actualizado hace 0 s</span></div><div class="gc-title"></div><div class="gc-player"></div></section><section class="sec ls-sec">${lineScore()}</section><section class="sec pl-sec">${playersSec()}</section><section class="sec tl-sec">${timeline()}</section><section class="sec flow-sec">${flowSec()}</section><section class="sec">${detailsSec()}</section><div class="abtns"><button class="abtn box">${I.table}Box score</button><button class="abtn plays">${I.list}Jugadas</button><button class="abtn primary share-g">${I.share}Compartir</button></div>`;
        else
            body.innerHTML = `<div class="story-slot"></div><section class="sec ls-sec">${lineScore()}</section><section class="sec pl-sec">${playersSec()}</section><section class="sec flow-sec">${flowSec()}</section>${scoringSec() ? `<section class="sec">${scoringSec()}</section>` : ''}${drivesSec() ? `<section class="sec dm-sec">${drivesSec()}</section>` : ''}${detailsSec() ? `<section class="sec">${detailsSec()}</section>` : ''}<div class="abtns"><button class="abtn plays">${I.list}Jugadas</button><button class="abtn box">${I.table}Box score</button><button class="abtn primary share-g">${I.share}Compartir</button></div>`;
        $$('.sec', body).forEach((s) => {
            if (!s.innerHTML.trim()) s.remove();
        });
        if (st === 'in') mountGamecast();
        if (st === 'post') {
            mountStory();
            if (focusPlay != null) openPlays(Number(focusPlay));
        }
    }

    function update(prevLen) {
        renderHero();
        const set = (sel, html) => {
            const s = $(sel, el);
            if (s) s.innerHTML = html;
        };
        const sitEl = $('.situ', el);
        if (sitEl) sitEl.outerHTML = situ() || '<div class="situ"></div>';
        set('.ls-sec', lineScore());
        set('.tl-sec', timeline());
        set('.flow-sec', flowSec());
        set('.pl-sec', playersSec());
        if (gc && follow && G.recs.length > prevLen && !gc.stage.playing) gcStep(1);
    }

    // ------------------------------------------------------------ Hojas: jugadas y box score

    let sheetPlayer = null;
    function openPlays(focus) {
        const body = openSheet('Jugada a jugada', '', { tall: true });
        let filter = 'all';
        const draw = () => {
            const groups = new Map();
            for (const r of G.recs) {
                if (filter === 'pts' && !r.pts) continue;
                if (!r.spec && !r.sep) continue;
                (groups.get(r.drive) || groups.set(r.drive, []).get(r.drive)).push(r);
            }
            const html = [...groups.entries()]
                .map(([di, recs]) => {
                    const d = G.drives[di] || {};
                    const t = G.teams[d.team ?? recs[0].team];
                    return `<div class="dh">${badge(t, 'sm')}${esc(t.abbr)}${d.desc ? ` · ${esc(d.desc)}` : ''}<em class="${/Touchdown|Gol de campo/.test(d.result) ? 'good' : ''}">${esc(d.live ? 'En curso' : d.result || '')}</em></div>${recs
                        .map((r) =>
                            r.sep
                                ? `<div class="dh">${esc(r.label)}</div>`
                                : `<button class="pr" data-n="${r.n}" style="--c:${G.teams[r.team].color};--tc:${tagColor(r)}"><span class="tdot"></span><span><span class="tag">${esc(r.label)}</span>${r.pts ? `<span class="scl">${esc(G.teams[0].abbr)} ${r.after.score[0]} · ${esc(G.teams[1].abbr)} ${r.after.score[1]}</span>` : ''}<p>${esc(r.es || r.raw)}</p><small>${esc(qShort(r.q))} ${esc(r.clock)}${r.downText ? ` · ${esc(r.downText)}` : ''}${r.spot ? ` · ${esc(r.spot)}` : ''}</small></span><span class="go">Ver${I.chev}</span></button>`
                        )
                        .join('')}`;
                })
                .join('');
            $('.pl-list', body).innerHTML = html || `<p class="muted" style="padding:16px">${filter === 'pts' ? 'Nadie ha anotado.' : 'Todavía no hay jugadas.'}</p>`;
        };
        body.innerHTML = `<div class="plays-card"><div class="sec-h"><span class="eyebrow">Toca una jugada para verla animada</span><div class="seg small"><button data-f="all" class="on">Todas</button><button data-f="pts">Anotadoras</button></div></div><div class="pl-list"></div></div>`;
        draw();
        const expand = (row) => {
            sheetPlayer?.destroy();
            $$('.pr-exp', body).forEach((x) => x.remove());
            $$('.pr.open', body).forEach((x) => x.classList.remove('open'));
            if (!row) return;
            const r = G.recs[Number(row.dataset.n)];
            row.classList.add('open');
            const box = document.createElement('div');
            box.className = 'pr-exp';
            row.after(box);
            const b = built(r);
            if (!b) {
                box.innerHTML = '<p class="muted">Esta jugada no se puede animar; arriba está lo que pasó.</p>';
                return;
            }
            sheetPlayer = new PlayerView(box, {});
            sheetPlayer.show(b.play, b.view, r);
            sheetPlayer.start();
            requestAnimationFrame(() => row.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        };
        body.addEventListener('click', (ev) => {
            const f = ev.target.closest('.seg [data-f]');
            if (f) {
                filter = f.dataset.f;
                $$('.seg button', body).forEach((b) => b.classList.toggle('on', b === f));
                sheetPlayer?.destroy();
                return draw();
            }
            const row = ev.target.closest('.pr');
            if (row) expand(row.classList.contains('open') ? null : row);
        });
        if (focus != null) {
            const row = $(`.pr[data-n="${focus}"]`, body);
            if (row) setTimeout(() => expand(row), 300);
        }
    }

    function openBox() {
        const body = openSheet('Box score', '', { tall: true });
        let side = 0;
        const draw = () => {
            const t = G.teams[side];
            const p = X.players.find((x) => x.team === t.id) || X.players[side];
            const cmp = X.statRows.length
                ? `<div class="bx-card"><div class="eyebrow">Comparación</div><div class="cmp" style="padding:0 16px">${X.statRows.map((r) => `<div class="cmp-row"><b>${esc(r.a)}</b><span>${esc(r.label)}</span><b>${esc(r.b)}</b></div>`).join('')}</div></div>`
                : '';
            const cats = (p?.cats || [])
                .filter((c) => c.rows.length)
                .map(
                    (c) =>
                        `<div class="bx-card"><div class="eyebrow">${esc(c.label)} · ${esc(t.abbr)}</div><div class="bx-scroll"><table class="bx"><tr><th>Jugador</th>${c.labels.map((l) => `<th>${esc(BX_ES[l] || l)}</th>`).join('')}</tr>${c.rows.map((r) => `<tr><td>${esc(r.name)}</td>${r.stats.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}${c.totals.length ? `<tr class="tot"><td>Totales</td>${c.totals.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>` : ''}</table></div></div>`
                )
                .join('');
            body.innerHTML = `<div class="tm-toggle">${G.teams.map((x, i) => `<button data-s="${i}" class="${i === side ? 'on' : ''}">${badge(x, 'sm')}${esc(x.abbr)}</button>`).join('')}</div>${cmp}${cats || '<p class="muted">Todavía no hay números de los jugadores.</p>'}`;
        };
        draw();
        body.addEventListener('click', (ev) => {
            const b = ev.target.closest('.tm-toggle [data-s]');
            if (b) {
                side = Number(b.dataset.s);
                draw();
            }
        });
    }

    // ------------------------------------------------------------ Toques

    el.addEventListener('click', (ev) => {
        const t = ev.target;
        const fav = t.closest('[data-fav]');
        if (fav) {
            const on = toggleIn('favs', fav.dataset.fav);
            toast(on ? `${fav.dataset.fav} es tu equipo favorito` : `Quitaste a ${fav.dataset.fav} de favoritos`);
            return renderHero();
        }
        if (t.closest('.share-g')) {
            const [a, h] = G.teams;
            return share(`${a.abbr} ${G.score[0]}-${G.score[1]} ${h.abbr}`, `${a.name} ${G.score[0]} · ${h.name} ${G.score[1]} en El Snap`);
        }
        if (t.closest('.bell-g')) {
            const on = toggleIn('bells', id);
            toast(on ? 'Listo: te avisamos cuando empiece.' : 'Quitamos el aviso de este juego.');
            return renderAll();
        }
        if (t.closest('.plays')) return openPlays();
        if (t.closest('.box')) return openBox();
        const fs = t.closest('.flow-seg [data-f]');
        if (fs) {
            flow = fs.dataset.f;
            $('.flow-sec', el).innerHTML = flowSec();
            return;
        }
        const pl = t.closest('.pl-tog [data-pl]');
        if (pl) {
            plSide = Number(pl.dataset.pl);
            $('.pl-sec', el).innerHTML = playersSec();
            return;
        }
        const ds = t.closest('.dm-seg [data-f]');
        if (ds) {
            dmFilter = ds.dataset.f;
            $('.dm-sec', el).innerHTML = drivesSec();
            return;
        }
        const sw = t.closest('.swing, .bub.play');
        if (sw) {
            const n = Number(sw.dataset.n);
            if (gc) {
                gcShow(n);
                $('.gc-player', el)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else openPlays(n);
            return;
        }
        const sp = t.closest('.st-prog [data-s]');
        if (sp) {
            storyIdx = Number(sp.dataset.s);
            return mountStory();
        }
        if (t.closest('.st-nav.p')) {
            storyIdx = Math.max(0, storyIdx - 1);
            return mountStory();
        }
        if (t.closest('.st-nav.n')) {
            storyIdx += 1;
            return mountStory();
        }
    });

    load(true);
    return {
        unmount() {
            alive = false;
            clearTimeout(timer);
            clearTimeout(follTimer);
            clearTimeout(storyTimer);
            clearInterval(ago);
            gc?.destroy();
            storyStage?.pause();
            sheetPlayer?.destroy();
        }
    };
}
