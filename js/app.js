// El Snap: la app. Juego en vivo simulado, todas las animaciones, cómo se anota y la guía del terreno.
import { buildPlay, FOULS } from './plays.js';
import { Stage, staticField, yardLabel, LOGO_PATHS, FW } from './field.js';
import { Game, TEAMS, QUARTER, QSHORT, clockText } from './game.js';
import { CATALOG, CATS, SCORING } from './catalog.js';

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
const vibrate = (p) => settings.vibrate && navigator.vibrate?.(p);

// ---------------------------------------------------------------- Íconos

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
    play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
    pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor"/>'),
    replay: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    next: svg('<path d="M5 4.5v15l10-7.5z" fill="currentColor"/><path d="M19 5v14"/>'),
    fast: svg('<path d="M13 19l9-7-9-7z" fill="currentColor"/><path d="M2 19l9-7-9-7z" fill="currentColor"/>'),
    zap: svg('<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>'),
    pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    max: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'),
    live: svg('<circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/>'),
    ball: svg('<ellipse cx="12" cy="12" rx="9.5" ry="5.6" transform="rotate(-35 12 12)"/><path d="M9.5 14.5l5-5M10.6 11.2l2.2 2.2M12.1 9.7l2.2 2.2M9.1 12.7l2.2 2.2"/>'),
    trophy: svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.2.6 2 2 2 3.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>'),
    book: svg('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'),
    flag: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>'),
    flagFill: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><path d="M4 22v-7"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    tv: svg('<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>')
};

