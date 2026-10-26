// El Snap: la app. Juegos reales de la NFL animados, un juego de práctica simulado, todas las animaciones,
// cómo se anota y la guía del terreno.
import { buildPlay, FOULS } from './plays.js';
import { Stage, staticField, yardLabel, LOGO_PATHS, FW } from './field.js';
import { Game, TEAMS, QUARTER, QSHORT, clockText } from './game.js';
import { CATALOG, CATS, SCORING } from './catalog.js';
import { getScoreboard, getSummary, mapGame, roster } from './nfl.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------- Ajustes (por dispositivo)

const SETTINGS_KEY = 'elsnap:settings';
const settings = { theme: 'auto', speed: 1, pizarra: true, vibrate: true };
try {
    Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch {
    /* sin almacenamiento: se usan los de fábrica */
}
const saveSettings = () => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        /* nada */
    }
};
const applyTheme = () => {
    if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = settings.theme;
    const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#0b0c10' : '#f6f6f9');
};
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
const vibrate = (p) => settings.vibrate && navigator.userActivation?.hasBeenActive && navigator.vibrate?.(p);

// ---------------------------------------------------------------- Íconos, escudos y logos

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
    play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
    pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor"/>'),
    replay: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    next: svg('<path d="M5 4.5v15l10-7.5z" fill="currentColor"/><path d="M19 5v14"/>'),
    prev: svg('<path d="M19 4.5v15L9 12z" fill="currentColor"/><path d="M5 5v14"/>'),
    fast: svg('<path d="M13 19l9-7-9-7z" fill="currentColor"/><path d="M2 19l9-7-9-7z" fill="currentColor"/>'),
    zap: svg('<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>'),
    star: svg('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"/>'),
    pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    max: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'),
    ball: svg('<ellipse cx="12" cy="12" rx="9.5" ry="5.6" transform="rotate(-35 12 12)"/><path d="M9.5 14.5l5-5M10.6 11.2l2.2 2.2M12.1 9.7l2.2 2.2M9.1 12.7l2.2 2.2"/>'),
    flagFill: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><path d="M4 22v-7"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    tv: svg('<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>'),
    left: svg('<path d="m15 18-6-6 6-6"/>'),
    right: svg('<path d="m9 18 6-6-6-6"/>'),
    retry: svg('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>')
};

