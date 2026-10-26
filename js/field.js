// Campo de El Snap: el terreno en SVG (yardas como unidad), la cámara que sigue al balón y el dibujo de cada jugada
// (jugadores, árbitros, balón, pizarra de rutas, línea del pase, pañuelos y efectos). Todo depende del tiempo de la
// jugada, así que se puede pausar, adelantar o regresar con la barra.

const NS = 'http://www.w3.org/2000/svg';
export const FW = 160 / 3; // ancho del campo (53⅓ yd)
const MID = FW / 2;
const R_PLAYER = 1.05;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const bounce = (t) => {
    const k = clamp(t, 0, 1);
    return 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
};

/** Texto que se lee sobre un color (oscuro sobre colores claros, como inkOn de El Play) */
const inkOn = (hex) => {
    const v = parseInt(String(hex).replace('#', '').slice(0, 6), 16);
    return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) > 160 ? '#14151a' : '#ffffff';
};

const mk = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
};

/** Nombre de una yarda del campo (x absoluta 0–120): «TIB 25», «50», «zona VOL» */
export const yardLabel = (x, left, right) => {
    const yl = x - 10;
    if (yl < 0) return `zona ${left.abbr}`;
    if (yl > 100) return `zona ${right.abbr}`;
    const r = Math.round(yl);
    if (r === 50) return '50';
    return r < 50 ? `${left.abbr} ${r}` : `${right.abbr} ${100 - r}`;
};

/** Escudo de El Snap (el de El Play con un balón ovalado) en un cuadro de 64 */
export const LOGO_PATHS = (id) => `
<defs><linearGradient id="${id}" x1="8" y1="5" x2="56" y2="57" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1e4fd8"/><stop offset="0.55" stop-color="#1e3a8a"/><stop offset="1" stop-color="#d61f3a"/></linearGradient></defs>
<path d="M14 5h36a6 6 0 0 1 6 6v21.6a6 6 0 0 1-1.76 4.24L36.24 54.84a6 6 0 0 1-8.48 0L9.76 36.84A6 6 0 0 1 8 32.6V11a6 6 0 0 1 6-6z" fill="url(#${id})"/>
<g transform="rotate(-30 32 27)"><path d="M15.5 27C20 15.6 44 15.6 48.5 27 44 38.4 20 38.4 15.5 27z" fill="#fff"/>
<g stroke="#e11d2e" stroke-linecap="round" fill="none"><path d="M24.5 27h15" stroke-width="1.7"/><path d="M27 24.6v4.8M30.3 24.6v4.8M33.7 24.6v4.8M37 24.6v4.8" stroke-width="1.4"/><path d="M19.8 21.6c-1.4 3.4-1.4 7.4 0 10.8M44.2 21.6c1.4 3.4 1.4 7.4 0 10.8" stroke-width="1.5"/></g></g>`;

// ---------------------------------------------------------------- Terreno (fijo)