const EMBLEM = {
    shark: '<path d="M3 17.5c3.2-.4 6.3-2.6 8-6.6l1.5-6.4c1.4 3.4 3.6 7.7 8.5 13z" fill="#fff"/><path d="M2 20.6c1.7-1.2 3.3-1.2 5 0s3.3 1.2 5 0 3.3-1.2 5 0 3.3 1.2 5 0" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    volcano: '<path d="M2.5 20.6 8.6 9.8h6.8l6.1 10.8z" fill="#fff"/><path d="M12 6.4V3.4M8.7 7 7.3 4.8M15.3 7l1.4-2.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>'
};
const emblem = (t) => `<svg viewBox="0 0 24 24" aria-hidden="true">${EMBLEM[t.emblem]}</svg>`;
const badge = (t, cls = '') => `<span class="badge ${cls}" style="--c:${t.color}">${emblem(t)}</span>`;
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
        piz.onclick = () => {
            this.stage.pizarra = !this.stage.pizarra;
            piz.classList.toggle('on', this.stage.pizarra);
            piz.setAttribute('aria-pressed', this.stage.pizarra);
            this.stage.render(true);
        };
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
    show(play, view, meta = {}) {
        this.view = view;
        this.meta = meta;
        this.clearOverlay();
        const key = `${view.left.id}${view.right.id}`;
        if (this.teamsKey !== key) {
            this.stage.setTeams(view.left, view.right);
            this.teamsKey = key;
        }
        this.stage.load(play, view);
        $('.teams-legend', this.root).innerHTML = `<span><i style="background:${view.offTeam.color}"></i>${esc(view.offTeam.abbr)} con el balón</span><span><i style="background:${view.defTeam.color}"></i>${esc(view.defTeam.abbr)}</span><span><i class="ref"></i>Árbitros</span>`;
        // Marcas en la barra de tiempo
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
        if (on && this.o.followSteps !== false && list.scrollHeight > list.clientHeight) list.scrollTo({ top: on.offsetTop - list.clientHeight / 2, behavior: 'smooth' });
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
        if (meta.pts) chips.push(['Puntos', `+${meta.pts.n} ${TEAMS[meta.pts.team]?.abbr ?? ''}`]);
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
        const icon = style === 'flag' ? I.flagFill : style === 'challenge' ? I.flagFill : style === 'review' ? I.tv : style === 'neutral' ? I.clock : team ? emblem(team) : I.ball;
        const kicker = style === 'flag' ? `Contra ${team ? team.name : ''}` : style === 'neutral' || style === 'review' || style === 'challenge' ? 'Árbitro' : team?.name ?? '';
        const el = document.createElement('div');
        el.className = `pa-card ${style} k-${e.kind}`;
        if (team) el.style.cssText = `--team:${team.color};--team2:${team.color2}`;
        el.innerHTML = `<div class="pa-stripes"></div><div class="pa-shine"></div><div class="pa-badge">${icon}</div><div class="pa-body"><div class="pa-kicker">${esc(kicker)}</div><div class="pa-title">${esc(e.title)}</div>${e.sub ? `<div class="pa-sub">${esc(e.sub)}</div>` : ''}${e.signal ? `<div class="pa-sig">Señal: ${esc(e.signal)}</div>` : ''}</div>${e.pts ? `<div class="pa-pts">+${e.pts}</div>` : ''}`;
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

// ---------------------------------------------------------------- Marcador

function odo(el, value) {
    const s = String(value);
    if (el.childElementCount !== s.length) el.innerHTML = s.split('').map(() => `<span class="od"><span class="od-s">${[...'0123456789'].map((d) => `<b>${d}</b>`).join('')}</span></span>`).join('');
    [...el.children].forEach((c, i) => (c.firstChild.style.transform = `translateY(${-Number(s[i]) * 10}%)`));
}

const scoreboard = $('#scoreboard');
scoreboard.innerHTML = `
${TEAMS.map(
    (t, i) => `<div class="sb-team" data-i="${i}" style="--c:${t.color}">
  <div class="sb-stripes"></div>
  <div class="sb-row">${badge(t, 'lg')}<span class="sb-poss" title="Tiene el balón">${I.ball}</span></div>
  <div class="sb-name">${esc(t.name)}<small>${esc(t.city)}</small></div>
  <div class="sb-score"><span class="odo" aria-label="Puntos de ${esc(t.name)}"></span><span class="sb-plus"></span></div>
  <div class="sb-tos" title="Tiempos fuera"><i></i><i></i><i></i></div>
</div>`
).join('')}
<div class="sb-mid">
  <div class="sb-q"></div>
  <div class="sb-clock"></div>
  <div class="sb-down"></div>
  <div class="sb-spot"></div>
</div>`;
scoreboard.append($('.sb-mid', scoreboard));
scoreboard.insertBefore($('.sb-mid', scoreboard), $('.sb-team[data-i="1"]', scoreboard));

function renderScore(s, ctx = {}) {
    TEAMS.forEach((t, i) => {
        const el = $(`.sb-team[data-i="${i}"]`, scoreboard);
        odo($('.odo', el), s.score[i]);
        el.classList.toggle('has', s.poss === i && s.phase === 'scrim');
        $$('.sb-tos i', el).forEach((d, k) => d.classList.toggle('used', k >= s.timeouts[i]));
    });
    $('.sb-q', scoreboard).textContent = s.over ? 'Final' : QUARTER[s.q];
    $('.sb-clock', scoreboard).textContent = s.over ? (s.q === 5 ? 'Prórroga' : '—') : clockText(s.clock);
    const ytg = 100 - s.own;
    $('.sb-down', scoreboard).textContent = s.over ? `${TEAMS[s.score[0] >= s.score[1] ? 0 : 1].name} ${s.score[0] === s.score[1] ? 'empatan' : 'ganan'}` : s.phase === 'kickoff' ? 'Patada inicial' : s.phase === 'pat' ? 'Punto extra' : `${s.down}ª y ${s.toGo >= ytg ? 'gol' : s.toGo}`;
    $('.sb-spot', scoreboard).textContent = s.phase === 'scrim' && !s.over ? live.game.spot(s.poss, s.own) : '';
    if (ctx.pop) {
        const el = $(`.sb-team[data-i="${ctx.pop.team}"] .sb-plus`, scoreboard);
        el.textContent = `+${ctx.pop.n}`;
        el.classList.remove('go');
        void el.offsetWidth;
        el.classList.add('go');
        $(`.sb-team[data-i="${ctx.pop.team}"]`, scoreboard).classList.remove('flash');
        void scoreboard.offsetWidth;
        $(`.sb-team[data-i="${ctx.pop.team}"]`, scoreboard).classList.add('flash');
    }
}

// ---------------------------------------------------------------- En vivo

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
        $('#wp-ta').innerHTML = badge(TEAMS[0], 'sm');
        $('#wp-tb').innerHTML = badge(TEAMS[1], 'sm');
        this.newGame();
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
        $$('.pbp-row').forEach((r) => r.classList.toggle('active', Number(r.dataset.n) === rec.n));
        this.player.start();
    },
    onEvent(e) {
        if (e.type === 'score' && !this.replay && this.current?.pts) renderScore({ ...this.current.before, score: this.current.after.score }, { pop: this.current.pts });
    },
    onEnd() {
        if (this.replay) {
            this.replay = false;
            return;
        }
        this.commit();
        if (this.auto && !this.game.over && liveVisible()) this.timer = setTimeout(() => this.next(), 1000 / Math.max(0.5, this.player.stage.speed));
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
        renderWp();
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
                    const chip = r.pts ? `<span class="chip gold">+${r.pts.n} ${TEAMS[r.pts.team].abbr}</span>` : r.flag ? `<span class="chip flag">${I.flagFill}</span>` : r.turnover ? '<span class="chip live">Cambio</span>' : r.yards != null && !r.special ? `<span class="chip ${r.yards > 0 ? 'up' : r.yards < 0 ? 'down' : ''}">${r.yards > 0 ? '+' : ''}${r.yards}</span>` : '';
                    const qe = r.quarterEnd ? `<div class="pbp-qe">${esc(r.quarterEnd)}</div>` : '';
                    return `${qe}<button class="pbp-row ${r.pts ? 'score' : ''} ${r.first ? 'first' : ''}" data-n="${r.n}"><span class="pbp-when"><b>${QSHORT[r.q]} ${clockText(r.clock)}</b><span>${r.down ? `${esc(r.down)} · ` : ''}${esc(r.spotText)}</span></span><span class="pbp-text"><span class="pbp-label">${esc(r.label)}${r.first ? ' · 1ª y 10' : ''}</span>${esc(r.text)}</span>${chip}</button>`;
                })
                .join('');
            return `<div class="drive" style="--c:${team.color}"><div class="drive-h">${badge(team, 'sm')}${head}</div>${rows}</div>`;
        })
        .join('');
    $('#pbp').innerHTML = html || '<p class="empty">Las jugadas aparecen aquí cuando terminan. Toca una para verla otra vez.</p>';
    $('#pbp-count').textContent = `${done.length} jugadas`;
}