const EMBLEM = {
    shark: '<path d="M3 17.5c3.2-.4 6.3-2.6 8-6.6l1.5-6.4c1.4 3.4 3.6 7.7 8.5 13z" fill="#fff"/><path d="M2 20.6c1.7-1.2 3.3-1.2 5 0s3.3 1.2 5 0 3.3-1.2 5 0 3.3 1.2 5 0" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    volcano: '<path d="M2.5 20.6 8.6 9.8h6.8l6.1 10.8z" fill="#fff"/><path d="M12 6.4V3.4M8.7 7 7.3 4.8M15.3 7l1.4-2.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>'
};
/** Escudo del equipo: el logo real (si no carga, la abreviatura) o el emblema de los equipos de práctica */
const emblem = (t) => (t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">` : EMBLEM[t.emblem] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${EMBLEM[t.emblem]}</svg>` : '');
const badge = (t, cls = '') => `<span class="badge ${t.logo ? 'logo' : EMBLEM[t.emblem] ? '' : 'noimg'} ${cls}" style="--c:${t.color}" data-abbr="${esc(t.abbr)}">${emblem(t)}</span>`;

/** Estado de ESPN en español: «4th - 0:40» → «4º · 0:40», «Halftime» → «Medio tiempo»… */
const statusEs = (s = '') =>
    s
        .replace(/\b(\d)(st|nd|rd|th)\b/gi, '$1º')
        .replace(/^End of (\dº)/i, 'Fin del $1')
        .replace(/Halftime/i, 'Medio tiempo')
        .replace(/Final\/OT/i, 'Final (prórroga)')
        .replace(/Delayed/i, 'Retrasado')
        .replace(/Postponed/i, 'Pospuesto')
        .replace(/Canceled/i, 'Cancelado')
        .replace(/ - /, ' · ');
$('#logo').innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${LOGO_PATHS('lg-top')}</svg>`;

// ---------------------------------------------------------------- Reproductor de jugadas (campo + controles)

const KIND_CARD = { td: 'score', fg: 'score', xp: 'score', '2pt': 'score', safety: 'score', int: 'turn', fumble: 'turn', sack: 'turn', block: 'turn', onside: 'turn', flag: 'flag', challenge: 'challenge', review: 'review', timeout: 'neutral' };
const TICK_TYPES = { passline: ['Lanzamiento', 'white'], catch: ['Atrapa', 'gold'], flag: ['Pañuelo', 'flag'], score: ['Anota', 'gold'], kick: ['Patada', 'white'], burst: ['Contacto', 'white'], enforce: ['Castigo', 'flag'] };

class PlayerView {
    constructor(root, o = {}) {
        this.o = o;
        this.root = root;
        root.classList.add('player');
        root.innerHTML = `
<div class="field-card">
  <div class="stage"></div>
  <div class="cap" aria-live="polite"><span class="cap-n">1</span><span class="cap-t"></span></div>
  <div class="overlay"></div>
  <canvas class="confetti"></canvas>
  <div class="teams-legend"></div>
</div>
<div class="scrub">
  <div class="track"><div class="fill"></div><div class="ticks"></div><input type="range" min="0" max="1000" step="1" value="0" aria-label="Línea de tiempo de la jugada"></div>
  <div class="times"><span class="t0">0.0 s</span><span class="t1">0.0 s</span></div>
</div>
<div class="ctrls">
  <button class="btn-round primary b-play" aria-label="Reproducir">${I.play}</button>
  <button class="btn-round b-replay" aria-label="Repetir la jugada">${I.replay}</button>
  ${o.extra || ''}
  <span class="grow"></span>
  <div class="seg b-speed" role="group" aria-label="Velocidad">${[0.5, 1, 2].map((s) => `<button data-s="${s}">${s}×</button>`).join('')}</div>
  <button class="tog b-piz" aria-pressed="true">${I.pen}<span>Pizarra</span></button>
  <button class="tog b-full" aria-pressed="false">${I.max}<span>Todo</span></button>
</div>`;
        this.overlay = $('.overlay', root);
        this.canvas = $('.confetti', root);
        this.cap = $('.cap', root);
        this.input = $('input[type=range]', root);
        this.stage = new Stage($('.stage', root), {
            onEvent: (e) => this.onEvent(e),
            onStep: (i, steps) => this.onStep(i, steps),
            onTime: (t, d) => this.onTime(t, d),
            onEnd: () => this.o.onEnd?.(),
            onPlayState: (p) => {
                $('.b-play', root).innerHTML = p ? I.pause : I.play;
                $('.b-play', root).setAttribute('aria-label', p ? 'Pausar' : 'Reproducir');
            }
        });
        this.stage.pizarra = settings.pizarra;
        $('.b-play', root).onclick = () => {
            this.o.onUser?.();
            this.stage.toggle();
        };
        $('.b-replay', root).onclick = () => {
            this.o.onUser?.();
            this.clearOverlay();
            this.stage.seek(0);
            this.stage.start();
        };
        this.dragging = false;
        this.input.addEventListener('pointerdown', () => (this.dragging = true));
        this.input.addEventListener('pointerup', () => (this.dragging = false));
        this.input.addEventListener('input', () => {
            this.o.onUser?.();
            this.stage.pause();
            this.clearOverlay();
            this.stage.seek((this.input.value / 1000) * (this.stage.play?.dur || 0));
        });
        $$('.b-speed button', root).forEach((b) => (b.onclick = () => this.setSpeed(Number(b.dataset.s))));
        this.setSpeed(settings.speed);
        const piz = $('.b-piz', root);
        piz.classList.toggle('on', this.stage.pizarra);
        piz.setAttribute('aria-pressed', this.stage.pizarra);
        piz.onclick = () => this.setPizarra(!this.stage.pizarra);
        const full = $('.b-full', root);
        full.onclick = () => {
            this.stage.full = !this.stage.full;
            full.classList.toggle('on', this.stage.full);
            full.setAttribute('aria-pressed', this.stage.full);
            this.stage.render(true);
        };
    }
    setSpeed(s) {
        this.stage.speed = s;
        $$('.b-speed button', this.root).forEach((b) => b.classList.toggle('on', Number(b.dataset.s) === s));
    }
    setPizarra(on) {
        this.stage.pizarra = on;
        const piz = $('.b-piz', this.root);
        piz.classList.toggle('on', on);
        piz.setAttribute('aria-pressed', on);
        this.stage.render(true);
    }
    show(play, view, meta = {}) {
        this.view = view;
        this.meta = meta;
        this.clearOverlay();
        const key = `${view.left.id}-${view.right.id}`;
        if (this.teamsKey !== key) {
            this.stage.setTeams(view.left, view.right);
            this.teamsKey = key;
        }
        this.stage.load(play, view);
        $('.teams-legend', this.root).innerHTML = `<span><i style="background:${view.offTeam.color}"></i>${esc(view.offTeam.abbr)} con el balón</span><span><i style="background:${view.defTeam.color}"></i>${esc(view.defTeam.abbr)}</span><span><i class="ref"></i>Árbitros</span>`;
        const ticks = [{ t: play.snap, label: 'Snap', tone: 'white' }];
        const seen = new Set();
        for (const e of play.events) {
            const tt = TICK_TYPES[e.type];
            if (!tt || seen.has(e.type)) continue;
            seen.add(e.type);
            ticks.push({ t: e.t, label: tt[0], tone: tt[1] });
        }
        $('.ticks', this.root).innerHTML = ticks.map((k) => `<i class="${k.tone}" style="left:${(k.t / play.dur) * 100}%" title="${k.label}"></i>`).join('');
        this.renderSteps(play);
        this.renderSummary(play, view, meta);
    }
    start() {
        this.stage.seek(0);
        this.stage.start();
    }
    pause() {
        this.stage.pause();
    }
    onTime(t, d) {
        $('.fill', this.root).style.width = `${(t / d) * 100}%`;
        if (!this.dragging) this.input.value = Math.round((t / d) * 1000);
        $('.t0', this.root).textContent = `${t.toFixed(1)} s`;
        $('.t1', this.root).textContent = `${d.toFixed(1)} s`;
    }
    onStep(i, steps) {
        const s = steps[i];
        this.cap.classList.toggle('on', !!s);
        if (s) {
            $('.cap-n', this.root).textContent = i + 1;
            $('.cap-t', this.root).textContent = s.text;
        }
        const list = this.o.steps;
        if (!list) return;
        $$('li', list).forEach((li, k) => {
            li.classList.toggle('done', k < i);
            li.classList.toggle('on', k === i);
        });
        const on = $('li.on', list);
        if (on && list.scrollHeight > list.clientHeight) list.scrollTo({ top: on.offsetTop - list.clientHeight / 2, behavior: 'smooth' });
    }
    renderSteps(play) {
        const list = this.o.steps;
        if (!list) return;
        list.innerHTML = play.steps.map((s, i) => `<li data-t="${s.t}"><span class="sn">${i + 1}</span><span class="st">${esc(s.text)}</span><span class="stt">${s.t.toFixed(1)}s</span></li>`).join('');
        $$('li', list).forEach(
            (li) =>
                (li.onclick = () => {
                    this.o.onUser?.();
                    this.stage.pause();
                    this.clearOverlay();
                    this.stage.seek(Number(li.dataset.t) + 0.02);
                })
        );
    }
    renderSummary(play, view, meta) {
        const box = this.o.summary;
        if (!box) return;
        const X = (u) => view.losX + view.dir * u;
        const yl = (u) => yardLabel(X(u), view.left, view.right);
        const chips = [];
        const pl = play.events.find((e) => e.type === 'passline');
        const yac = play.events.find((e) => e.type === 'yacline');
        if (pl && !pl.result.startsWith('kick'))
            chips.push(['Pase', `${yl(pl.from[0])} → ${pl.result === 'inc' ? 'incompleto' : yl(pl.to[0])}`], ['En el aire', `${Math.abs(Math.round(pl.to[0] - pl.from[0]))} yd (${Math.round(pl.to[0])} pasada la línea)`]);
        if (pl && pl.result.startsWith('kick')) chips.push(['Patada', `${yl(pl.from[0])} → ${pl.result === 'kickgood' ? 'entre los postes' : pl.result === 'kickmiss' ? 'desviada' : yl(pl.to[0])}`], ['Distancia', `${Math.abs(Math.round(pl.air))} yd`]);
        if (yac) chips.push(['Tras atrapar', `+${yac.yac} yd`]);
        if (meta.yards != null) chips.push(['Resultado', `${meta.yards > 0 ? '+' : ''}${meta.yards} yd`]);
        if (meta.pts) chips.push(['Puntos', `+${meta.pts.n} ${meta.pts.abbr ?? TEAMS[meta.pts.team]?.abbr ?? ''}`]);
        const flags = play.events.filter((e) => e.type === 'flag');
        if (flags.length) chips.push(['Pañuelo', flags[0].color === 'red' ? 'rojo (desafío)' : 'amarillo']);
        chips.push(['Línea de golpeo', view.losLabel || yl(0)], ['Duración', `${play.whistle.toFixed(1)} s`]);
        box.innerHTML = chips.map(([k, v]) => `<div class="sum"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    }
    clearOverlay() {
        this.overlay.replaceChildren();
        this.confettiStop?.();
    }
    onEvent(e) {
        if (e.type === 'card') this.card(e);
        if (e.type === 'flag') vibrate([25, 40, 25]);
        if (e.type === 'score') vibrate([40, 50, 80]);
        this.o.onEvent?.(e);
    }
    card(e) {
        const team = e.side === 'off' ? this.view.offTeam : e.side === 'def' ? this.view.defTeam : null;
        const style = KIND_CARD[e.kind] || 'turn';
        const special = style === 'flag' || style === 'challenge' || style === 'review' || style === 'neutral';
        const icon = style === 'flag' || style === 'challenge' ? I.flagFill : style === 'review' ? I.tv : style === 'neutral' ? I.clock : team ? emblem(team) || I.ball : I.ball;
        const kicker = style === 'flag' ? `Contra ${team ? team.name : ''}` : special ? 'Árbitro' : team?.name ?? '';
        const el = document.createElement('div');
        el.className = `pa-card ${style} k-${e.kind}`;
        if (team) el.style.cssText = `--team:${team.color};--team2:${team.color2}`;
        el.innerHTML = `<div class="pa-stripes"></div><div class="pa-shine"></div><div class="pa-badge ${!special && team?.logo ? 'logo' : ''}" data-abbr="${esc(team?.abbr || '')}">${icon}</div><div class="pa-body"><div class="pa-kicker">${esc(kicker)}</div><div class="pa-title">${esc(e.title)}</div>${e.sub ? `<div class="pa-sub">${esc(e.sub)}</div>` : ''}${e.signal ? `<div class="pa-sig">Señal: ${esc(e.signal)}</div>` : ''}</div>${e.pts ? `<div class="pa-pts">+${e.pts}</div>` : ''}`;
        this.overlay.replaceChildren(el);
        const hold = (style === 'score' ? 2600 : 2200) / Math.max(0.6, this.stage.speed);
        setTimeout(() => el.classList.add('out'), hold);
        setTimeout(() => el.remove(), hold + 400);
        if (style === 'score' && team) this.confetti([team.color, team.color2, '#ffffff', '#facc15']);
    }
    confetti(colors) {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const c = this.canvas;
        const r = c.getBoundingClientRect();
        const dpr = Math.min(2, devicePixelRatio || 1);
        c.width = r.width * dpr;
        c.height = r.height * dpr;
        const ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        const parts = Array.from({ length: 90 }, () => ({ x: r.width / 2 + (Math.random() - 0.5) * 60, y: r.height * 0.45, vx: (Math.random() - 0.5) * 9, vy: -4 - Math.random() * 7, s: 4 + Math.random() * 5, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)] }));
        let alive = true;
        const t0 = performance.now();
        this.confettiStop = () => {
            alive = false;
            ctx.clearRect(0, 0, r.width, r.height);
        };
        const frame = (now) => {
            if (!alive) return;
            const k = (now - t0) / 1900;
            ctx.clearRect(0, 0, r.width, r.height);
            for (const p of parts) {
                p.vy += 0.28;
                p.vx *= 0.99;
                p.x += p.vx;
                p.y += p.vy;
                p.a += p.va;
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - k);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.a);
                ctx.fillStyle = p.c;
                ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
                ctx.restore();
            }
            if (k < 1) requestAnimationFrame(frame);
            else ctx.clearRect(0, 0, r.width, r.height);
        };
        requestAnimationFrame(frame);
    }
}