function fieldMarkup(uid, left, right) {
    let s = '';
    s += `<rect x="-30" y="-14" width="180" height="${FW + 28}" fill="#1c4f2b"/>`;
    s += `<rect x="-1.5" y="-1.5" width="123" height="${FW + 3}" fill="#f4f6f8" opacity="0.9"/>`;
    for (let i = 0; i < 20; i++) s += `<rect x="${10 + i * 5}" y="0" width="5" height="${FW}" fill="${i % 2 ? '#2b7a3b' : '#308242'}"/>`;
    for (const [x, t, rot] of [
        [0, left, -90],
        [110, right, 90]
    ]) {
        s += `<rect x="${x}" y="0" width="10" height="${FW}" fill="${t.color}"/>`;
        s += `<rect x="${x}" y="0" width="10" height="${FW}" fill="url(#${uid}-st)"/>`;
        s += `<rect class="ez-flash" data-end="${x ? 'right' : 'left'}" x="${x}" y="0" width="10" height="${FW}" fill="#fff" opacity="0"/>`;
        s += `<text x="${x + 5}" y="${MID}" transform="rotate(${rot} ${x + 5} ${MID})" class="ez-text">${t.name.toUpperCase()}</text>`;
    }
    s += `<rect x="0" y="0" width="120" height="${FW}" fill="url(#${uid}-vig)"/>`;
    s += `<g stroke="#fff" stroke-opacity="0.92" fill="none">`;
    s += `<rect x="0" y="0" width="120" height="${FW}" stroke-width="0.4"/>`;
    s += `<path d="M10 0V${FW}M110 0V${FW}" stroke-width="0.32"/>`;
    for (let x = 15; x <= 105; x += 5) s += `<path d="M${x} 0V${FW}" stroke-width="${x === 60 ? 0.22 : 0.14}"/>`;
    let h = '';
    for (let x = 11; x < 110; x++) {
        if (x % 5 === 0) continue;
        h += `M${x} 0.6v0.7M${x} ${FW - 1.3}v0.7M${x} 23.25v0.66M${x} ${FW - 23.91}v0.66`;
    }
    s += `<path d="${h}" stroke-width="0.12"/></g>`;
    s += `<path d="M11.8 ${MID}h0.5M108.2 ${MID}h-0.5" stroke="#fff" stroke-width="0.3"/>`;
    for (let k = 1; k <= 9; k++) {
        const x = 10 + k * 10;
        const n = k <= 5 ? k * 10 : (10 - k) * 10;
        const arrow = k < 5 ? -1 : k > 5 ? 1 : 0;
        const num = (y) => `<text x="${x}" y="${y}" class="yd-num">${String(n).split('').join(' ')}</text>`;
        const tri = (y) => (arrow ? `<path d="M${x + arrow * 3.1} ${y - 1}l${-arrow * 0.9} -0.5v1z" fill="#fff" opacity="0.9"/>` : '');
        s += num(FW - 7.05) + tri(FW - 7.05);
        s += `<g transform="rotate(180 ${x} ${MID})">${num(FW - 7.05)}${tri(FW - 7.05)}</g>`;
    }
    for (const x of [0, 120]) {
        const d = x ? 1 : -1;
        s += `<g class="posts" data-end="${x ? 'right' : 'left'}"><path d="M${x + d * 2.4} ${MID}H${x + d * 0.25}M${x + d * 0.25} ${MID - 3.08}V${MID + 3.08}" stroke="#facc15" stroke-width="0.42" stroke-linecap="round" fill="none"/><circle cx="${x + d * 0.25}" cy="${MID - 3.08}" r="0.42" fill="#facc15"/><circle cx="${x + d * 0.25}" cy="${MID + 3.08}" r="0.42" fill="#facc15"/></g>`;
    }
    for (const x of [0, 10, 110, 120]) for (const y of [0, FW]) s += `<rect x="${x - 0.3}" y="${y - 0.3}" width="0.6" height="0.6" fill="#ff7a1a"/>`;
    s += `<g transform="translate(${60 - 5.2} ${MID - 5}) scale(0.163)" opacity="0.5">${LOGO_PATHS(`${uid}-lg`)}</g>`;
    return s;
}

/** Campo completo quieto (para la guía), con las zonas de los dos equipos */
export function staticField(host, left, right) {
    const uid = `s${Math.random().toString(36).slice(2, 7)}`;
    const svg = mk('svg', { viewBox: `-6 -4 132 ${FW + 8}`, class: 'field-static', role: 'img', 'aria-label': 'Terreno de fútbol americano con sus partes numeradas' }, host);
    mk('defs', {}, svg).innerHTML = `<pattern id="${uid}-st" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(30)"><rect x="2" width="1" height="3" fill="#fff" opacity="0.16"/></pattern>
<radialGradient id="${uid}-vig" cx="50%" cy="50%" r="75%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></radialGradient>`;
    mk('g', {}, svg).innerHTML = fieldMarkup(uid, left, right);
    return svg;
}

// ---------------------------------------------------------------- Escenario

const TONES = { up: '#34c778', down: '#ff5a5f', gold: '#f2b84b', live: '#ff4d6a', white: '#ffffff', flag: '#facc15' };

export class Stage {
    constructor(host, opts = {}) {
        this.host = host;
        this.opts = opts;
        this.uid = `f${Math.random().toString(36).slice(2, 7)}`;
        this.svg = mk('svg', { class: 'field-svg', 'aria-hidden': 'true' }, host);
        const defs = mk('defs', {}, this.svg);
        defs.innerHTML = `
<pattern id="${this.uid}-st" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(30)"><rect x="2" width="1" height="3" fill="#fff" opacity="0.16"/></pattern>
<pattern id="${this.uid}-ref" patternUnits="userSpaceOnUse" width="0.5" height="2"><rect width="0.25" height="2" fill="#111"/><rect x="0.25" width="0.25" height="2" fill="#f5f5f5"/></pattern>
<radialGradient id="${this.uid}-vig" cx="50%" cy="50%" r="75%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></radialGradient>`;
        this.gField = mk('g', {}, this.svg);
        this.gMarks = mk('g', {}, this.svg);
        this.gRoutes = mk('g', { class: 'routes' }, this.svg);
        this.gTrail = mk('g', {}, this.svg);
        this.gUnder = mk('g', {}, this.svg);
        this.gActors = mk('g', {}, this.svg);
        this.gBall = mk('g', {}, this.svg);
        this.gOver = mk('g', {}, this.svg);
        this.gRuler = mk('g', { class: 'ruler' }, this.svg);
        this.speed = 1;
        this.t = 0;
        this.playing = false;
        this.pizarra = true;
        this.full = false;
        this.aspect = 1.2;
        this.cam = { x: 60, y: MID };
        this.tick = this.tick.bind(this);
        new ResizeObserver(() => {
            const r = host.getBoundingClientRect();
            if (r.width && r.height) this.aspect = r.width / r.height;
            if (this.play) this.render(true);
        }).observe(host);
        this.buildRuler();
    }