function renderWp() {
    const g = live.game;
    const hist = g.wpHist;
    const p = hist[hist.length - 1];
    $('#wp-a').style.width = `${p * 100}%`;
    $('#wp-pa').textContent = `${Math.round(p * 100)}%`;
    $('#wp-pb').textContent = `${100 - Math.round(p * 100)}%`;
    const W = 300;
    const H = 64;
    const pts = hist.map((v, i) => `${((i / Math.max(1, hist.length - 1)) * W).toFixed(1)},${(H - v * H).toFixed(1)}`).join(' ');
    $('#wp-chart').innerHTML = `<defs><clipPath id="wpTop"><rect x="0" y="0" width="${W}" height="${H / 2}"/></clipPath><clipPath id="wpBot"><rect x="0" y="${H / 2}" width="${W}" height="${H / 2}"/></clipPath></defs>
<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="wp-mid"/>
<polyline points="${pts}" fill="none" stroke="${TEAMS[0].color}" stroke-width="2.2" clip-path="url(#wpTop)" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
<polyline points="${pts}" fill="none" stroke="${TEAMS[1].color}" stroke-width="2.2" clip-path="url(#wpBot)" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
}

// ---------------------------------------------------------------- Puntos: cómo se anota, marcador por cuarto, anotaciones y estadísticas

let ptsPlayer;
function initPoints() {
    ptsPlayer = new PlayerView($('#pts-player'), { steps: $('#pts-steps'), summary: null, followSteps: false });
    $('#scoring').innerHTML = SCORING.map(
        (s, i) => `<button class="score-card ${i === 0 ? 'on' : ''}" data-play="${s.play}" data-i="${i}">
  <span class="sc-n">${s.n}</span>
  <span class="sc-body"><b>${esc(s.title)}</b><small>${esc(s.who)} · ${esc(s.desc)}</small></span>
  <span class="sc-go">${I.play}</span>
</button>`
    ).join('');
    $('#scoring').addEventListener('click', (ev) => {
        const b = ev.target.closest('.score-card');
        if (!b) return;
        $$('.score-card').forEach((x) => x.classList.toggle('on', x === b));
        const s = SCORING[Number(b.dataset.i)];
        playCatalog(ptsPlayer, s.play, $('#pts-now'));
        if (s.also) $('#pts-now').insertAdjacentHTML('beforeend', ` <button class="link" data-also="${s.also}">Ver otra forma</button>`);
        $('#pts-player').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#pts-now').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-also]');
        if (b) playCatalog(ptsPlayer, b.dataset.also, $('#pts-now'));
    });
}

function renderPoints() {
    const g = live.game;
    if (!g) return;
    const qs = g.q === 5 || g.byQ[0][4] || g.byQ[1][4] ? 5 : 4;
    $('#linescore').innerHTML = `<thead><tr><th></th>${Array.from({ length: qs }, (_, i) => `<th>${i === 4 ? 'OT' : i + 1}</th>`).join('')}<th>T</th></tr></thead><tbody>${TEAMS.map((t, i) => `<tr><td>${badge(t, 'sm')}<b>${t.abbr}</b></td>${g.byQ[i].slice(0, qs).map((n, k) => `<td class="${k + 1 > g.q && !g.over ? 'mute' : ''}">${k + 1 > g.q && !g.over ? '–' : n}</td>`).join('')}<td class="tot">${g.score[i]}</td></tr>`).join('')}</tbody>`;
    const scores = g.log.filter((r) => r.committed && r.pts);
    $('#scoring-plays').innerHTML = scores.length
        ? scores
              .map((r) => {
                  const t = TEAMS[r.pts.team];
                  return `<button class="sp-row" data-n="${r.n}" style="--c:${t.color}">${badge(t, 'sm')}<span class="sp-when">${QSHORT[r.q]} ${clockText(r.clock)}</span><span class="sp-text">${esc(r.text)}</span><span class="sp-score">${r.after.score[0]}–${r.after.score[1]}</span></button>`;
              })
              .join('')
        : '<p class="empty">Todavía nadie anota en el juego en vivo.</p>';
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
    const down = item.down;
    const firstX = down && item.toGo < ytg ? losX + item.toGo : null;
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
        if (!b) return;
        selectCatalog(b.dataset.id, true);
    });
    renderCatList();
}
function renderCatList() {
    let n = 0;
    $('#cat-list').innerHTML = CATS.filter((c) => catFilter === 'all' || c.id === catFilter)
        .map(
            (c) => `<div class="cat-group"><h3>${esc(c.name)}</h3><div class="cat-grid">${CATALOG.filter((x) => x.cat === c.id)
                .map((x) => {
                    n++;
                    return `<button class="cat-item ${x.id === catPlayer.currentId ? 'on' : ''}" data-id="${x.id}"><span class="ci-n">${CATALOG.indexOf(x) + 1}</span><span class="ci-body"><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></span>${x.pts ? `<span class="chip gold">+${x.pts.n}</span>` : x.spec.penalty || x.id === 'challenge' ? `<span class="chip flag">${I.flagFill}</span>` : ''}</button>`;
                })
                .join('')}</div></div>`
        )
        .join('');
    void n;
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
        for (const p of [live.player, catPlayer, ptsPlayer]) p.setSpeed(settings.speed);
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
            if (key === 'pizarra')
                for (const p of [live.player, catPlayer, ptsPlayer]) {
                    p.stage.pizarra = el.checked;
                    $('.b-piz', p.root).classList.toggle('on', el.checked);
                    p.stage.render(true);
                }
        };
    }
    $('#btn-new2').onclick = () => {
        live.newGame();
        go('vivo');
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

const liveVisible = () => $('#tab-vivo').classList.contains('active') && !document.hidden;
const PLAYERS = () => ({ vivo: live.player, jugadas: catPlayer, puntos: ptsPlayer });

function go(tab, sub) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${tab}`));
    $$('.tabbar button').forEach((b) => {
        b.classList.toggle('on', b.dataset.tab === tab);
        b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
    });
    for (const [k, p] of Object.entries(PLAYERS())) if (k !== tab) p.pause();
    if (tab === 'vivo' && live.auto && live.current?.committed && !live.player.stage.playing) live.next();
    if (tab === 'jugadas') selectCatalog(sub && CATALOG.some((c) => c.id === sub) ? sub : catPlayer.currentId || 'pass-deep', false);
    if (tab === 'puntos' && !ptsPlayer.stage.play) {
        playCatalog(ptsPlayer, SCORING[0].play, $('#pts-now'));
        $('#pts-now').insertAdjacentHTML('beforeend', ` <button class="link" data-also="${SCORING[0].also}">Ver otra forma</button>`);
    }
    if (tab !== 'jugadas') history.replaceState(null, '', `#${tab}`);
    window.scrollTo({ top: 0 });
}
$('.tabbar').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-tab]');
    if (b) go(b.dataset.tab);
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(live.timer);
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
const route = () => {
    const [tab, sub] = location.hash.replace('#', '').split('/');
    if (['jugadas', 'puntos', 'guia'].includes(tab) && !$(`#tab-${tab}`).classList.contains('active')) go(tab, sub);
    else if (tab === 'jugadas' && sub && sub !== catPlayer.currentId) selectCatalog(sub, false);
    else if (tab === 'vivo' && !$('#tab-vivo').classList.contains('active')) go('vivo');
};
window.addEventListener('hashchange', route);
route();
window.elSnap = { live, players: PLAYERS };