// ---------------------------------------------------------------- Marcador y probabilidad (para la NFL y la práctica)

function odo(el, value) {
    const s = String(value);
    if (el.childElementCount !== s.length) el.innerHTML = s.split('').map(() => `<span class="od"><span class="od-s">${[...'0123456789'].map((d) => `<b>${d}</b>`).join('')}</span></span>`).join('');
    [...el.children].forEach((c, i) => (c.firstChild.style.transform = `translateY(${-Number(s[i]) * 10}%)`));
}

function buildBoard(el, teams) {
    el.innerHTML = `
${teams
    .map(
        (t, i) => `<div class="sb-team" data-i="${i}" style="--c:${t.color}">
  <div class="sb-stripes"></div>
  <div class="sb-row">${badge(t, 'lg')}<span class="sb-poss" title="Tiene el balón">${I.ball}</span></div>
  <div class="sb-name">${esc(t.name)}<small>${esc(t.city)}</small></div>
  <div class="sb-score"><span class="odo" aria-label="Puntos de ${esc(t.name)}"></span><span class="sb-plus"></span></div>
  <div class="sb-tos" title="Tiempos fuera"><i></i><i></i><i></i></div>
</div>`
    )
    .join('')}`;
    const mid = document.createElement('div');
    mid.className = 'sb-mid';
    mid.innerHTML = '<div class="sb-q"></div><div class="sb-clock"></div><div class="sb-down"></div><div class="sb-spot"></div>';
    el.insertBefore(mid, $('.sb-team[data-i="1"]', el));
}

/** Pinta el marcador: v = { score, q, clock, down, spot, poss, timeouts, pop } */
function paintBoard(el, v) {
    [0, 1].forEach((i) => {
        const t = $(`.sb-team[data-i="${i}"]`, el);
        odo($('.odo', t), v.score[i]);
        t.classList.toggle('has', v.poss === i);
        $('.sb-tos', t).hidden = !v.timeouts;
        if (v.timeouts) $$('.sb-tos i', t).forEach((d, k) => d.classList.toggle('used', k >= v.timeouts[i]));
    });
    $('.sb-q', el).textContent = v.q;
    $('.sb-clock', el).textContent = v.clock;
    $('.sb-down', el).textContent = v.down || '';
    $('.sb-spot', el).textContent = v.spot || '';
    if (v.pop) {
        const team = $(`.sb-team[data-i="${v.pop.team}"]`, el);
        const plus = $('.sb-plus', team);
        plus.textContent = `+${v.pop.n}`;
        plus.classList.remove('go');
        team.classList.remove('flash');
        void el.offsetWidth;
        plus.classList.add('go');
        team.classList.add('flash');
    }
}