    setTeams(left, right) {
        this.left = left;
        this.right = right;
        this.gField.innerHTML = fieldMarkup(this.uid, left, right);
    }

    buildRuler() {
        this.ruler = [];
        const labels = ['G', '10', '20', '30', '40', '50', '40', '30', '20', '10', 'G'];
        labels.forEach((l, i) => {
            const t = mk('text', { x: 10 + i * 10, class: 'ruler-t' }, this.gRuler);
            t.textContent = l;
            this.ruler.push(t);
        });
        this.losTag = mk('g', { class: 'tag' }, this.gRuler);
        this.losTagR = mk('rect', { rx: 0.7, height: 1.8, fill: '#2563eb' }, this.losTag);
        this.losTagT = mk('text', { class: 'tag-t' }, this.losTag);
        this.fdTag = mk('g', { class: 'tag' }, this.gRuler);
        this.fdTagR = mk('rect', { rx: 0.7, height: 1.8, fill: '#facc15' }, this.fdTag);
        this.fdTagT = mk('text', { class: 'tag-t dark' }, this.fdTag);
    }

    X(u) {
        return this.view.losX + this.view.dir * u;
    }
    Y(v) {
        return MID + this.view.dir * v;
    }

    /** Carga una jugada armada por el motor con su vista: línea de golpeo, dirección, equipos y línea de primera */
    load(play, view) {
        this.pause();
        this.play = play;
        this.view = view;
        this.t = 0;
        this.lastT = -1;
        this.step = -1;
        for (const g of [this.gMarks, this.gRoutes, this.gTrail, this.gUnder, this.gActors, this.gBall, this.gOver]) g.replaceChildren();
        this.gField.querySelectorAll('.ez-flash').forEach((e) => e.setAttribute('opacity', 0));
        this.gField.querySelectorAll('.posts').forEach((e) => e.classList.remove('good', 'miss'));
        const { offTeam, defTeam } = view;

        // Línea de golpeo (azul) y de primera (amarilla)
        this.los = mk('g', {}, this.gMarks);
        mk('rect', { x: -0.45, y: 0, width: 0.9, height: FW, fill: '#3b82f6', opacity: 0.28 }, this.los);
        mk('rect', { x: -0.16, y: 0, width: 0.32, height: FW, fill: '#60a5fa' }, this.los);
        this.fd = mk('g', {}, this.gMarks);
        mk('rect', { x: -0.45, y: 0, width: 0.9, height: FW, fill: '#facc15', opacity: 0.25 }, this.fd);
        mk('rect', { x: -0.16, y: 0, width: 0.32, height: FW, fill: '#facc15' }, this.fd);
        this.fdFlash = mk('rect', { x: -1.2, y: 0, width: 2.4, height: FW, fill: '#facc15', opacity: 0 }, this.fd);

        // Pizarra: rutas de la jugada
        this.routeEls = play.routes.map((r) => {
            const pts = [];
            for (let t = r.t0; t <= r.t1 + 1e-6; t += 0.08) pts.push(r.a.at(t));
            pts.push(r.a.at(r.t1));
            const xy = pts.map(([u, v]) => [this.X(u), this.Y(v)]);
            const color = r.style === 'target' ? '#facc15' : r.style === 'run' ? '#ffffff' : r.style === 'def' ? defTeam.color2 || '#ff8a8a' : offTeam.color2 || '#93c5fd';
            const g = mk('g', { class: `route ${r.style}` }, this.gRoutes);
            const d = `M${xy.map((p) => p.map((n) => n.toFixed(2)).join(' ')).join('L')}`;
            mk('path', { d, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.5, fill: 'none', pathLength: 1, 'stroke-dasharray': '1 1', class: 'rp-shadow', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
            const path = mk('path', { d, stroke: color, 'stroke-width': r.style === 'block' ? 0.34 : 0.26, fill: 'none', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
            const [ax, ay] = xy[xy.length - 1];
            const prev = xy[Math.max(0, xy.length - 4)];
            const ang = (Math.atan2(ay - prev[1], ax - prev[0]) * 180) / Math.PI;
            const head = mk(
                'path',
                { d: r.style === 'block' ? 'M0 -0.9V0.9' : 'M0.7 0L-0.5 -0.6L-0.5 0.6Z', fill: color, stroke: r.style === 'block' ? color : 'none', 'stroke-width': 0.34, transform: `translate(${ax} ${ay}) rotate(${ang})`, opacity: 0 },
                g
            );
            const plan = r.t0 < play.snap + 0.3;
            return { r, g, path, shadow: g.firstChild, head, plan };
        });

        // Rastro del balón: por tierra (línea) y por aire (puntos)
        this.trailGround = mk('path', { class: 'trail', fill: 'none', stroke: '#fff', 'stroke-width': 0.24, 'stroke-opacity': 0.85, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.gTrail);
        this.trailAir = mk('path', { class: 'trail', fill: 'none', stroke: '#fff', 'stroke-width': 0.24, 'stroke-dasharray': '0.1 0.7', 'stroke-linecap': 'round' }, this.gTrail);

        // Jugadores y árbitros
        const downAt = new Map();
        for (const d of play.downs) downAt.set(d.a, Math.min(d.t, downAt.get(d.a) ?? 1e9));
        this.actorEls = play.actors.map((a) => {
            const ref = a.side === 'ref';
            const team = a.side === 'off' ? offTeam : defTeam;
            const g = mk('g', { class: `pl ${a.side}` }, this.gActors);
            mk('circle', { cx: 0.22, cy: 0.32, r: ref ? 0.85 : R_PLAYER, fill: '#000', opacity: 0.3 }, g);
            const body = mk('g', {}, g);
            mk('circle', { r: ref ? 0.85 : R_PLAYER, fill: ref ? `url(#${this.uid}-ref)` : team.color, stroke: ref ? '#111' : '#fff', 'stroke-width': 0.2 }, body);
            const label = a.label.length > 2 ? a.label.slice(0, 2) : a.label;
            const t = mk('text', { class: ref ? 'pl-t ref' : 'pl-t', 'font-size': label.length > 1 ? 0.82 : 1 }, body);
            t.textContent = label;
            if (!ref) t.style.fill = inkOn(team.color);
            return { a, g, body, down: downAt.get(a) ?? 1e9 };
        });
        this.carrierRing = mk('circle', { r: 1.65, fill: 'none', stroke: '#facc15', 'stroke-width': 0.22, opacity: 0 }, this.gUnder);

        // Balón
        this.ballShadow = mk('ellipse', { rx: 0.5, ry: 0.3, fill: '#000', opacity: 0.35 }, this.gBall);
        this.ballG = mk('g', {}, this.gBall);
        mk('ellipse', { rx: 0.62, ry: 0.38, fill: '#8a4b22', stroke: '#4a2510', 'stroke-width': 0.07 }, this.ballG);
        mk('path', { d: 'M-0.22 0H0.22M-0.12 -0.1V0.1M0 -0.1V0.1M0.12 -0.1V0.1', stroke: '#fff', 'stroke-width': 0.06 }, this.ballG);

        // Efectos de cada evento (todos existen desde el principio; el tiempo decide qué se ve)
        this.fx = play.events.map((e) => this.makeFx(e)).filter(Boolean);
        this.render(true);
        this.opts.onLoad?.(play);
    }

    makeFx(e) {
        const P = (p) => [this.X(p[0]), this.Y(p[1])];
        const pop = (at, text, tone, dur = 1.6, size = 1.9) => {
            const [x, y] = P(at);
            const g = mk('g', { opacity: 0 }, this.gOver);
            const tx = mk('text', { x, y: y - 2, class: `pop ${tone === 'flag' ? 'flag' : ''}`, 'font-size': size, fill: TONES[tone] || '#fff' }, g);
            tx.textContent = text;
            return {
                e,
                update: (dt) => {
                    const on = dt >= 0 && dt <= dur;
                    g.setAttribute('opacity', on ? (dt < dur - 0.35 ? 1 : (dur - dt) / 0.35) : 0);
                    if (on) g.setAttribute('transform', `translate(0 ${-ease(dt / 0.5) * 1.6}) translate(${x} ${y - 2}) scale(${bounce(dt / 0.35)}) translate(${-x} ${-(y - 2)})`);
                }
            };
        };
        switch (e.type) {
            case 'burst': {
                const [x, y] = P(e.at);
                const c = mk('circle', { cx: x, cy: y, r: 1, fill: 'none', stroke: '#fff', 'stroke-width': 0.3, opacity: 0 }, this.gUnder);
                const big = e.small ? 2.2 : 4.2;
                return {
                    e,
                    update: (dt) => {
                        const k = dt / 0.6;
                        c.setAttribute('opacity', k >= 0 && k <= 1 ? 1 - k : 0);
                        c.setAttribute('r', 0.8 + ease(k) * big);
                    }
                };
            }
            case 'catch': {
                const [x, y] = P(e.at);
                const c = mk('circle', { cx: x, cy: y, r: 1, fill: 'none', stroke: '#facc15', 'stroke-width': 0.3, opacity: 0 }, this.gUnder);
                return {
                    e,
                    update: (dt) => {
                        const k = dt / 0.7;
                        c.setAttribute('opacity', k >= 0 && k <= 1 ? 1 - k : 0);
                        c.setAttribute('r', 1 + ease(k) * 2.6);
                    }
                };
            }
            case 'kick': {
                const [x, y] = P(e.at);
                const c = mk('circle', { cx: x, cy: y, r: 0.6, fill: '#fff', opacity: 0 }, this.gUnder);
                return { e, update: (dt) => c.setAttribute('opacity', dt >= 0 && dt < 0.35 ? 0.8 * (1 - dt / 0.35) : 0) };
            }
            case 'pop':
                return pop(e.at, e.text, e.tone, e.tone === 'flag' ? 1.8 : 1.6, e.text.length > 10 ? 1.5 : 1.9);
            case 'first': {
                const p = pop(e.at, 'PRIMERA Y 10', 'flag', 1.8, 1.6);
                return {
                    e,
                    update: (dt) => {
                        p.update(dt);
                        this.fdFlash.setAttribute('opacity', dt >= 0 && dt < 1.2 ? 0.55 * Math.abs(Math.sin(dt * 7)) * (1 - dt / 1.2) : 0);
                    }
                };
            }
            case 'x': {
                const [x, y] = P(e.at);
                const g = mk('path', { d: `M${x - 0.8} ${y - 0.8}L${x + 0.8} ${y + 0.8}M${x + 0.8} ${y - 0.8}L${x - 0.8} ${y + 0.8}`, stroke: '#ff5a5f', 'stroke-width': 0.35, 'stroke-linecap': 'round', opacity: 0 }, this.gUnder);
                return { e, update: (dt) => g.setAttribute('opacity', dt >= 0 ? Math.min(1, dt / 0.2) : 0) };
            }
            case 'flash': {
                const attacksRight = this.view.dir > 0;
                const right = e.end === 'opp' ? attacksRight : !attacksRight;
                const rect = this.gField.querySelector(`.ez-flash[data-end="${right ? 'right' : 'left'}"]`);
                return { e, update: (dt) => rect?.setAttribute('opacity', dt >= 0 && dt < 2.4 ? 0.45 * Math.abs(Math.sin(dt * 5)) * (1 - dt / 2.4) : 0) };
            }
            case 'posts': {
                const right = this.view.dir > 0;
                const posts = this.gField.querySelector(`.posts[data-end="${right ? 'right' : 'left'}"]`);
                return { e, update: (dt) => posts?.classList.toggle(e.good ? 'good' : 'miss', dt >= 0 && dt < 2) };
            }
            case 'passline':
                return this.passLine(e);
            case 'yacline': {
                const [x0, y0] = P(e.from);
                const [x1, y1] = P(e.to);
                const g = mk('g', { opacity: 0 }, this.gTrail);
                const tx = mk('text', { x: x1, y: y1 + 2.6, class: 'pass-l' }, g);
                tx.textContent = e.yac > 0 ? `+${e.yac} tras atrapar` : '';
                mk('circle', { cx: x0, cy: y0, r: 0.5, fill: '#facc15' }, g);
                return { e, update: (dt) => g.setAttribute('opacity', dt >= e.t1 - e.t ? 1 : 0) };
            }
            case 'flag':
                return this.flagFx(e);
            case 'grab': {
                const line = mk('path', { stroke: '#facc15', 'stroke-width': 0.3, 'stroke-dasharray': '0.4 0.3', opacity: 0 }, this.gOver);
                const ring = mk('circle', { r: 1.6, fill: 'none', stroke: '#facc15', 'stroke-width': 0.22, opacity: 0 }, this.gOver);
                return {
                    e,
                    update: (dt, t) => {
                        const on = dt >= 0 && t <= e.t1;
                        line.setAttribute('opacity', on ? 1 : 0);
                        ring.setAttribute('opacity', on ? 0.5 + 0.5 * Math.abs(Math.sin(dt * 8)) : 0);
                        if (!on) return;
                        const [ax, ay] = P(e.a.at(t));
                        const [bx, by] = P(e.b.at(t));
                        line.setAttribute('d', `M${ax} ${ay}L${bx} ${by}`);
                        ring.setAttribute('cx', bx);
                        ring.setAttribute('cy', by);
                    }
                };
            }
            case 'enforce': {
                const x0 = this.X(e.from);
                const x1 = this.X(e.to);
                const y = MID;
                const g = mk('g', { opacity: 0 }, this.gUnder);
                const ghost = mk('rect', { x: -0.2, y: 0, width: 0.4, height: FW, fill: '#60a5fa' }, g);
                const arrow = mk('path', { fill: '#facc15', opacity: 0.9 }, g);
                const tx = mk('text', { x: (x0 + x1) / 2, y: y - 2.2, class: 'pop flag', 'font-size': 1.7, fill: '#facc15' }, g);
                tx.textContent = e.text;
                const dirn = Math.sign(x1 - x0) || 1;
                return {
                    e,
                    update: (dt) => {
                        g.setAttribute('opacity', dt >= 0 ? 1 : 0);
                        if (dt < 0) return;
                        const k = ease(dt / 1.2);
                        const xe = lerp(x0, x1, k);
                        ghost.setAttribute('transform', `translate(${xe} 0)`);
                        const h = Math.min(1.2, Math.abs(xe - x0));
                        arrow.setAttribute('d', `M${x0} ${y - 0.45}H${xe - dirn * h}V${y - 1.1}L${xe} ${y}L${xe - dirn * h} ${y + 1.1}V${y + 0.45}H${x0}Z`);
                    }
                };
            }
            default:
                return null;
        }
    }

    /** De dónde a dónde fue el pase (o la patada): línea punteada que crece con el balón, puntos y nombres de yardas */
    passLine(e) {
        const [x0, y0] = [this.X(e.from[0]), this.Y(e.from[1])];
        const [x1, y1] = [this.X(e.to[0]), this.Y(e.to[1])];
        const g = mk('g', { opacity: 0, class: 'passline' }, this.gTrail);
        const line = mk('path', { stroke: '#facc15', 'stroke-width': 0.22, 'stroke-dasharray': '0.6 0.45', fill: 'none' }, g);
        mk('circle', { cx: x0, cy: y0, r: 0.55, fill: '#facc15' }, g);
        const ring = mk('circle', { cx: x1, cy: y1, r: 1.5, fill: 'none', stroke: '#facc15', 'stroke-width': 0.25, opacity: 0 }, g);
        const kick = e.result.startsWith('kick');
        const name = (x) => yardLabel(x, this.left, this.right);
        const labels = mk('g', { opacity: 0 }, this.gOver);
        const l0 = mk('text', { x: x0, y: y0 + (y0 < MID ? -1.7 : 2.6), class: 'pass-l' }, labels);
        l0.textContent = kick ? `Patea: ${name(x0)}` : `Lanza: ${name(x0)}`;
        const l1 = mk('text', { x: x1, y: y1 + (y1 < MID ? -2.1 : 3), class: 'pass-l', opacity: 0 }, labels);
        l1.textContent =
            e.result === 'catch'
                ? `Atrapa: ${name(x1)}`
                : e.result === 'inc'
                  ? 'Incompleto'
                  : e.result === 'int'
                    ? `Interceptado: ${name(x1)}`
                    : e.result === 'kickgood'
                      ? '¡Entre los postes!'
                      : e.result === 'kickmiss'
                        ? 'Desviado'
                        : `Cae: ${name(x1)}`;
        const mid = mk('text', { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 1.2, class: 'pass-m', opacity: 0 }, labels);
        mid.textContent = kick ? `${e.result.startsWith('kickg') || e.result.startsWith('kickm') ? 'Patada de' : 'Vuela'} ${Math.abs(e.air)} yd` : `${Math.abs(Math.round(e.to[0] - e.from[0]))} yd en el aire`;
        const span = e.t1 - e.t;
        return {
            e,
            update: (dt) => {
                g.setAttribute('opacity', dt >= 0 ? 1 : 0);
                labels.setAttribute('opacity', dt >= 0 ? 1 : 0);
                if (dt < 0) return;
                const k = clamp(dt / span, 0, 1);
                line.setAttribute('d', `M${x0} ${y0}L${lerp(x0, x1, k)} ${lerp(y0, y1, k)}`);
                const done = k >= 1;
                ring.setAttribute('opacity', done ? 1 : 0);
                l1.setAttribute('opacity', done ? 1 : 0);
                mid.setAttribute('opacity', k > 0.35 ? 1 : 0);
            }
        };
    }

    /** Pañuelo: vuela desde el árbitro (o el coach) dando vueltas y se queda en el suelo */
    flagFx(e) {
        const [x0, y0] = [this.X(e.from[0]), this.Y(e.from[1])];
        const [x1, y1] = [this.X(e.to[0]), this.Y(e.to[1])];
        const color = e.color === 'red' ? '#ef4444' : '#facc15';
        const g = mk('g', { opacity: 0 }, this.gOver);
        const sh = mk('ellipse', { rx: 0.5, ry: 0.25, fill: '#000', opacity: 0.35 }, g);
        const fl = mk('g', {}, g);
        mk('path', { d: 'M-0.55 -0.45H0.55V0.45H-0.55Z', fill: color, stroke: '#1a1a1a', 'stroke-width': 0.06 }, fl);
        mk('circle', { cx: 0.1, cy: 0.05, r: 0.17, fill: '#1a1a1a', opacity: 0.6 }, fl);
        mk('path', { d: 'M0.1 0.05l0.6 0.5', stroke: color, 'stroke-width': 0.14 }, fl);
        const span = e.t1 - e.t;
        return {
            e,
            update: (dt) => {
                g.setAttribute('opacity', dt >= 0 ? 1 : 0);
                if (dt < 0) return;
                const k = clamp(dt / span, 0, 1);
                const x = lerp(x0, x1, k);
                const y = lerp(y0, y1, k);
                const h = 4 * 3 * k * (1 - k);
                sh.setAttribute('cx', x);
                sh.setAttribute('cy', y);
                fl.setAttribute('transform', `translate(${x} ${y - h * 0.6}) rotate(${k < 1 ? dt * 900 : 18}) scale(${1 + h * 0.15})`);
            }
        };
    }

    start() {
        if (!this.play) return;
        if (this.t >= this.play.dur - 0.01) this.seek(0);
        this.playing = true;
        this.last = performance.now();
        this.opts.onPlayState?.(true);
        requestAnimationFrame(this.tick);
    }
    pause() {
        if (this.playing) this.opts.onPlayState?.(false);
        this.playing = false;
    }
    toggle() {
        if (this.playing) this.pause();
        else this.start();
    }
    seek(t) {
        this.t = clamp(t, 0, this.play?.dur ?? 0);
        this.lastT = this.t;
        this.render(true);
    }
    tick(now) {
        if (!this.playing) return;
        const dt = Math.min(0.06, (now - this.last) / 1000);
        this.last = now;
        this.t = Math.min(this.play.dur, this.t + dt * this.speed);
        this.render(false, dt);
        if (this.t >= this.play.dur) {
            this.playing = false;
            this.opts.onPlayState?.(false);
            this.opts.onEnd?.(this.play);
            return;
        }
        requestAnimationFrame(this.tick);
    }

    /** Dibuja el instante t: cámara, jugadores, balón, rastro, rutas y efectos; avisa de eventos y pasos */
    render(snap = false, dt = 0.016) {
        const P = this.play;
        if (!P) return;
        const t = this.t;
        const S = P.snap;

        // Avisos al pasar por cada evento (solo reproduciendo)
        if (!snap) for (const e of P.events) if (e.t > this.lastT && e.t <= t) this.opts.onEvent?.(e);
        this.lastT = t;
        let st = -1;
        for (let i = 0; i < P.steps.length; i++) if (P.steps[i].t <= t + 0.01) st = i;
        if (st !== this.step) {
            this.step = st;
            this.opts.onStep?.(st, P.steps);
        }
        this.opts.onTime?.(t, P.dur);

        // Jugadores
        const b = P.ballAt(t);
        for (const el of this.actorEls) {
            const [u, v] = el.a.at(t);
            el.g.setAttribute('transform', `translate(${this.X(u).toFixed(3)} ${this.Y(v).toFixed(3)})`);
            const down = t >= el.down;
            el.body.setAttribute('transform', down ? 'scale(0.86)' : '');
            el.g.classList.toggle('down', down);
        }
        if (b.who) {
            const [u, v] = b.who.at(t);
            this.carrierRing.setAttribute('cx', this.X(u));
            this.carrierRing.setAttribute('cy', this.Y(v));
            this.carrierRing.setAttribute('opacity', t > S ? 0.9 : 0);
        } else this.carrierRing.setAttribute('opacity', 0);

        // Balón: sombra en el suelo y el balón levantado según la altura
        const bx = this.X(b.u);
        const by = this.Y(b.v);
        const lift = b.h * 0.55;
        const ahead = P.ballAt(t + 0.05);
        let ang = (Math.atan2(this.Y(ahead.v) - by + (ahead.h - b.h) * -0.55, this.X(ahead.u) - bx) * 180) / Math.PI;
        if (Math.abs(this.X(ahead.u) - bx) + Math.abs(this.Y(ahead.v) - by) < 0.01) ang = this.view.dir > 0 ? 0 : 180;
        const scale = 1 + b.h * 0.05;
        const off = b.who ? 0.55 : 0;
        const ox = b.who ? Math.cos((ang * Math.PI) / 180) * off : 0;
        const oy = b.who ? Math.sin((ang * Math.PI) / 180) * off : 0;
        this.ballShadow.setAttribute('cx', bx + ox + 0.15);
        this.ballShadow.setAttribute('cy', by + oy + 0.2);
        this.ballShadow.setAttribute('opacity', b.air ? 0.35 / (1 + b.h * 0.08) : 0.3);
        this.ballG.setAttribute('transform', `translate(${(bx + ox).toFixed(3)} ${(by + oy - lift).toFixed(3)}) rotate(${ang.toFixed(1)}) scale(${scale.toFixed(3)})`);

        // Rastro del balón desde el snap
        let dg = '';
        let da = '';
        let prevAir = null;
        for (let s = Math.min(S, t); s <= t; s += 0.05) {
            const q = P.ballAt(s);
            const x = this.X(q.u).toFixed(2);
            const y = (this.Y(q.v) - (q.air ? q.h * 0.55 : 0)).toFixed(2);
            if (q.air !== prevAir) {
                if (q.air) da += `M${x} ${y}`;
                else dg += `M${x} ${y}`;
            } else if (q.air) da += `L${x} ${y}`;
            else dg += `L${x} ${y}`;
            prevAir = q.air;
        }
        this.trailGround.setAttribute('d', t > S ? dg : '');
        this.trailAir.setAttribute('d', t > S ? da : '');

        // Pizarra: las rutas planeadas se dibujan antes del snap; las demás se van dibujando
        for (const r of this.routeEls) {
            let k;
            if (r.plan) k = clamp(t / Math.max(0.4, S - 0.2), 0, 1);
            else k = clamp((t - r.r.t0) / Math.max(0.2, r.r.t1 - r.r.t0), 0, 1);
            const off = String(1 - k);
            r.path.setAttribute('stroke-dashoffset', off);
            r.shadow.setAttribute('stroke-dashoffset', off);
            r.head.setAttribute('opacity', k > 0.97 ? 1 : 0);
            const faded = r.plan && t > S + 0.2;
            r.g.setAttribute('opacity', !this.pizarra ? 0 : faded ? (r.r.style === 'target' || r.r.style === 'run' ? 0.75 : 0.4) : 1);
        }

        for (const f of this.fx) f.update(t - f.e.t, t);

        // Líneas de golpeo y de primera
        const losX = this.view.losX;
        this.los.setAttribute('transform', `translate(${losX} 0)`);
        const hasFd = this.view.firstX != null;
        this.fd.setAttribute('transform', `translate(${hasFd ? this.view.firstX : -50} 0)`);

        // Cámara: sigue al balón (antes del snap mira un poco hacia adelante)
        this.camera(t < S ? [this.X(4), MID] : [bx, by - lift * 0.5], snap, dt);
    }

    camera(target, snap, dt) {
        let w;
        let h;
        if (this.full) {
            w = 128;
            h = w / this.aspect;
            if (h < FW + 8) {
                h = FW + 8;
                w = h * this.aspect;
            }
        } else {
            h = 34;
            w = h * this.aspect;
            if (w < 40) {
                w = 40;
                h = w / this.aspect;
            }
        }
        const tx = this.full ? 60 : clamp(target[0], -9 + w / 2, 129 - w / 2);
        const ty = this.full ? MID : h >= FW + 10 ? MID : clamp(target[1], -5 + h / 2, FW + 5 - h / 2);
        const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
        this.cam.x += (tx - this.cam.x) * k;
        this.cam.y += (ty - this.cam.y) * k;
        if (snap) this.cam.w = w;
        this.svg.setAttribute('viewBox', `${(this.cam.x - w / 2).toFixed(2)} ${(this.cam.y - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
        // Regla de yardas abajo y etiquetas de las líneas arriba
        const yb = this.cam.y + h / 2 - 1;
        for (const r of this.ruler) r.setAttribute('y', yb);
        const yt = this.cam.y - h / 2 + 0.6;
        const tag = (gEl, rect, text, x, label) => {
            if (x == null) return gEl.setAttribute('opacity', 0);
            gEl.setAttribute('opacity', 1);
            text.textContent = label;
            const wdt = label.length * 0.62 + 1;
            rect.setAttribute('width', wdt);
            rect.setAttribute('x', x - wdt / 2);
            rect.setAttribute('y', yt);
            text.setAttribute('x', x);
            text.setAttribute('y', yt + 1.27);
        };
        tag(this.losTag, this.losTagR, this.losTagT, this.view.losX, this.view.losLabel || yardLabel(this.view.losX, this.left, this.right));
        tag(this.fdTag, this.fdTagR, this.fdTagT, this.view.firstX, '1ª');
    }
}