/** Probabilidad de ganar del visitante (equipo 0) a lo largo del juego */
function drawWp(prefix, teams, hist) {
    const p = hist.length ? hist[hist.length - 1] : 0.5;
    $(`#${prefix}-ta`).innerHTML = badge(teams[0], 'sm');
    $(`#${prefix}-tb`).innerHTML = badge(teams[1], 'sm');
    $(`#${prefix}-a`).style.cssText = `width:${p * 100}%;background:${teams[0].color}`;
    $(`#${prefix}-a`).parentNode.style.background = teams[1].color;
    $(`#${prefix}-pa`).textContent = `${Math.round(p * 100)}%`;
    $(`#${prefix}-pb`).textContent = `${100 - Math.round(p * 100)}%`;
    const W = 300;
    const H = 64;
    const pts = hist.map((v, i) => `${((i / Math.max(1, hist.length - 1)) * W).toFixed(1)},${(H - v * H).toFixed(1)}`).join(' ');
    $(`#${prefix}-chart`).innerHTML = `<defs><clipPath id="${prefix}Top"><rect x="0" y="0" width="${W}" height="${H / 2}"/></clipPath><clipPath id="${prefix}Bot"><rect x="0" y="${H / 2}" width="${W}" height="${H / 2}"/></clipPath></defs>
<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="wp-mid"/>
<polyline points="${pts}" fill="none" stroke="${teams[0].color}" stroke-width="2.2" clip-path="url(#${prefix}Top)" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
<polyline points="${pts}" fill="none" stroke="${teams[1].color}" stroke-width="2.2" clip-path="url(#${prefix}Bot)" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
}

const pbpChip = (r, teams) =>
    r.pts ? `<span class="chip gold">+${r.pts.n} ${esc(r.pts.abbr ?? teams[r.pts.team]?.abbr ?? '')}</span>` : r.flag ? `<span class="chip flag">${I.flagFill}</span>` : r.turnover ? '<span class="chip live">Cambio</span>' : r.yards != null && !r.special ? `<span class="chip ${r.yards > 0 ? 'up' : r.yards < 0 ? 'down' : ''}">${r.yards > 0 ? '+' : ''}${r.yards}</span>` : '';

// ---------------------------------------------------------------- NFL: juegos reales

const qName = (q) => (q >= 5 ? 'Prórroga' : QUARTER[q] || '');
const dirOf = (team, q) => ((team === 0) === (q % 2 === 1) ? 1 : -1);

/** Vista del campo de una jugada real: línea de golpeo, dirección (cambian de lado cada cuarto) y línea de primera */
function nflView(rec, teams) {
    const dir = dirOf(rec.team, rec.q);
    const ytg = rec.spec?.ytg ?? rec.ytg ?? 75;
    const losX = dir > 0 ? 110 - ytg : 10 + ytg;
    const leftIdx = dirOf(0, rec.q) > 0 ? 0 : 1;
    const left = teams[leftIdx];
    const right = teams[1 - leftIdx];
    return { losX, dir, offTeam: teams[rec.team], defTeam: teams[1 - rec.team], firstX: rec.firstX != null ? losX + dir * rec.firstX : null, left, right, losLabel: yardLabel(losX, left, right) };
}

const BEST = (r) => r.pts || r.turnover || r.flag || Math.abs(r.yards ?? 0) >= 20 || r.kind === 'sack';

const nfl = {
    sb: null,
    G: null,
    id: null,
    idx: -1,
    follow: true,
    best: false,
    timer: 0,
    poll: 0,
    sbPoll: 0,
    init() {
        this.player = new PlayerView($('#nfl-player'), {
            extra: `<button class="btn-round n-prev" aria-label="Jugada anterior" title="Jugada anterior">${I.prev}</button><button class="btn-round n-next" aria-label="Jugada siguiente" title="Jugada siguiente">${I.next}</button><button class="tog n-follow on" aria-pressed="true" title="Pasar sola a la siguiente jugada">${I.zap}<span>Seguir</span></button><button class="tog n-best" aria-pressed="false" title="Solo anotaciones, pérdidas, pañuelos y jugadas grandes">${I.star}<span>Lo mejor</span></button>`,
            steps: $('#nfl-steps'),
            summary: $('#nfl-summary'),
            onEnd: () => this.onEnd(),
            onEvent: (e) => this.onEvent(e),
            onUser: () => clearTimeout(this.timer)
        });
        $('.n-prev').onclick = () => this.step(-1);
        $('.n-next').onclick = () => this.step(1);
        const fol = $('.n-follow');
        fol.onclick = () => {
            this.follow = !this.follow;
            fol.classList.toggle('on', this.follow);
            fol.setAttribute('aria-pressed', this.follow);
            clearTimeout(this.timer);
            if (this.follow && !this.player.stage.playing) this.step(1);
        };
        const best = $('.n-best');
        best.onclick = () => {
            this.best = !this.best;
            best.classList.toggle('on', this.best);
            best.setAttribute('aria-pressed', this.best);
            this.renderPbp();
        };
        $('#nfl-games').addEventListener('click', (ev) => {
            const b = ev.target.closest('.g-card');
            if (b) this.open(b.dataset.id);
        });
        $('#nfl-pbp').addEventListener('click', (ev) => {
            const row = ev.target.closest('.pbp-row');
            if (!row) return;
            this.show(Number(row.dataset.n));
            $('#nfl-player').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        $('#nfl-start').onclick = () => {
            const i = this.G?.recs.findIndex((r) => r.spec && (!this.best || BEST(r)));
            if (i >= 0) this.show(i);
        };
        $('#nfl-prev-week').onclick = () => this.load(Math.max(1, (this.week || 1) - 1), this.stype);
        $('#nfl-next-week').onclick = () => this.load((this.week || 0) + 1, this.stype);
        $('#nfl-retry').onclick = () => this.load(this.week, this.stype);
        $('#nfl-practice').onclick = () => go('vivo');
        this.load();
    },
    async load(week, stype) {
        clearTimeout(this.sbPoll);
        $('#nfl-error').hidden = true;
        if (!this.sb) $('#nfl-games').innerHTML = '<div class="g-card skel"></div><div class="g-card skel"></div><div class="g-card skel"></div>';
        try {
            const sb = await getScoreboard({ week, seasontype: stype });
            this.sb = sb;
            this.week = sb.week?.number ?? week;
            this.stype = sb.season?.type ?? stype;
            $('#nfl-week').textContent = `${this.stype === 3 ? 'Playoffs · ' : this.stype === 1 ? 'Pretemporada · ' : ''}Semana ${this.week ?? '—'}`;
            this.renderGames();
            const evs = sb.events || [];
            if (!evs.length) {
                $('#nfl-game').hidden = true;
                $('#nfl-games').innerHTML = '<p class="empty">No hay juegos esta semana.</p>';
            } else if (!this.id || !evs.some((e) => e.id === this.id)) {
                const st = (e) => e.status?.type?.state;
                const pick = evs.find((e) => st(e) === 'in') || [...evs].reverse().find((e) => st(e) === 'post') || evs[0];
                this.open(pick.id);
            }
            if (evs.some((e) => e.status?.type?.state === 'in')) this.sbPoll = setTimeout(() => this.load(this.week, this.stype), 30000);
        } catch (err) {
            this.fail(err);
        }
    },
    fail() {
        $('#nfl-error').hidden = false;
        $('#nfl-error-msg').textContent = navigator.onLine
            ? 'No se pudieron cargar los juegos de la NFL. Si estás en la red de un trabajo o una escuela, puede que bloquee los datos deportivos: prueba con tus datos móviles o en otra red.'
            : 'Estás sin conexión. Los juegos de la NFL necesitan internet; la práctica y todas las animaciones funcionan igual.';
        if (!this.G) {
            $('#nfl-games').innerHTML = '';
            $('#nfl-game').hidden = true;
        }
    },
    renderGames() {
        const evs = this.sb?.events || [];
        $('#nfl-games').innerHTML = evs
            .map((e) => {
                const c = e.competitions?.[0]?.competitors || [];
                const away = c.find((x) => x.homeAway === 'away') || c[0];
                const home = c.find((x) => x.homeAway === 'home') || c[1];
                const st = e.status?.type?.state;
                const when = st === 'pre' ? new Date(e.date).toLocaleString('es', { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : statusEs(e.status.type.shortDetail || 'Final');
                const row = (x) => {
                    const t = { color: `#${x.team.color || '64748b'}`, logo: x.team.logo, abbr: x.team.abbreviation };
                    const lost = st === 'post' && Number(x.score) < Number((x === away ? home : away).score);
                    return `<span class="g-team ${lost ? 'lost' : ''}">${badge(t, 'sm')}<b>${esc(x.team.abbreviation)}</b><span class="g-score">${st === 'pre' ? '' : esc(x.score)}</span></span>`;
                };
                return `<button class="g-card ${st} ${e.id === this.id ? 'on' : ''}" data-id="${e.id}"><span class="g-status">${st === 'in' ? '<i class="dot"></i>' : ''}${esc(when)}</span>${row(away)}${row(home)}</button>`;
            })
            .join('');
    },
    async open(id) {
        clearTimeout(this.poll);
        clearTimeout(this.timer);
        this.id = id;
        this.G = null;
        $$('#nfl-games .g-card').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
        $('#nfl-game').hidden = false;
        $('#nfl-title').textContent = 'Cargando el juego…';
        $('#nfl-text').textContent = '';
        try {
            this.apply(await getSummary(id), true);
        } catch (err) {
            this.fail(err);
        }
    },
    apply(s, first) {
        const G = mapGame(s);
        const grew = this.G && G.recs.length > this.G.recs.length;
        this.G = G;
        if (first) {
            buildBoard($('#nfl-score'), G.teams);
            this.idx = -1;
        }
        const live = G.status.state === 'in';
        $('#nfl-live').hidden = !live;
        this.renderPbp();
        drawWp('nfl-wp', G.teams, G.recs.filter((r) => r.wp != null).map((r) => r.wp));
        if (G.status.state === 'pre' || !G.recs.length) {
            this.paint({ score: G.score, q: 'Previa', clock: new Date(G.status.date || Date.now()).toLocaleString('es', { weekday: 'long', hour: 'numeric', minute: '2-digit' }), down: `${G.teams[0].abbr} @ ${G.teams[1].abbr}`, spot: '', poss: -1 });
            $('#nfl-title').textContent = 'Todavía no empieza';
            $('#nfl-text').textContent = 'Cuando empiece, cada jugada aparece aquí animada. Mientras tanto mira la práctica o todas las animaciones.';
            $('#nfl-raw').textContent = '';
            $('#nfl-player').hidden = true;
            if (G.status.state === 'pre') this.poll = setTimeout(() => this.refresh(), 60000);
            return;
        }
        $('#nfl-player').hidden = false;
        if (first) {
            if (live) this.show(this.lastPlayable());
            else {
                const i = G.recs.findIndex((r) => r.spec);
                this.show(i >= 0 ? i : 0);
            }
        } else if (grew && this.follow && !this.player.stage.playing) this.step(1);
        if (live) this.poll = setTimeout(() => this.refresh(), 15000);
    },
    async refresh() {
        if (!this.id) return;
        try {
            this.apply(await getSummary(this.id), false);
        } catch {
            this.poll = setTimeout(() => this.refresh(), 30000);
        }
    },
    lastPlayable() {
        for (let i = this.G.recs.length - 1; i >= 0; i--) if (this.G.recs[i].spec) return i;
        return this.G.recs.length - 1;
    },
    paint(v) {
        paintBoard($('#nfl-score'), v);
    },
    stateOf(r, which) {
        return { score: r[which].score, q: qName(r.q), clock: r.clock, down: r.downText || '', spot: r.spot || '', poss: r.spec && !/kickoff|onside|timeout/.test(r.kind) ? r.team : -1 };
    },
    step(d) {
        const recs = this.G?.recs || [];
        let i = this.idx + d;
        while (i >= 0 && i < recs.length && (!recs[i].spec || (this.best && !BEST(recs[i])))) {
            if (recs[i].sep && d > 0 && !this.best) {
                this.idx = i;
                this.renderRowState();
                toast(recs[i].label);
            }
            i += d;
        }
        if (i >= 0 && i < recs.length) this.show(i);
    },
    show(i) {
        const r = this.G.recs[i];
        if (!r) return;
        clearTimeout(this.timer);
        this.idx = i;
        this.renderRowState();
        if (!r.spec) {
            $('#nfl-title').textContent = r.label;
            $('#nfl-text').textContent = r.es || '';
            $('#nfl-raw').textContent = r.raw || '';
            if (this.follow) this.timer = setTimeout(() => this.step(1), 1200);
            return;
        }
        const T = this.G.teams;
        const spec = { offR: roster(), defR: roster(), ...r.spec, ytg: r.spec.ytg ?? r.ytg ?? 75 };
        const play = buildPlay(spec);
        this.paint(this.stateOf(r, 'before'));
        this.player.show(play, nflView(r, T), { ...r, yards: r.yards });
        $('#nfl-title').innerHTML = `${esc(r.label)} <small>${esc(qName(r.q))} ${esc(r.clock)}${r.downText ? ` · ${esc(r.downText)}` : ''}${r.spot ? ` · ${esc(r.spot)}` : ''}</small>`;
        $('#nfl-text').textContent = r.es || '';
        $('#nfl-raw').textContent = r.raw ? `Texto oficial: ${r.raw}` : '';
        this.player.start();
    },
    renderRowState() {
        $$('#nfl-pbp .pbp-row').forEach((x) => x.classList.toggle('active', Number(x.dataset.n) === this.idx));
    },
    onEvent(e) {
        const r = this.G?.recs[this.idx];
        if (e.type === 'score' && r?.pts) this.paint({ ...this.stateOf(r, 'before'), score: r.after.score, pop: r.pts });
    },
    onEnd() {
        const r = this.G?.recs[this.idx];
        if (r) this.paint(this.stateOf(r, 'after'));
        if (this.follow && liveTab() === 'nfl' && !document.hidden) this.timer = setTimeout(() => this.step(1), 900 / Math.max(0.5, this.player.stage.speed));
    },
    renderPbp() {
        const G = this.G;
        if (!G) return;
        const groups = new Map();
        for (const r of G.recs) {
            if (!groups.has(r.drive)) groups.set(r.drive, []);
            groups.get(r.drive).push(r);
        }
        const html = [...groups.entries()]
            .reverse()
            .map(([di, recs]) => {
                const d = G.drives[di] || {};
                const team = G.teams[d.team ?? 0];
                const rows = [...recs]
                    .reverse()
                    .filter((r) => !this.best || BEST(r) || r.sep)
                    .map((r) =>
                        r.sep
                            ? `<div class="pbp-qe">${esc(r.label)}</div>`
                            : `<button class="pbp-row ${r.pts ? 'score' : ''} ${r.first ? 'first' : ''} ${r.n === this.idx ? 'active' : ''}" data-n="${r.n}"><span class="pbp-when"><b>${QSHORT[Math.min(r.q, 5)] || `${r.q}C`} ${esc(r.clock)}</b><span>${r.downText ? `${esc(r.downText)} · ` : ''}${esc(r.spot || '')}</span></span><span class="pbp-text"><span class="pbp-label">${esc(r.label)}${r.first ? ' · 1ª y 10' : ''}</span>${esc(r.es || r.raw)}</span>${pbpChip(r, G.teams)}</button>`
                    )
                    .join('');
                if (!rows) return '';
                return `<div class="drive" style="--c:${team.color}"><div class="drive-h">${badge(team, 'sm')}<b>${esc(team.name)}</b><span>${esc(d.desc || '')}</span><em class="${/Touchdown|Gol de campo/.test(d.result) ? 'good' : d.live ? 'live' : ''}">${esc(d.live ? 'En curso' : d.result || '')}</em></div>${rows}</div>`;
            })
            .join('');
        $('#nfl-pbp').innerHTML = html || '<p class="empty">Todavía no hay jugadas.</p>';
        $('#nfl-count').textContent = `${G.recs.filter((r) => r.spec).length} jugadas`;
    }
};

// ---------------------------------------------------------------- Práctica: juego simulado

const practiceBoard = $('#scoreboard');
buildBoard(practiceBoard, TEAMS);

function renderScore(s, pop) {
    const ytg = 100 - s.own;
    paintBoard(practiceBoard, {
        score: s.score,
        q: s.over ? 'Final' : QUARTER[s.q],
        clock: s.over ? (s.q === 5 ? 'Prórroga' : '—') : clockText(s.clock),
        down: s.over ? `${TEAMS[s.score[0] >= s.score[1] ? 0 : 1].name} ${s.score[0] === s.score[1] ? 'empatan' : 'ganan'}` : s.phase === 'kickoff' ? 'Patada inicial' : s.phase === 'pat' ? 'Punto extra' : `${s.down}ª y ${s.toGo >= ytg ? 'gol' : s.toGo}`,
        spot: s.phase === 'scrim' && !s.over ? live.game.spot(s.poss, s.own) : '',
        poss: s.phase === 'scrim' ? s.poss : -1,
        timeouts: s.timeouts,
        pop
    });
}

const live = {
    game: null,
    auto: true,
    current: null,
    replay: false,
    timer: 0,
    init() {
        this.player = new PlayerView($('#live-player'), {
            extra: `<button class="btn-round b-next" aria-label="Siguiente jugada" title="Siguiente jugada">${I.next}</button><button class="pill b-skip" title="Saltar hasta la próxima anotación">${I.fast}<span>Anotación</span></button><button class="tog b-auto on" aria-pressed="true" title="Jugar solo">${I.zap}<span>Auto</span></button>`,
            steps: $('#live-steps'),
            summary: $('#live-summary'),
            onEnd: () => this.onEnd(),
            onEvent: (e) => this.onEvent(e),
            onUser: () => clearTimeout(this.timer)
        });
        $('.b-next').onclick = () => this.next();
        $('.b-skip').onclick = () => this.skip();
        const auto = $('.b-auto');
        auto.onclick = () => {
            this.auto = !this.auto;
            auto.classList.toggle('on', this.auto);
            auto.setAttribute('aria-pressed', this.auto);
            clearTimeout(this.timer);
            if (this.auto && !this.player.stage.playing && this.current?.committed && !this.replay) this.next();
        };
        $('#pbp').addEventListener('click', (ev) => {
            const row = ev.target.closest('.pbp-row');
            if (!row) return;
            const rec = this.game.log.find((r) => r.n === Number(row.dataset.n));
            if (rec) this.show(rec, true);
            $('#live-player').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        $('#btn-new').onclick = () => this.newGame();
        $('#btn-new-final').onclick = () => this.newGame();
    },
    /** El juego de práctica arranca la primera vez que se abre */
    ensure() {
        if (!this.game) this.newGame();
    },
    newGame() {
        clearTimeout(this.timer);
        this.game = new Game();
        $('#final').hidden = true;
        renderScore(this.game.snapshot());
        this.renderLists();
        this.next();
    },
    commit() {
        const rec = this.current;
        if (!rec || rec.committed || this.replay) return;
        rec.committed = true;
        renderScore(rec.after);
        if (rec.quarterEnd) toast(rec.quarterEnd);
        this.renderLists();
        if (this.game.over) this.final();
    },
    next() {
        clearTimeout(this.timer);
        if (!this.replay) this.commit();
        if (this.game.over) return this.final();
        const rec = this.game.step();
        if (rec) this.show(rec, false);
    },
    skip() {
        clearTimeout(this.timer);
        if (!this.replay) this.commit();
        if (this.game.over) return;
        const recs = this.game.skipToScore();
        const last = recs.pop();
        for (const r of recs) r.committed = true;
        if (recs.length) {
            renderScore(recs[recs.length - 1].after);
            toast(`Se adelantaron ${recs.length} jugadas`);
        }
        this.renderLists();
        if (last) this.show(last, false);
    },
    show(rec, replay) {
        clearTimeout(this.timer);
        this.replay = replay;
        if (!replay && this.current && !this.current.committed) this.commit();
        this.current = rec;
        const play = buildPlay(rec.spec);
        if (!replay) renderScore(rec.before);
        this.player.show(play, rec.view, rec);
        $('#live-title').innerHTML = `${replay ? '<span class="tag-replay">Repetición</span>' : ''}${esc(rec.label)} <small>${QSHORT[rec.q]} ${clockText(rec.clock)}${rec.down ? ` · ${rec.down}` : ''} · ${esc(rec.spotText)}</small>`;
        $('#live-text').textContent = rec.text;
        $$('#pbp .pbp-row').forEach((r) => r.classList.toggle('active', Number(r.dataset.n) === rec.n));
        this.player.start();
    },
    onEvent(e) {
        if (e.type === 'score' && !this.replay && this.current?.pts) renderScore({ ...this.current.before, score: this.current.after.score }, this.current.pts);
    },
    onEnd() {
        if (this.replay) {
            this.replay = false;
            return;
        }
        this.commit();
        if (this.auto && !this.game.over && liveTab() === 'vivo' && !document.hidden) this.timer = setTimeout(() => this.next(), 1000 / Math.max(0.5, this.player.stage.speed));
    },
    final() {
        const s = this.game.snapshot();
        const w = s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1;
        const box = $('#final');
        box.hidden = false;
        box.style.setProperty('--c', w == null ? '#64748b' : TEAMS[w].color);
        $('#final-text').innerHTML = `${badge(TEAMS[0])}<b>${s.score[0]}</b><span>–</span><b>${s.score[1]}</b>${badge(TEAMS[1])}`;
        $('#final-sub').textContent = w == null ? 'Termina empatado' : `¡Ganan los ${TEAMS[w].name}!${s.q === 5 ? ' (en prórroga)' : ''}`;
        if (w != null) this.player.confetti([TEAMS[w].color, TEAMS[w].color2, '#fff']);
    },
    renderLists() {
        renderPbp();
        drawWp('wp', TEAMS, this.game.wpHist);
        renderPoints();
    }
};

function renderPbp() {
    const g = live.game;
    const done = g.log.filter((r) => r.committed);
    const groups = new Map();
    for (const r of done) {
        if (!groups.has(r.drive)) groups.set(r.drive, []);
        groups.get(r.drive).push(r);
    }
    const html = [...groups.entries()]
        .reverse()
        .map(([id, recs]) => {
            const d = g.drives[id - 1];
            const team = TEAMS[d ? d.team : recs[0].team];
            const head = d ? `<b>${esc(team.name)}</b><span>${d.plays} jugadas · ${d.yards} yd · ${clockText(d.secs)}</span><em class="${/Touchdown|Gol de campo/.test(d.result) ? 'good' : d.result ? '' : 'live'}">${esc(d.result || 'En curso')}</em>` : `<b>${esc(team.name)}</b>`;
            const rows = [...recs]
                .reverse()
                .map((r) => {
                    const qe = r.quarterEnd ? `<div class="pbp-qe">${esc(r.quarterEnd)}</div>` : '';
                    return `${qe}<button class="pbp-row ${r.pts ? 'score' : ''} ${r.first ? 'first' : ''}" data-n="${r.n}"><span class="pbp-when"><b>${QSHORT[r.q]} ${clockText(r.clock)}</b><span>${r.down ? `${esc(r.down)} · ` : ''}${esc(r.spotText)}</span></span><span class="pbp-text"><span class="pbp-label">${esc(r.label)}${r.first ? ' · 1ª y 10' : ''}</span>${esc(r.text)}</span>${pbpChip(r, TEAMS)}</button>`;
                })
                .join('');
            return `<div class="drive" style="--c:${team.color}"><div class="drive-h">${badge(team, 'sm')}${head}</div>${rows}</div>`;
        })
        .join('');
    $('#pbp').innerHTML = html || '<p class="empty">Las jugadas aparecen aquí cuando terminan. Toca una para verla otra vez.</p>';
    $('#pbp-count').textContent = `${done.length} jugadas`;
}

// ---------------------------------------------------------------- Puntos: cómo se anota, marcador por cuarto, anotaciones y estadísticas

let ptsPlayer;
function initPoints() {
    ptsPlayer = new PlayerView($('#pts-player'), { steps: $('#pts-steps') });
    $('#scoring').innerHTML = SCORING.map(
        (s, i) => `<button class="score-card ${i === 0 ? 'on' : ''}" data-i="${i}">
  <span class="sc-n">${s.n}</span>
  <span class="sc-body"><b>${esc(s.title)}</b><small>${esc(s.who)} · ${esc(s.desc)}</small></span>
  <span class="sc-go">${I.play}</span>
</button>`
    ).join('');
    $('#scoring').addEventListener('click', (ev) => {
        const b = ev.target.closest('.score-card');
        if (!b) return;
        $$('.score-card').forEach((x) => x.classList.toggle('on', x === b));
        showScoring(SCORING[Number(b.dataset.i)]);
        $('#pts-player').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#pts-now').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-also]');
        if (b) playCatalog(ptsPlayer, b.dataset.also, $('#pts-now'));
    });
}
function showScoring(s) {
    playCatalog(ptsPlayer, s.play, $('#pts-now'));
    if (s.also) $('#pts-now').insertAdjacentHTML('beforeend', ` <button class="link" data-also="${s.also}">Ver otra forma</button>`);
}

function renderPoints() {
    const g = live.game;
    if (!g) {
        $('#linescore').innerHTML = '';
        $('#scoring-plays').innerHTML = '<p class="empty">Abre la pestaña Práctica para jugar un juego simulado.</p>';
        $('#stats').innerHTML = '';
        return;
    }
    const qs = g.q === 5 || g.byQ[0][4] || g.byQ[1][4] ? 5 : 4;
    $('#linescore').innerHTML = `<thead><tr><th></th>${Array.from({ length: qs }, (_, i) => `<th>${i === 4 ? 'OT' : i + 1}</th>`).join('')}<th>T</th></tr></thead><tbody>${TEAMS.map((t, i) => `<tr><td>${badge(t, 'sm')}<b>${t.abbr}</b></td>${g.byQ[i].slice(0, qs).map((n, k) => `<td class="${k + 1 > g.q && !g.over ? 'mute' : ''}">${k + 1 > g.q && !g.over ? '–' : n}</td>`).join('')}<td class="tot">${g.score[i]}</td></tr>`).join('')}</tbody>`;
    const scores = g.log.filter((r) => r.committed && r.pts);
    $('#scoring-plays').innerHTML = scores.length
        ? scores
              .map((r) => {
                  const t = TEAMS[r.pts.team];
                  return `<div class="sp-row" style="--c:${t.color}">${badge(t, 'sm')}<span class="sp-when">${QSHORT[r.q]} ${clockText(r.clock)}</span><span class="sp-text">${esc(r.text)}</span><span class="sp-score">${r.after.score[0]}–${r.after.score[1]}</span></div>`;
              })
              .join('')
        : '<p class="empty">Todavía nadie anota en la práctica.</p>';
    const st = g.stats;
    const rows = [
        ['Yardas totales', st[0].yards, st[1].yards],
        ['Por pase', st[0].pass, st[1].pass],
        ['Por tierra', st[0].rush, st[1].rush],
        ['Primeros downs', st[0].first, st[1].first],
        ['Pérdidas de balón', st[0].to, st[1].to],
        ['Sacks hechos', st[0].sacks, st[1].sacks],
        ['Pañuelos (yardas)', st[0].pen, st[1].pen, `${st[0].pen} (${st[0].penYds})`, `${st[1].pen} (${st[1].penYds})`],
        ['Posesión', st[0].top, st[1].top, clockText(st[0].top), clockText(st[1].top)]
    ];
    $('#stats').innerHTML = `<div class="st-head">${badge(TEAMS[0], 'sm')}<b>${TEAMS[0].abbr}</b><span></span><b>${TEAMS[1].abbr}</b>${badge(TEAMS[1], 'sm')}</div>${rows
        .map(([k, a, b, la, lb]) => {
            const tot = Math.max(1, Math.abs(a) + Math.abs(b));
            return `<div class="st-row"><span class="st-v">${la ?? a}</span><div class="st-bars"><span class="st-k">${k}</span><div class="st-bar"><i style="--c:${TEAMS[0].color};width:${(Math.abs(a) / tot) * 100}%"></i><i style="--c:${TEAMS[1].color};width:${(Math.abs(b) / tot) * 100}%"></i></div></div><span class="st-v">${lb ?? b}</span></div>`;
        })
        .join('')}`;
}

// ---------------------------------------------------------------- Jugadas: todas las animaciones

const hashId = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

function catalogPlay(item) {
    const own = item.own;
    const ytg = item.spec.ytg ?? 100 - own;
    const losX = 10 + own;
    const spec = { offR: TEAMS[0].roster, defR: TEAMS[1].roster, seed: hashId(item.id), ytg, ...item.spec };
    const firstX = item.down && item.toGo < ytg ? losX + item.toGo : null;
    const view = { losX, dir: 1, offTeam: TEAMS[0], defTeam: TEAMS[1], firstX, left: TEAMS[0], right: TEAMS[1], losLabel: yardLabel(losX, TEAMS[0], TEAMS[1]) };
    return { play: buildPlay(spec), view, meta: { yards: item.spec.gain ?? null, pts: item.pts ? { n: item.pts.n, team: item.pts.who === 'defensa' ? 1 : 0 } : null } };
}

function playCatalog(player, id, infoEl) {
    const item = CATALOG.find((c) => c.id === id);
    if (!item) return;
    const { play, view, meta } = catalogPlay(item);
    player.show(play, view, meta);
    player.start();
    if (infoEl) {
        const cat = CATS.find((c) => c.id === item.cat);
        const sit = item.down ? `${item.down}ª y ${item.toGo} · ${view.losLabel}` : view.losLabel;
        infoEl.innerHTML = `<div class="now-top"><span class="chip">${esc(cat.name)}</span>${item.pts ? `<span class="chip gold">+${item.pts.n} ${item.pts.who}</span>` : ''}${item.spec.penalty ? `<span class="chip flag">${I.flagFill} ${esc(FOULS[item.spec.penalty.code].name)}</span>` : ''}<span class="chip ghost">${esc(sit)}</span></div><h2>${esc(item.title)}</h2><p>${esc(item.desc)}</p>`;
    }
}

let catPlayer;
let catFilter = 'all';
function initCatalog() {
    catPlayer = new PlayerView($('#cat-player'), { steps: $('#cat-steps'), summary: $('#cat-summary') });
    $('#cat-count').textContent = `${CATALOG.length} animaciones`;
    $('#cat-chips').innerHTML = [{ id: 'all', name: 'Todas' }, ...CATS].map((c) => `<button class="chip-btn ${c.id === 'all' ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)} <small>${c.id === 'all' ? CATALOG.length : CATALOG.filter((x) => x.cat === c.id).length}</small></button>`).join('');
    $('#cat-chips').addEventListener('click', (ev) => {
        const b = ev.target.closest('.chip-btn');
        if (!b) return;
        catFilter = b.dataset.cat;
        $$('#cat-chips .chip-btn').forEach((x) => x.classList.toggle('on', x === b));
        renderCatList();
    });
    $('#cat-list').addEventListener('click', (ev) => {
        const b = ev.target.closest('.cat-item');
        if (b) selectCatalog(b.dataset.id, true);
    });
    renderCatList();
}
function renderCatList() {
    $('#cat-list').innerHTML = CATS.filter((c) => catFilter === 'all' || c.id === catFilter)
        .map(
            (c) =>
                `<div class="cat-group"><h3>${esc(c.name)}</h3><div class="cat-grid">${CATALOG.filter((x) => x.cat === c.id)
                    .map(
                        (x) =>
                            `<button class="cat-item ${x.id === catPlayer.currentId ? 'on' : ''}" data-id="${x.id}"><span class="ci-n">${CATALOG.indexOf(x) + 1}</span><span class="ci-body"><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></span>${x.pts ? `<span class="chip gold">+${x.pts.n}</span>` : x.spec.penalty || x.id === 'challenge' ? `<span class="chip flag">${I.flagFill}</span>` : ''}</button>`
                    )
                    .join('')}</div></div>`
        )
        .join('');
}
function selectCatalog(id, scroll) {
    catPlayer.currentId = id;
    playCatalog(catPlayer, id, $('#cat-now'));
    $$('.cat-item').forEach((x) => x.classList.toggle('on', x.dataset.id === id));
    if (scroll) $('#tab-jugadas').scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#jugadas/${id}`);
}

// ---------------------------------------------------------------- Guía

function initGuide() {
    const svgEl = staticField($('#guide-field'), TEAMS[0], TEAMS[1]);
    const notes = [
        [5, 8, 1],
        [10, 47, 2],
        [30, 44, 3],
        [60, 9, 4],
        [43, 23.6, 5],
        [-1.6, FW / 2 - 6, 6],
        [36, 33, 7],
        [46, 33, 8],
        [100, 6, 9],
        [80, -1.6, 10]
    ];
    let s = `<g class="g-lines"><rect x="35.84" y="0" width="0.32" height="${FW}" fill="#60a5fa"/><rect x="45.84" y="0" width="0.32" height="${FW}" fill="#facc15"/><path d="M90 ${FW + 1.6}H110" stroke="#ff4d6a" stroke-width="0.5"/><path d="M90 ${FW + 0.9}v1.4M110 ${FW + 0.9}v1.4" stroke="#ff4d6a" stroke-width="0.5"/></g>`;
    for (const [x, y, n] of notes) s += `<g class="g-note"><circle cx="${x}" cy="${y}" r="1.9"/><text x="${x}" y="${y + 0.75}">${n}</text></g>`;
    svgEl.insertAdjacentHTML('beforeend', s);

    $('#guide-legend').innerHTML = [
        ['Zona de anotación', '10 yardas al final de cada lado. Si llevas el balón ahí: touchdown (6). Se pinta con el color del equipo que la defiende.'],
        ['Línea de gol', 'El borde de la zona de anotación: basta con que el balón la cruce.'],
        ['Líneas de yardas', 'Una cada 5 yardas y un número cada 10. Se cuentan desde cada línea de gol hasta el 50.'],
        ['Medio campo (50)', 'La mitad: de aquí para allá es territorio rival.'],
        ['Marcas hash', 'Las rayitas del centro: el balón siempre se pone entre ellas para empezar cada jugada.'],
        ['Postes', 'Al fondo de cada zona. El gol de campo y el punto extra pasan entre ellos y por encima del travesaño.'],
        ['Línea de golpeo (azul)', 'Donde está el balón antes del snap. Nadie puede cruzarla antes de que empiece la jugada.'],
        ['Línea de primera (amarilla)', 'Hasta dónde hay que llegar para conseguir otra primera y 10.'],
        ['Zona roja', 'Las últimas 20 yardas antes de la zona de anotación: ahí es más fácil anotar.'],
        ['Bandas', 'Los lados del campo. Si el que lleva el balón pisa fuera, la jugada termina y el reloj se para.']
    ]
        .map(([t, d], i) => `<li><span class="gn">${i + 1}</span><span><b>${esc(t)}</b>${esc(d)}</span></li>`)
        .join('');

    $('#settings-theme').innerHTML = [
        ['auto', 'Automático'],
        ['light', 'Claro'],
        ['dark', 'Oscuro']
    ]
        .map(([v, l]) => `<button data-v="${v}" class="${settings.theme === v ? 'on' : ''}">${l}</button>`)
        .join('');
    $('#settings-theme').onclick = (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        settings.theme = b.dataset.v;
        saveSettings();
        applyTheme();
        $$('#settings-theme button').forEach((x) => x.classList.toggle('on', x === b));
    };
    $('#settings-speed').innerHTML = [0.5, 1, 2].map((v) => `<button data-v="${v}" class="${settings.speed === v ? 'on' : ''}">${v}×</button>`).join('');
    $('#settings-speed').onclick = (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        settings.speed = Number(b.dataset.v);
        saveSettings();
        $$('#settings-speed button').forEach((x) => x.classList.toggle('on', x === b));
        for (const p of allPlayers()) p.setSpeed(settings.speed);
    };
    for (const [id, key] of [
        ['#set-piz', 'pizarra'],
        ['#set-vib', 'vibrate']
    ]) {
        const el = $(id);
        el.checked = settings[key];
        el.onchange = () => {
            settings[key] = el.checked;
            saveSettings();
            if (key === 'pizarra') for (const p of allPlayers()) p.setPizarra(el.checked);
        };
    }
    $('#btn-new2').onclick = () => {
        go('vivo');
        live.newGame();
    };
}

// ---------------------------------------------------------------- Pestañas, avisos e instalación

function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
}

const TABS = ['nfl', 'vivo', 'jugadas', 'puntos', 'guia'];
const liveTab = () => $('.tab.active')?.id.replace('tab-', '');
const PLAYERS = () => ({ nfl: nfl.player, vivo: live.player, jugadas: catPlayer, puntos: ptsPlayer });
const allPlayers = () => Object.values(PLAYERS());

function go(tab, sub) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${tab}`));
    $$('.tabbar button').forEach((b) => {
        b.classList.toggle('on', b.dataset.tab === tab);
        b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
    });
    for (const [k, p] of Object.entries(PLAYERS())) if (k !== tab) p.pause();
    clearTimeout(nfl.timer);
    clearTimeout(live.timer);
    if (tab === 'vivo') {
        if (!live.game) live.newGame();
        else if (live.auto && live.current?.committed && !live.player.stage.playing) live.next();
    }
    if (tab === 'nfl' && nfl.follow && nfl.G && !nfl.player.stage.playing) nfl.step(1);
    if (tab === 'jugadas') selectCatalog(sub && CATALOG.some((c) => c.id === sub) ? sub : catPlayer.currentId || 'pass-deep', false);
    if (tab === 'puntos') {
        renderPoints();
        if (!ptsPlayer.stage.play) showScoring(SCORING[0]);
    }
    if (tab !== 'jugadas') history.replaceState(null, '', `#${tab}`);
    window.scrollTo({ top: 0 });
}
$('.tabbar').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-tab]');
    if (b) go(b.dataset.tab);
});
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    clearTimeout(live.timer);
    clearTimeout(nfl.timer);
});

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    $$('.b-install').forEach((b) => (b.hidden = false));
});
$$('.b-install').forEach(
    (b) =>
        (b.onclick = async () => {
            if (!deferredInstall) return;
            deferredInstall.prompt();
            await deferredInstall.userChoice;
            deferredInstall = null;
            $$('.b-install').forEach((x) => (x.hidden = true));
        })
);
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone) $('#ios-hint').hidden = false;

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.search.includes('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});

// Arranque
live.init();
initCatalog();
initPoints();
initGuide();
nfl.init();
const route = () => {
    const [tab, sub] = location.hash.replace('#', '').split('/');
    if (!TABS.includes(tab)) return;
    if (!$(`#tab-${tab}`).classList.contains('active')) go(tab, sub);
    else if (tab === 'jugadas' && sub && sub !== catPlayer.currentId) selectCatalog(sub, false);
};
window.addEventListener('hashchange', route);
route();
window.elSnap = { live, nfl, players: PLAYERS };
