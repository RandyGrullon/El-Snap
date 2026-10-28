// Motor de jugadas de El Snap: arma cada jugada cuadro a cuadro (30 por segundo) en el marco del ataque.
// u = yardas hacia la zona de anotación rival desde la línea de golpeo (negativo = detrás de la línea)
// v = yardas a lo ancho (0 = centro del campo; negativo = a la izquierda del ataque).
// Cada jugada trae a los 22 jugadores, los 5 árbitros, el balón, los pañuelos, los efectos y los pasos que se narran.

export const FPS = 30;
const DT = 1 / FPS;
const MAX_T = 26;
const N = MAX_T * FPS + 1;
export const HALF_W = 80 / 3; // medio ancho del campo (53⅓ yd)
const SIDE = HALF_W - 1.4;
export const SNAP = 1.8; // antes del snap se dibuja la pizarra

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const unit = (a, b) => {
    const d = dist(a, b) || 1;
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};
const idx = (t) => clamp(Math.round(t * FPS), 0, N - 1);

/** Aleatorio con semilla (mulberry32): la misma jugada se repite igual */
export const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Punto a `s` yardas a lo largo de una línea quebrada */
const along = (path, cum, s) => {
    for (let i = 1; i < path.length; i++) {
        if (s <= cum[i] || i === path.length - 1) {
            const k = clamp((s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1);
            return [lerp(path[i - 1][0], path[i][0], k), lerp(path[i - 1][1], path[i][1], k)];
        }
    }
    return path[0];
};

// ---------------------------------------------------------------- Faltas (pañuelos)

export const FOULS = {
    holding: { name: 'Holding ofensivo', team: 'off', yards: 10, when: 'during', signal: 'Agarra la muñeca', say: 'Castigo: 10 yardas atrás y se repite el intento. Lo que ganó la jugada no cuenta' },
    false_start: { name: 'Salida en falso', team: 'off', yards: 5, when: 'pre', signal: 'Gira los brazos', say: 'La jugada no se da: 5 yardas atrás' },
    offside: { name: 'Fuera de lugar', team: 'def', yards: 5, when: 'pre', signal: 'Manos en la cintura', say: '5 yardas a favor del ataque' },
    delay: { name: 'Retraso de juego', team: 'off', yards: 5, when: 'pre', signal: 'Brazos cruzados', say: 'El reloj de jugada llegó a 0 sin snap: 5 yardas atrás' },
    dpi: { name: 'Interferencia de pase', team: 'def', yards: 0, when: 'during', signal: 'Empuja con las manos', say: 'El balón se pone donde fue la falta y es primera y 10 automática' },
    roughing: { name: 'Rudeza contra el pasador', team: 'def', yards: 15, when: 'during', signal: 'Golpe en la máscara', say: '15 yardas y primera y 10 automática' },
    facemask: { name: 'Agarrar la máscara (facemask)', team: 'def', yards: 15, when: 'during', signal: 'Jala la máscara', say: '15 yardas más desde donde terminó la jugada y primera y 10' }
};

/** La falta: una de las conocidas o la que trae el juego real (nombre, equipo y yardas) */
export const foulOf = (pen) =>
    FOULS[pen.code] || {
        name: pen.name || 'Falta',
        team: pen.team || 'off',
        yards: pen.yards ?? 5,
        when: pen.when || 'pre',
        signal: 'Pañuelo amarillo',
        say: pen.say || `${pen.yards ?? 5} yardas de castigo`
    };

/** Dónde queda el balón tras la falta (u desde la línea): `base` es de donde se castiga. Mitad de distancia si no caben. */
export function foulSpot(code, ytg, base = 0) {
    const f = FOULS[code];
    if (code === 'dpi') return Math.min(Math.round(base), ytg - 1);
    if (f.team === 'off') return base - Math.min(f.yards, Math.floor((100 - ytg + base) / 2));
    return base + Math.min(f.yards, Math.max(1, Math.floor((ytg - base) / 2)));
}

// ---------------------------------------------------------------- Jugador

class Actor {
    constructor(id, side, pos, num, name, start, label) {
        Object.assign(this, { id, side, pos, num, name, start, label: label || pos });
        this.f = new Float32Array(N * 2);
        this.fill(0, start);
    }
    put(i, p) {
        this.f[2 * i] = p[0];
        this.f[2 * i + 1] = p[1];
    }
    fill(t0, p) {
        for (let i = idx(t0); i < N; i++) this.put(i, p);
    }
    at(t) {
        const x = clamp(t * FPS, 0, N - 1);
        const i = Math.floor(x);
        const j = Math.min(i + 1, N - 1);
        const k = x - i;
        return [lerp(this.f[2 * i], this.f[2 * j], k), lerp(this.f[2 * i + 1], this.f[2 * j + 1], k)];
    }
    vel(t) {
        const a = this.at(t - DT);
        const b = this.at(t);
        return [(b[0] - a[0]) / DT, (b[1] - a[1]) / DT];
    }
    /** Corre por los puntos a `speed` yd/s desde t0 (acelera en `acc` s); se queda en el último. Devuelve la llegada. */
    run(t0, pts, speed, acc = 0.4) {
        const path = [this.at(t0), ...pts];
        const cum = [0];
        for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + dist(path[i - 1], path[i]));
        const L = cum[cum.length - 1];
        const travel = (e) => (e <= 0 ? 0 : acc > 0 && e < acc ? (speed * e * e) / (2 * acc) : speed * (e - acc / 2));
        const total = acc > 0 && L < (speed * acc) / 2 ? Math.sqrt((2 * L * acc) / speed) : L / speed + acc / 2;
        for (let i = idx(t0); i < N; i++) this.put(i, along(path, cum, Math.min(L, travel(i * DT - t0))));
        return t0 + total;
    }
    /** Persigue un objetivo que se mueve (con anticipación `lead`) desde t0 hasta t1 */
    chase(t0, t1, target, speed, o = {}) {
        const { lead = 0.25, stop = 0.8, acc = 0.5 } = o;
        let p = this.at(t0);
        const v0 = this.vel(t0);
        let sp = Math.min(speed, Math.hypot(v0[0], v0[1]));
        const i1 = idx(t1);
        for (let i = idx(t0); i < N; i++) {
            if (i <= i1) {
                const g = target(i * DT + lead);
                const dx = g[0] - p[0];
                const dy = g[1] - p[1];
                const d = Math.hypot(dx, dy);
                const want = d <= stop ? 0 : Math.min(speed, (d - stop) * 3 + 1.2);
                sp = Math.max(0, sp + clamp(want - sp, (-speed * DT) / 0.3, (speed * DT) / acc));
                if (d > 1e-4) {
                    const s = Math.min(sp * DT, d);
                    p = [p[0] + (dx / d) * s, p[1] + (dy / d) * s];
                }
            }
            this.put(i, p);
        }
    }
    /** Llega justo a `point` en tc (mezcla los últimos `win` s) y se queda ahí */
    meet(tc, point, win = 0.5) {
        const i1 = idx(tc);
        const i0 = Math.max(0, idx(tc - win));
        for (let i = i0; i <= i1; i++) {
            const w = smooth((i - i0) / Math.max(1, i1 - i0));
            this.put(i, [lerp(this.f[2 * i], point[0], w), lerp(this.f[2 * i + 1], point[1], w)]);
        }
        this.fill(tc, point);
    }
    /** Tras el silbato frena poco a poco */
    settle(tw, dur = 0.7) {
        const v = this.vel(tw);
        let p = this.at(tw);
        for (let i = idx(tw); i < N; i++) {
            const k = Math.max(0, 1 - (i * DT - tw) / dur);
            p = [p[0] + v[0] * k * DT, p[1] + v[1] * k * DT];
            this.put(i, p);
        }
    }
}

// ---------------------------------------------------------------- Jugada

const REF_NAMES = { R: 'Árbitro principal', U: 'Umpire', DJ: 'Juez de línea', LJ: 'Juez de línea', BJ: 'Juez de fondo' };

class Play {
    constructor(spec) {
        this.spec = spec;
        this.kind = spec.kind;
        this.ytg = spec.ytg;
        this.own = 100 - spec.ytg;
        this.r = rng(spec.seed || 7);
        this.snap = SNAP;
        this.actors = [];
        this.refs = [];
        this.by = {};
        this.ball = [];
        this.events = [];
        this.steps = [];
        this.routes = [];
        this.downs = [];
        this.flags = [];
        this.marks = {};
        this.held = new Set();
        this.dur = 0;
        this.whistle = 5;
        this.after = 1.9;
    }
    /** Dentro del campo (hasta las líneas de fondo y las bandas) */
    fit([u, v]) {
        return [clamp(u, -this.own - 9.3, this.ytg + 9.3), clamp(v, -SIDE, SIDE)];
    }
    add(side, id, pos, num, name, start, label) {
        const a = new Actor(id, side, pos, num, name, this.fit(start), label);
        this.actors.push(a);
        this.by[id] = a;
        return a;
    }
    addRef(id, start) {
        const a = new Actor(`ref${id}`, 'ref', 'REF', 0, REF_NAMES[id], start, id);
        this.actors.push(a);
        this.refs.push(a);
        this.by[`ref${id}`] = a;
        return a;
    }
    hold(who, t0) {
        this.ball.push({ k: 'hold', who: typeof who === 'string' ? this.by[who] : who, t0 });
    }
    fly(t0, t1, from, to, peak, h0 = 1, h1 = 1) {
        this.ball.push({ k: 'fly', t0, t1, from, to, peak, h0, h1 });
    }
    rest(t0, at, h = 0.12) {
        this.ball.push({ k: 'rest', t0, at, h });
    }
    ev(t, type, o = {}) {
        this.events.push({ t, type, ...o });
    }
    say(t, text) {
        this.steps.push({ t, text });
    }
    draw(a, t0, t1, style = 'route') {
        this.routes.push({ a: typeof a === 'string' ? this.by[a] : a, t0, t1, style });
    }
    down(a, t) {
        this.downs.push({ a, t });
    }
    /** Un árbitro (el más cerca, o `from`) tira el pañuelo hacia `at` */
    flagAt(t, at, o = {}) {
        this.flags.push({ t, at, ...o });
    }
    end(tw, after = 1.9) {
        this.whistle = tw;
        this.after = after;
    }
    finalize() {
        const tw = this.whistle;
        for (const a of this.actors) if (a.side !== 'ref' && !this.held.has(a)) a.settle(tw);
        this.ball.sort((a, b) => a.t0 - b.t0);
        if (!this.refsDone) moveRefs(this);
        for (const f of this.flags) {
            let from = f.from;
            if (!from) {
                let best = this.refs[0];
                let bd = 1e9;
                for (const a of this.refs) {
                    const d = dist(a.at(f.t), f.at);
                    if (d < bd) {
                        bd = d;
                        best = a;
                    }
                }
                from = best.at(f.t);
            }
            this.ev(f.t, 'flag', { from, to: f.at, t1: f.t + 0.75, color: f.color || 'yellow' });
        }
        this.dur = Math.min(MAX_T - 0.2, Math.max(this.dur, tw + this.after));
        // Protagonistas (llevan su nombre en el campo): quien tuvo el balón, quien taclea, el pateador y quien captura
        for (const b of this.ball) if (b.k === 'hold') b.who.key = true;
        if (this.marks.tackler) this.marks.tackler.key = true;
        if (this.by.K) this.by.K.key = true;
        if (this.kind === 'sack') this.by.DE1.key = true;
        if (this.spec.result === 'blocked' && this.by.D3) this.by.D3.key = true;
        this.events.sort((a, b) => a.t - b.t);
        this.steps.sort((a, b) => a.t - b.t);
    }
    /** Dónde está el balón en t: u, v, altura (yardas) y si va en el aire */
    ballAt(t) {
        let s = this.ball[0];
        for (const b of this.ball) {
            if (b.t0 <= t) s = b;
            else break;
        }
        if (s.k === 'hold') {
            const p = s.who.at(t);
            return { u: p[0], v: p[1], h: 1, who: s.who, air: false };
        }
        if (s.k === 'rest') return { u: s.at[0], v: s.at[1], h: s.h, air: false };
        const k = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
        return { u: lerp(s.from[0], s.to[0], k), v: lerp(s.from[1], s.to[1], k), h: lerp(s.h0, s.h1, k) + 4 * s.peak * k * (1 - k), air: k < 1 };
    }
}

// ---------------------------------------------------------------- Árbitros

function officials(P, mode) {
    const W = HALF_W + 0.9;
    const pos =
        mode === 'kick'
            ? { R: [-10, 13], U: [12, -12], DJ: [0, -W], LJ: [0, W], BJ: [Math.min(P.ytg, 70), -15] }
            : mode === 'punt'
              ? { R: [-16, 6], U: [-6, -6], DJ: [0, -W], LJ: [0, W], BJ: [Math.min((P.spec.land ?? 40) + 4, P.ytg + 9), 12] }
              : mode === 'fg'
                ? { R: [-10.5, 6], U: [-6, -7.5], DJ: [0, -W], LJ: [0, W], BJ: [P.ytg + 10.6, 4.2] }
                : { R: [-11, 4.6], U: [-8.6, -4.8], DJ: [0, -W], LJ: [0, W], BJ: [Math.min(20, P.ytg + 9), 0] };
    for (const [id, p] of Object.entries(pos)) P.addRef(id, [clamp(p[0], -P.own - 9.6, P.ytg + 10.6), p[1]]);
}

function moveRefs(P) {
    const S = P.snap;
    const tw = P.whistle;
    const b = (t) => P.ballAt(Math.min(t, tw));
    const spot = b(tw);
    for (const a of P.refs) {
        const [u0, v0] = a.start;
        if (a.label === 'DJ' || a.label === 'LJ') {
            a.chase(S, tw + 1.4, (t) => [clamp(b(t).u, -P.own - 10, P.ytg + 10), v0], 6.4, { stop: 0.8, lead: 0.15 });
        } else if (a.label === 'BJ') {
            a.chase(S, tw, (t) => [Math.max(u0, b(t).u + 9), b(t).v * 0.4], 6.2, { stop: 1.2, lead: 0.2 });
            a.chase(tw, tw + 1.8, () => [spot.u + 5, spot.v * 0.6], 4, { stop: 1.5, lead: 0 });
        } else {
            a.chase(S + 0.2, tw, (t) => [Math.min(b(t).u - 7, u0 + 8), v0], 4.5, { stop: 1.2, lead: 0.2 });
            a.chase(tw, tw + 1.8, () => [spot.u - 4, v0 * 0.5], 3.6, { stop: 2.5, lead: 0 });
        }
    }
}

// ---------------------------------------------------------------- Formaciones

const nm = (a) => (a ? a.name || `#${a.num}` : '');
const gainText = (g) => (g > 0 ? `+${g}` : g < 0 ? `−${-g}` : '0');
const yds = (n) => `${n} ${Math.abs(n) === 1 ? 'yarda' : 'yardas'}`;

function offense(P, form = 'gun') {
    const R = P.spec.offR;
    const qb = form === 'under' ? [-1.4, 0] : [-5, 0];
    const rb = form === 'under' ? [-6.8, 0] : [-5.2, -2.5];
    P.add('off', 'C', 'C', 63, '', [-0.9, 0]);
    P.add('off', 'LG', 'G', 66, '', [-1.0, -2.3]);
    P.add('off', 'RG', 'G', 71, '', [-1.0, 2.3]);
    P.add('off', 'LT', 'T', 77, '', [-1.2, -4.6]);
    P.add('off', 'RT', 'T', 74, '', [-1.2, 4.6]);
    P.add('off', 'TE', 'TE', R.te.num, R.te.n, [-1.3, 7.0]);
    P.add('off', 'QB', 'QB', R.qb.num, R.qb.n, qb);
    P.add('off', 'RB', 'RB', R.rb.num, R.rb.n, rb);
    P.add('off', 'X', 'WR', R.x.num, R.x.n, [-1.1, -16.5]);
    P.add('off', 'Z', 'WR', R.z.num, R.z.n, [-1.9, 15.5]);
    P.add('off', 'SL', 'WR', R.sl.num, R.sl.n, [-1.9, -10.5]);
}

function defense(P) {
    const D = P.spec.defR;
    const d = (u) => Math.min(u, P.ytg + 8.5);
    P.add('def', 'DE1', 'DE', D.de.num, D.de.n, [1.3, -6.2]);
    P.add('def', 'DT1', 'DT', D.dt.num, D.dt.n, [1.3, -1.3]);
    P.add('def', 'DT2', 'DT', 93, '', [1.3, 1.5]);
    P.add('def', 'DE2', 'DE', 91, '', [1.3, 8.6]);
    P.add('def', 'LB1', 'LB', D.lb.num, D.lb.n, [d(5), -3.2]);
    P.add('def', 'LB2', 'LB', 52, '', [d(5), 3.8]);
    P.add('def', 'CB1', 'CB', D.cb.num, D.cb.n, [d(6.5), -16.5]);
    P.add('def', 'CB2', 'CB', 21, '', [d(6.5), 15.5]);
    P.add('def', 'NB', 'CB', D.nb.num, D.nb.n, [d(5.5), -10.5]);
    P.add('def', 'FS', 'S', D.fs.num, D.fs.n, [d(12.5), -6.5]);
    P.add('def', 'SS', 'S', D.ss.num, D.ss.n, [d(11), 7]);
}

const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
const DL = ['DE1', 'DT1', 'DT2', 'DE2'];
const DEF = ['DE1', 'DT1', 'DT2', 'DE2', 'LB1', 'LB2', 'CB1', 'CB2', 'NB', 'FS', 'SS'];
const OFF = ['QB', 'RB', 'X', 'Z', 'SL', 'TE', 'C', 'LG', 'RG', 'LT', 'RT'];
const SKILL = ['X', 'Z', 'SL', 'TE', 'RB'];
const COVER = { X: 'CB1', Z: 'CB2', SL: 'NB', TE: 'LB2', RB: 'LB1' };
const SPEED = { WR: 8.5, TE: 7.3, RB: 7.8, QB: 6.8, CB: 8.2, S: 8.0, LB: 7.0, DE: 6.6, DT: 5.6 };

/** Snap: al QB en escopeta (vuela 5 yardas) o bajo el centro (se lo pone en las manos) */
function snapTo(P, under) {
    const QB = P.by.QB;
    const S = P.snap;
    P.rest(0, [-0.2, 0]);
    if (under) {
        P.fly(S, S + 0.12, [-0.2, 0], add(QB.start, [0.3, 0]), 0.05, 0.4, 1);
        P.hold(QB, S + 0.12);
        return S + 0.12;
    }
    P.fly(S, S + 0.3, [-0.2, 0], add(QB.start, [0.4, 0]), 0.25, 0.4, 1);
    P.hold(QB, S + 0.3);
    return S + 0.3;
}

function passPro(P, S) {
    for (const id of OL) {
        const a = P.by[id];
        const [u, v] = a.start;
        a.run(S + 0.05, [[u - 1.5 - Math.abs(v) * 0.1, v * 1.12]], 3.2, 0.25);
    }
    for (const id of DL) {
        const a = P.by[id];
        const [, v] = a.start;
        const edge = id.startsWith('DE');
        a.run(S + 0.05, [[edge ? -1.4 : -0.5, v * (edge ? 1.02 : 1)]], edge ? 3.4 : 2.4, 0.3);
    }
}

function runBlock(P, S, side) {
    for (const id of OL) {
        const a = P.by[id];
        const [u, v] = a.start;
        a.run(S + 0.05, [[u + 1.3, v + side * 0.8]], 3, 0.25);
    }
    for (const id of DL) {
        const a = P.by[id];
        const [u, v] = a.start;
        a.run(S + 0.05, [[u + 0.6, v + side * 0.7]], 2, 0.3);
    }
}

/** Varios persiguen al que lleva el balón (se paran a distintas distancias: el montón) */
function pursue(P, ids, t0, t1, target, o = {}) {
    for (const id of ids) {
        const a = typeof id === 'string' ? P.by[id] : id;
        if (!a || P.held.has(a)) continue;
        const k = P.r();
        a.chase(t0 + (o.react ?? 0.15) + k * 0.35, t1, target, (o.speed ?? SPEED[a.pos] ?? 6.8) * (0.86 + k * 0.14), {
            lead: o.lead ?? 0.3,
            stop: (o.stop ?? 1.5) + P.r() * (o.spread ?? 2.4)
        });
    }
}

/** El más cercano del grupo derriba al que lleva el balón en E */
function tackle(P, carrier, tEnd, E, pool) {
    let best = null;
    let bd = 1e9;
    for (const id of pool) {
        const a = typeof id === 'string' ? P.by[id] : id;
        if (!a || a === carrier || P.held.has(a)) continue;
        const d = dist(a.at(tEnd), E);
        if (d < bd) {
            bd = d;
            best = a;
        }
    }
    if (!best) return null;
    const n = unit(E, best.at(tEnd - 0.35));
    best.meet(tEnd, [E[0] + n[0] * 0.95, E[1] + n[1] * 0.95], clamp(bd / 6.5, 0.4, 1.2));
    carrier.fill(tEnd, carrier.at(tEnd));
    P.held.add(best);
    P.held.add(carrier);
    P.down(carrier, tEnd + 0.08);
    P.down(best, tEnd + 0.14);
    P.ev(tEnd, 'burst', { at: E });
    P.marks.tackler = best;
    return best;
}

const crossTime = (a, t0, t1, test) => {
    for (let t = t0; t <= t1; t += DT) if (test(a.at(t))) return t;
    return t1;
};

/** Anotación del que lleva el balón: touchdown (6) o, en la conversión, 2 puntos */
function scoreTD(P, t, at, side = 'off') {
    const two = P.kind === '2pt';
    P.ev(t, 'flash', { end: side === 'off' ? 'opp' : 'own', side });
    P.ev(t, 'pop', { at, text: two ? '+2' : 'TD', tone: 'gold' });
    P.ev(t, 'score', { side, pts: two ? 2 : 6 });
    P.ev(t + 0.15, 'card', { kind: two ? '2pt' : 'td', side, title: two ? 'CONVERSIÓN' : 'TOUCHDOWN', pts: two ? 2 : 6 });
}

function endOfRun(P, tEnd, E, gain, tackler) {
    const s = P.spec;
    P.marks.gain = gain;
    if (P.kind === '2pt') {
        P.ev(tEnd + 0.1, 'pop', { at: E, text: 'NO ANOTA', tone: 'down' });
        P.say(tEnd, 'Lo detienen antes de la línea de gol: la conversión falla');
        return;
    }
    P.ev(tEnd + 0.05, 'pop', { at: E, text: gainText(gain), tone: gain > 0 ? 'up' : gain < 0 ? 'down' : 'white' });
    const who = tackler ? ` (lo derriba ${nm(tackler)})` : '';
    if (s.penalty) return P.say(tEnd, `Termina la jugada con ${gainText(gain)} yardas${who}… pero hay un pañuelo en el campo`);
    P.say(tEnd, gain > 0 ? `Tacleado tras ganar ${yds(gain)}${who}` : gain < 0 ? `Tacleado detrás de la línea: pierde ${yds(-gain)}${who}` : `Lo frenan en la línea: sin ganancia${who}`);
    if (s.first) {
        P.ev(tEnd + 0.45, 'first', { at: E });
        P.say(tEnd + 0.45, '¡Primera y 10! Avanzó lo necesario: tiene 4 intentos nuevos');
    } else if (s.downs) {
        P.ev(tEnd + 0.45, 'pop', { at: add(E, [0, -3]), text: 'BALÓN A LA DEFENSA', tone: 'live' });
        P.say(tEnd + 0.45, 'No llegó en 4º intento: el balón pasa al otro equipo');
    }
}

// ---------------------------------------------------------------- Carrera (por dentro, por fuera, sneak, jet sweep)

function buildRun(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const by = P.by;
    const variant = s.variant || 'inside';
    const side = variant === 'jet' ? 1 : s.side || (r() < 0.5 ? -1 : 1);
    offense(P, 'under');
    defense(P);
    const { QB, RB } = by;
    const two = P.kind === '2pt';
    const td = s.result === 'td';
    snapTo(P, true);
    runBlock(P, S, side);

    P.say(0, two ? 'Conversión de 2 puntos: una sola jugada desde la yarda 2' : `Formación: ${nm(QB)} (QB) bajo el centro y ${nm(RB)} (RB) detrás`);
    P.say(S, 'Snap: el centro le da el balón al QB');

    let carrier = RB;
    let tEnd;
    let tH;
    let E;
    const lateral = (k) => side * k;
    if (variant === 'sneak') {
        carrier = QB;
        tH = S + 0.12;
        E = P.fit(td ? [P.ytg + 0.8, side * 0.4] : [s.gain, side * 0.4]);
        tEnd = QB.run(S + 0.2, [E], 2.6, 0.3);
        RB.run(S + 0.1, [[-2.6, 0]], 4, 0.3);
        P.draw(QB, S, tEnd, 'run');
        P.say(S + 0.25, `${nm(QB)} se lanza de frente detrás de su centro (QB sneak) para ganar poquito`);
    } else if (variant === 'jet') {
        const SL = by.SL;
        carrier = SL;
        const mStart = S - 1.35;
        E = P.fit(td ? [P.ytg + 2 + r() * 2, lateral(11 + r() * 5)] : [s.gain, lateral(11 + r() * 8)]);
        const pts = [P.fit([-2.5, -1.2]), P.fit([-2.4, 1.6]), P.fit([-1.4, 8.5])];
        if (E[0] > 6) pts.push(P.fit([lerp(0, E[0], 0.5), lerp(10, E[1], 0.5)]));
        pts.push(E);
        tEnd = SL.run(mStart, pts, 8.2, 0.5);
        tH = crossTime(SL, S, tEnd, (p) => p[1] >= 0.1);
        QB.run(S + 0.12, [[-1.9, 0.3]], 2, 0.2);
        P.hold(SL, tH);
        QB.run(tH + 0.1, [[-4.5, -3.2]], 4, 0.3);
        RB.run(S + 0.1, [[-3.5, -4.5]], 5, 0.3);
        P.draw(SL, mStart, tEnd, 'run');
        P.say(mStart, `Movimiento antes del snap: ${nm(SL)} cruza la formación a toda velocidad (motion)`);
        P.say(tH, `En plena carrera recibe el balón del QB (jet sweep)`);
        P.say(tH + 0.5, `${nm(SL)} le gana la carrera a la defensa hacia la banda`);
    } else {
        const mesh = [-3.6, side * 0.9];
        QB.run(S + 0.12, [[-2.6, side * 0.45]], 3.6, 0.2);
        tH = RB.run(S + 0.05, [mesh], 6.2, 0.4);
        P.hold(RB, tH);
        QB.run(tH + 0.1, [[-4.8, -side * 3.6]], 4.5, 0.3);
        const outside = variant === 'outside';
        const lat = outside ? lateral(9 + r() * 6) : lateral(1.5 + r() * 4.5);
        E = P.fit(td ? [P.ytg + 1.8 + r() * 3, lat] : [s.gain, lat]);
        const pts = [];
        if (E[0] < 0.8) {
            if (outside) pts.push(P.fit([-3.2, side * 5]));
            pts.push(E);
        } else {
            const hole = P.fit(outside ? [-0.6, side * 10] : [0.7, side * 2.3]);
            if (outside) pts.push(P.fit([-3.3, side * 6.4]));
            pts.push(hole);
            if (E[0] > hole[0] + 6) pts.push(P.fit([lerp(hole[0], E[0], 0.5), lerp(hole[1], E[1], 0.5) + (r() - 0.5) * 7]));
            pts.push(E);
        }
        tEnd = RB.run(tH, pts, outside ? 8.0 : 7.5, 0.15);
        P.draw(RB, S, tEnd, 'run');
        P.say(tH, `${nm(QB)} le entrega el balón a ${nm(RB)} (RB)`);
        P.say(tH + 0.35, outside ? `${nm(RB)} corre hacia la banda buscando la esquina` : `${nm(RB)} entra por el hueco que abre la línea ofensiva`);
    }

    // Receptores bloquean a los esquineros; el TE al ala defensiva
    for (const [w, d] of [
        ['X', 'CB1'],
        ['Z', 'CB2'],
        ['SL', 'NB']
    ]) {
        if (by[w] === carrier) continue;
        by[w].run(S, [add(by[w].start, [2.5, 0])], 5, 0.4);
        by[w].chase(S + 0.6, tEnd, (t) => by[d].at(t), 6.5, { stop: 1.1, lead: 0.1 });
    }
    by.TE.chase(S + 0.05, tEnd, (t) => by.DE2.at(t), 4.5, { stop: 1.4, lead: 0 });
    const ct = (t) => carrier.at(t);
    for (const id of ['LB1', 'LB2']) by[id].run(S + 0.1, [add(by[id].start, [-0.6, side * 1.2])], 3, 0.3);
    for (const id of ['FS', 'SS', 'CB1', 'CB2', 'NB']) by[id].run(S + 0.1, [add(by[id].start, [1.2, 0])], 2.5, 0.3);
    pursue(P, DL, tH + 0.2, tEnd, ct, { stop: 1.4 });
    pursue(P, ['LB1', 'LB2'], tH, tEnd, ct, { react: 0.05, stop: 0.6 });
    pursue(P, ['FS', 'SS', 'CB1', 'CB2', 'NB'], tH + 0.2, tEnd, ct, { stop: 1.2 });
    P.marks.carrier = carrier;
    P.marks.tEnd = tEnd;
    P.marks.E = E;

    if (s.fumble) return fumbleEnd(P, carrier, tEnd, E);
    if (td) {
        const tg = crossTime(carrier, S, tEnd, (p) => p[0] >= P.ytg);
        scoreTD(P, tg, E);
        P.say(tg, two ? '¡Cruza la línea de gol! Conversión buena: +2' : `¡${nm(carrier)} llega a la zona de anotación! Touchdown: +6`);
        return P.end(tEnd + 0.3, 2.6);
    }
    const tk = tackle(P, carrier, tEnd, E, DEF);
    endOfRun(P, tEnd, E, s.gain, tk);
    P.end(tEnd + 0.05);
}

/** Balón suelto: el golpe se lo saca y un defensor lo recupera (o lo recoge y anota: scoop and score) */
function fumbleEnd(P, carrier, tHit, F) {
    const r = P.r;
    const s = P.spec;
    const tk = tackle(P, carrier, tHit, F, DEF);
    const B = P.fit([F[0] + 1.6 + r() * 1.4, F[1] + (r() - 0.5) * 4]);
    const B2 = P.fit(add(B, [0.7, 0.5]));
    P.fly(tHit + 0.02, tHit + 0.6, F, B, 0.8, 1, 0.12);
    P.fly(tHit + 0.6, tHit + 0.9, B, B2, 0.25, 0.12, 0.12);
    P.rest(tHit + 0.9, B2);
    let rec = null;
    let bd = 1e9;
    for (const id of DEF) {
        const a = P.by[id];
        if (P.held.has(a)) continue;
        const d = dist(a.at(tHit), B2);
        if (d < bd) {
            bd = d;
            rec = a;
        }
    }
    const tR = tHit + Math.max(1.1, bd / 6);
    rec.chase(tHit, tR, () => B2, 7, { stop: 0.2, lead: 0 });
    rec.meet(tR, B2, 0.5);
    P.hold(rec, tR);
    P.ev(tHit + 0.05, 'pop', { at: F, text: '¡SUELTO!', tone: 'live' });
    P.say(tHit, `¡Balón suelto! El golpe de ${nm(tk)} le saca el balón a ${nm(carrier)}`);
    if (s.scoop) {
        const E = P.fit([-P.own - 2.5, B2[1] * 0.5]);
        const tEnd = rec.run(tR + 0.05, [P.fit([lerp(B2[0], E[0], 0.5), B2[1] + (r() - 0.5) * 10]), E], 8, 0.25);
        P.held.add(rec);
        P.draw(rec, tR, tEnd, 'def');
        pursue(P, OFF.filter((id) => P.by[id] !== carrier), tR, tEnd, (t) => rec.at(t), { stop: 2, speed: 7 });
        P.ev(tR, 'card', { kind: 'fumble', side: 'def', title: 'BALÓN SUELTO', sub: `${nm(rec)} lo recoge sin detenerse` });
        P.say(tR, `${nm(rec)} lo recoge en carrera y se va (scoop and score)`);
        const tg = crossTime(rec, tR, tEnd, (p) => p[0] <= -P.own);
        scoreTD(P, tg + 0.01, E, 'def');
        P.say(tg, '¡Touchdown de la defensa! +6');
        return P.end(tEnd + 0.3, 2.8);
    }
    P.held.add(rec);
    P.down(rec, tR + 0.05);
    P.ev(tR + 0.1, 'card', { kind: 'fumble', side: 'def', title: 'BALÓN SUELTO', sub: `Lo recupera ${nm(rec)}` });
    P.say(tR, `${nm(rec)} cae encima del balón: lo recupera la defensa (cambio de posesión)`);
    P.end(tR + 0.3, 2.4);
}

// ---------------------------------------------------------------- Pase

const PASS_TARGETS = {
    short: [
        ['SL', 'slant'],
        ['TE', 'out'],
        ['X', 'curl'],
        ['RB', 'flat']
    ],
    medium: [
        ['Z', 'dig'],
        ['TE', 'seam'],
        ['X', 'out'],
        ['SL', 'curl']
    ],
    deep: [
        ['X', 'go'],
        ['Z', 'post'],
        ['SL', 'seam'],
        ['Z', 'corner']
    ],
    screen: [['RB', 'screen']]
};
const DEPTH = { short: [3, 8], medium: [9, 16], deep: [18, 38], screen: [-2.5, -2.5] };
const DEFAULT_ROUTES = { X: ['go', 19], Z: ['post', 16], SL: ['seam', 13], TE: ['out', 6] };
export const ROUTE_ES = {
    go: 'vertical (go)',
    seam: 'por la costura (seam)',
    slant: 'en diagonal (slant)',
    out: 'hacia la banda (out)',
    curl: 'de regreso (curl)',
    dig: 'cruzando por dentro (dig)',
    post: 'al poste (post)',
    corner: 'a la esquina (corner)',
    flat: 'al flat',
    screen: 'de pantalla (screen)'
};

/** Puntos de una ruta que termina en la profundidad cu */
function routePts(P, a, kind, cu) {
    const [u0, v0] = a.start;
    const sg = Math.sign(v0) || -1;
    const ins = -sg;
    const D = Math.max(1, cu - u0);
    let pts;
    switch (kind) {
        case 'go':
            pts = [[cu, v0 * 0.9]];
            break;
        case 'seam':
            pts = [[cu, v0 * 0.82]];
            break;
        case 'slant':
            pts = [
                [u0 + Math.min(2.5, D * 0.4), v0],
                [cu, v0 + ins * clamp(D, 2, 7)]
            ];
            break;
        case 'out':
            pts = [
                [cu + 0.6, v0],
                [cu, v0 + sg * 5]
            ];
            break;
        case 'curl':
            pts = [
                [cu + 2, v0],
                [cu, v0 + ins * 1.5]
            ];
            break;
        case 'dig':
            pts = [
                [cu, v0],
                [cu, v0 + ins * 9]
            ];
            break;
        case 'post': {
            const st = Math.min(10, D * 0.45);
            pts = [
                [u0 + st, v0],
                [cu, v0 + ins * Math.min(11, D * 0.5)]
            ];
            break;
        }
        case 'corner': {
            const st = Math.min(10, D * 0.45);
            pts = [
                [u0 + st, v0],
                [cu, v0 + sg * 7]
            ];
            break;
        }
        case 'flat':
            pts = [
                [u0 + 1.2, v0 + sg * 2.5],
                [cu, v0 + sg * 7]
            ];
            break;
        case 'screen':
            pts = [
                [u0 + 0.4, v0 - 1],
                [cu, -8]
            ];
            break;
        default:
            pts = [[cu, v0]];
    }
    return pts.map((p) => P.fit(p));
}

/** Los receptores que no son el objetivo corren sus rutas; la secundaria los cubre */
function routesAndCover(P, S, skip, tUntil, o = {}) {
    const by = P.by;
    for (const id of SKILL) {
        if (skip.includes(id)) continue;
        const a = by[id];
        if (id === 'RB') {
            a.run(S + 0.2, [P.fit([-4.6, -3.9])], 3, 0.3);
            P.draw(a, S, S + 1.2, 'block');
            continue;
        }
        const [k2, d2] = DEFAULT_ROUTES[id];
        a.run(S, routePts(P, a, k2, Math.min(a.start[0] + d2, P.ytg + 8)), SPEED[a.pos] * 0.94, 0.45);
        P.draw(a, S, S + 2.4, 'route');
    }
    for (const [wid, did] of Object.entries(COVER)) {
        const w = by[wid];
        const d = by[did];
        if (wid === 'RB' && !o.rbTarget) {
            d.run(S + 0.1, [P.fit(add(d.start, [2.5, -d.start[1] * 0.2]))], 3.5, 0.3);
            continue;
        }
        const lb = d.pos === 'LB';
        const u0 = d.start[0];
        d.chase(
            S + (lb && o.bite ? 1.0 : 0.1),
            tUntil,
            (t) => {
                const p = w.at(t);
                return [Math.max(p[0] + (lb ? 0.8 : 1.1), u0 - 1.5), p[1] - (Math.sign(p[1]) || 1) * 0.8];
            },
            SPEED[d.pos] * (lb ? 0.92 : 0.98) * (o.slow ?? 1),
            { lead: 0.12, stop: 0.35, acc: 0.6 }
        );
    }
    for (const id of ['FS', 'SS']) by[id].run(S + 0.1, [P.fit(add(by[id].start, [2.6, -by[id].start[1] * 0.15]))], 3.2, 0.3);
}

function buildPass(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const by = P.by;
    const variant = s.variant || 'short';
    const pa = !!s.pa;
    const two = P.kind === '2pt';
    offense(P, pa ? 'under' : 'gun');
    defense(P);
    const { QB, RB } = by;
    snapTo(P, pa);
    passPro(P, S);
    let set = [-7, 0.2];
    let ready = S + 1.35;
    if (pa) {
        const mesh = [-3.6, 0.9];
        QB.run(S + 0.12, [[-2.8, 0.5]], 3.6, 0.2);
        const tm = RB.run(S + 0.05, [mesh], 6.2, 0.4);
        RB.run(tm, [[-0.8, 2.6]], 5, 0.2);
        set = [-7.6, 0.4];
        QB.run(tm + 0.15, [set], 4.2, 0.2);
        ready = tm + 1.3;
        for (const id of ['LB1', 'LB2', 'SS']) by[id].run(S + 0.15, [P.fit(add(by[id].start, [-1.8, 0.6]))], 4, 0.3);
        P.draw(RB, S, tm + 0.6, 'block');
        P.say(tm, `${nm(QB)} finge entregarle el balón a ${nm(RB)} (play-action)`);
        P.say(tm + 0.35, 'Los linebackers muerden el engaño y se acercan a la línea');
    } else QB.run(S + 0.3, [set], 3.4, 0.2);

    const options = PASS_TARGETS[variant];
    const [tid, kind] = s.target ? [s.target, s.route] : options[Math.floor(r() * options.length)];
    const tgt = by[tid];
    const range = DEPTH[variant];
    const caught = s.result === 'complete' || s.result === 'td' || !s.result;
    let cu;
    if (kind === 'screen') cu = -2.5;
    else if (s.catchU != null) cu = s.catchU;
    else if (caught && s.result === 'td' && P.ytg <= range[1] && r() < 0.6) cu = Math.min(P.ytg + 1.5 + r() * 4, P.ytg + 8);
    else if (caught) {
        const share = { short: 0.35, medium: 0.25, deep: 0.2 }[variant] ?? 0.3;
        const want = s.result === 'td' ? P.ytg : s.gain;
        cu = Math.min(clamp(Math.round(want * (1 - r() * share * 2)), range[0], range[1]), want);
    } else cu = Math.round(lerp(range[0], range[1], r()));
    cu = Math.min(cu, P.ytg + 8);

    const pts = routePts(P, tgt, kind, cu);
    const C = pts[pts.length - 1];
    const spd = SPEED[tgt.pos];
    const tStart = kind === 'screen' ? S + 0.9 : S;
    if (kind === 'screen') tgt.run(S + 0.1, [P.fit(add(tgt.start, [0.3, -0.6]))], 2, 0.2);
    const tArr = tgt.run(tStart, pts, kind === 'screen' ? 5.4 : spd, 0.45);
    routesAndCover(P, S, pa ? [tid, 'RB'] : [tid], S + 6, { bite: pa, rbTarget: tid === 'RB' });

    const dThrow = dist(set, C);
    const flight = 0.32 + dThrow / 23;
    const tpMin = Math.max(ready, S + (variant === 'deep' ? 2.2 : kind === 'screen' ? 1.8 : 1.35));
    const tp = Math.max(tArr - flight, tpMin);
    const tc = tp + flight;
    QB.run(tp - 0.5, [add(set, [0.7, 0])], 2.2, 0.2);
    // La cobertura sigue al receptor hasta que llega el balón
    const cov = by[COVER[tid]];
    const u0 = cov.start[0];
    cov.chase(S + 0.1, tc + 0.1, (t) => {
        const p = tgt.at(t);
        return [Math.max(p[0] + 1.1, u0 - 1.5), p[1] - (Math.sign(p[1]) || 1) * 0.8];
    }, SPEED[cov.pos] * 0.98, { lead: 0.12, stop: 0.35, acc: 0.6 });
    P.draw(tgt, tStart, tc, 'target');

    P.say(0, two ? 'Conversión de 2 puntos: una sola jugada desde la yarda 2' : pa ? `Formación: ${nm(QB)} bajo el centro, parece carrera` : `Formación escopeta: ${nm(QB)} (QB) a 5 yardas del centro`);
    P.say(S, 'Snap: el centro le pasa el balón al QB');
    if (!pa) P.say(S + 0.4, `${nm(QB)} retrocede; la línea ofensiva le forma el bolsillo`);
    P.say(S + 0.75, `${nm(tgt)} (${tgt.pos}) corre una ruta ${ROUTE_ES[kind]}`);
    P.say(tp, `${nm(QB)} lanza${variant === 'deep' ? ' profundo' : ''} hacia ${nm(tgt)}`);
    passOutcome(P, { QB, tgt, cov, tp, tc, from: add(QB.at(tp), [0.5, 0]), C, peak: 0.5 + dThrow * 0.1, spd, tArr, deep: variant === 'deep' });
}

/** Lo que pasa con el balón en el aire: completo (y carrera tras atrapar), incompleto (o interferencia) o interceptado */
function passOutcome(P, o) {
    const s = P.spec;
    const r = P.r;
    const by = P.by;
    const { QB, tgt, cov, tp, tc, from, C, peak, spd } = o;
    const two = P.kind === '2pt';
    const result = s.result || 'complete';
    Object.assign(P.marks, { tp, tc, C, tgt, cov, QB });
    // Después del lanzamiento la defensa va hacia el balón
    for (const id of ['FS', 'SS', 'LB1']) if (by[id] !== cov) by[id].chase(tp + 0.15 + r() * 0.2, tc, () => C, SPEED[by[id].pos], { stop: 1.6, lead: 0 });
    pursue(P, DL, tp + 0.2, tc, () => C, { stop: 6, speed: 5 });

    if (result === 'incomplete') {
        const dpi = s.penalty?.code === 'dpi';
        const miss = P.fit([C[0] + 2 + r() * 2.5, C[1] + (r() - 0.5) * 3]);
        const bounce = P.fit(add(miss, [1.6, 0.8]));
        P.fly(tp, tc, from, miss, peak, 1.5, 0.15);
        P.fly(tc, tc + 0.45, miss, bounce, 0.4, 0.15, 0.12);
        P.rest(tc + 0.45, bounce);
        P.ev(tp, 'passline', { t1: tc, from, to: miss, air: Math.round(C[0]), result: 'inc' });
        if (dpi) {
            const tf = tc - 0.45;
            const contact = P.fit(add(tgt.at(tf), [0.7, 0.5]));
            cov.meet(tf, contact, 0.5);
            tgt.fill(tf + 0.05, tgt.at(tf + 0.05));
            P.held.add(cov);
            P.held.add(tgt);
            P.down(tgt, tf + 0.06);
            P.ev(tf, 'burst', { at: contact });
            P.flagAt(tf + 0.15, contact);
            P.ev(tf + 0.9, 'pop', { at: add(contact, [0, -2.6]), text: '¡PAÑUELO!', tone: 'flag' });
            P.say(tf, `${nm(cov)} choca con ${nm(tgt)} antes de que llegue el balón`);
            P.say(tf + 0.2, '¡Pañuelo amarillo! El árbitro lo tira donde fue la falta');
            P.marks.spot = C[0];
        } else {
            tgt.run(tc - 0.15, [P.fit([lerp(C[0], miss[0], 0.45), lerp(C[1], miss[1], 0.45)])], 5, 0);
            cov.meet(tc, P.fit(add(C, [0.9, 0.4])), 0.5);
            P.down(tgt, tc + 0.15);
            P.say(tc, `${nm(cov)} desvía el balón: pase incompleto, el reloj se detiene`);
        }
        P.ev(tc, 'x', { at: miss });
        P.ev(tc + 0.05, 'pop', { at: miss, text: 'INCOMPLETO', tone: 'white' });
        P.marks.gain = 0;
        if (dpi || s.penalty) {
            // el castigo lo cuenta penaltyWrap
        } else if (two) P.say(tc + 0.4, 'La conversión falla: no hay puntos');
        else if (s.downs) {
            P.ev(tc + 0.6, 'pop', { at: [0, 0], text: 'BALÓN A LA DEFENSA', tone: 'live' });
            P.say(tc + 0.6, 'Era 4º intento: el balón pasa al otro equipo');
        } else P.say(tc + 0.4, 'Se repite desde el mismo lugar con un intento menos');
        return P.end(tc + 0.7);
    }

    if (result === 'int') {
        const I = o.deep ? by.FS : cov;
        const C2 = P.fit([C[0] + 0.8, C[1] + (I.at(tp)[1] > C[1] ? 0.6 : -0.6)]);
        I.chase(tp, tc - 0.25, () => C2, SPEED[I.pos], { stop: 0.2, lead: 0 });
        I.meet(tc, C2, 0.55);
        P.fly(tp, tc, from, C2, peak, 1.5, 1.1);
        P.hold(I, tc);
        P.ev(tp, 'passline', { t1: tc, from, to: C2, air: Math.round(C2[0]), result: 'int' });
        const pick6 = s.pick6;
        const E = P.fit(pick6 ? [-P.own - 2.5, C2[1] * 0.4] : [C2[0] - s.ret, C2[1] + (r() - 0.5) * 10]);
        const mid = P.fit([lerp(C2[0], E[0], 0.5), lerp(C2[1], E[1], 0.5) + (r() - 0.5) * 9]);
        const tEnd = I.run(tc + 0.15, [mid, E], 8.3, 0.35);
        P.held.add(I);
        P.draw(I, tc, tEnd, 'def');
        const it = (t) => I.at(t);
        tgt.chase(tc + 0.2, tEnd, it, 8.4, { lead: 0.35, stop: 0.6 });
        pursue(P, OFF.filter((id) => by[id] !== tgt), tc + 0.1, tEnd, it, { speed: 7.2, stop: 1.4 });
        pursue(P, DEF.filter((id) => by[id] !== I), tc + 0.2, tEnd, it, { speed: 6.5, stop: 3, spread: 3 });
        P.ev(tc, 'pop', { at: C2, text: '¡INTERCEPTADO!', tone: 'live' });
        P.ev(tc + 0.2, 'card', { kind: 'int', side: 'def', title: 'INTERCEPCIÓN', sub: `${nm(I)} se roba el pase` });
        P.say(tc, `¡${nm(I)} (${I.pos}) se mete en la ruta e intercepta el pase!`);
        if (pick6) {
            const tg = crossTime(I, tc, tEnd, (p) => p[0] <= -P.own);
            scoreTD(P, tg, E, 'def');
            P.say(tg, '¡Lo regresa hasta la zona de anotación! Pick-six: +6 para la defensa');
            return P.end(tEnd + 0.3, 2.6);
        }
        const tk = tackle(P, I, tEnd, E, OFF);
        P.ev(tEnd + 0.05, 'pop', { at: E, text: `RETORNO ${s.ret}`, tone: 'white' });
        P.say(tEnd, `Lo regresa ${yds(s.ret)} hasta que ${nm(tk)} lo derriba. Cambio de posesión`);
        return P.end(tEnd + 0.05, 2.2);
    }

    // Completo
    P.fly(tp, tc, from, C, peak, 1.5, 1);
    P.hold(tgt, tc);
    P.ev(tc, 'catch', { at: C });
    P.ev(tp, 'passline', { t1: tc, from, to: C, air: Math.round(C[0]), result: 'catch' });
    const td = result === 'td';
    let E;
    if (td) E = C[0] >= P.ytg ? C : P.fit([Math.min(P.ytg + 1.8 + r() * 3, P.ytg + 8), C[1] + (r() - 0.5) * 8]);
    else E = P.fit([s.gain, C[1] + (r() - 0.5) * Math.min(12, Math.abs(s.gain - C[0]) * 0.7)]);
    let tEnd = tc + 0.35;
    if (dist(C, E) > 0.6) {
        const mid = P.fit([lerp(C[0], E[0], 0.5), lerp(C[1], E[1], 0.5) + (r() - 0.5) * 3]);
        tEnd = tgt.run(tc, [mid, E], spd * 0.97, tc > o.tArr + 0.05 ? 0.4 : 0);
        P.ev(tc, 'yacline', { t1: tEnd, from: C, to: E, yac: Math.round(E[0] - C[0]) });
    }
    P.draw(tgt, tc, tEnd, 'run');
    Object.assign(P.marks, { tEnd, E, carrier: tgt });
    const ct = (t) => tgt.at(t);
    pursue(P, DEF.filter((id) => by[id] !== cov), tc - 0.1, tEnd, ct, { stop: 1.3 });
    cov.chase(tc, tEnd, ct, SPEED[cov.pos], { lead: 0.3, stop: 0.6 });
    pursue(P, SKILL.filter((id) => by[id] !== tgt), tc + 0.2, tEnd, ct, { speed: 6, stop: 3.5, spread: 3 });
    P.say(tc, C[0] >= P.ytg ? `¡${nm(tgt)} la atrapa dentro de la zona de anotación!` : `¡${nm(tgt)} atrapa el balón ${Math.round(C[0])} yardas más allá de la línea!`);
    if (td) {
        const tg = C[0] >= P.ytg ? tc : crossTime(tgt, tc, tEnd, (p) => p[0] >= P.ytg);
        scoreTD(P, tg, E);
        P.say(tg, two ? 'Conversión buena: +2' : `¡Touchdown! ${nm(tgt)} cruza la línea de gol: +6`);
        return P.end(tEnd + 0.3, 2.6);
    }
    const tk = tackle(P, tgt, tEnd, E, DEF);
    if (Math.round(E[0] - C[0]) > 1) P.say(tc + 0.3, `Sigue corriendo después de atraparla: ${yds(Math.round(E[0] - C[0]))} más (YAC)`);
    endOfRun(P, tEnd, E, s.gain, tk);
    P.end(tEnd + 0.05);
}

// ---------------------------------------------------------------- Engaños: flea flicker y Hail Mary

function buildFlea(P) {
    const s = P.spec;
    const S = P.snap;
    const by = P.by;
    offense(P, 'under');
    defense(P);
    const { QB, RB, X } = by;
    snapTo(P, true);
    passPro(P, S);
    QB.run(S + 0.12, [[-2.8, 0.5]], 3.6, 0.2);
    const tH = RB.run(S + 0.05, [[-3.6, 0.9]], 6.2, 0.4);
    P.hold(RB, tH);
    const tTurn = RB.run(tH, [[-1.8, 1.5]], 5, 0.1);
    QB.run(tH + 0.1, [[-6.8, 0.4]], 4.2, 0.2);
    const tBack = tTurn + 0.55;
    P.fly(tTurn + 0.02, tBack, RB.at(tTurn), add(QB.at(tBack), [0.4, 0]), 0.7, 1, 1);
    P.hold(QB, tBack);
    for (const id of ['LB1', 'LB2', 'SS', 'FS']) by[id].run(tH, [P.fit(add(by[id].start, [-2.4, 0.8]))], 4.6, 0.3);
    const cu = Math.min(s.result === 'td' ? P.ytg + 3 : Math.max(20, s.gain ?? 30), P.ytg + 8);
    const pts = routePts(P, X, 'go', cu);
    const C = pts[pts.length - 1];
    const tArr = X.run(S, pts, SPEED.WR, 0.45);
    routesAndCover(P, S, ['X', 'RB'], S + 6, { slow: 0.85 });
    const from = add(QB.at(tBack + 0.5), [0.5, 0]);
    const d = dist(from, C);
    const flight = 0.32 + d / 23;
    const tp = Math.max(tArr - flight, tBack + 0.5);
    const tc = tp + flight;
    const cov = by.CB1;
    cov.run(S + 0.1, [P.fit(add(cov.start, [-1.5, 0.5]))], 3, 0.3);
    cov.chase(tH + 0.4, tc, (t) => add(X.at(t), [-1.6, 0.6]), 7.6, { stop: 0.3, lead: 0.1 });
    P.draw(RB, S, tTurn, 'run');
    P.draw(X, S, tc, 'target');
    P.say(0, 'Jugada de engaño: flea flicker (parece una carrera)');
    P.say(S, 'Snap al QB bajo el centro');
    P.say(tH, `${nm(QB)} le entrega a ${nm(RB)}, que corre hacia la línea…`);
    P.say(tTurn, `…y se la devuelve al QB con un pase hacia atrás`);
    P.say(tTurn + 0.3, 'La defensa se creyó la carrera: hay un receptor solo al fondo');
    P.say(tp, `${nm(QB)} lanza profundo hacia ${nm(X)}`);
    passOutcome(P, { QB, tgt: X, cov, tp, tc, from, C, peak: 0.5 + d * 0.1, spd: SPEED.WR, tArr, deep: true });
}

function buildHail(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const by = P.by;
    offense(P, 'gun');
    defense(P);
    const QB = by.QB;
    snapTo(P, false);
    passPro(P, S);
    QB.run(S + 0.3, [[-8.4, 0.2]], 3.4, 0.2);
    QB.run(S + 1.7, [[-8.8, 4]], 3, 0.3);
    const ez = Math.min(P.ytg + 3.5, P.ytg + 8);
    const spots = { X: [ez, -4.5], SL: [ez - 1.2, -1.4], Z: [ez + 0.4, 3.4], TE: [ez - 2.2, 1.2] };
    for (const [id, p] of Object.entries(spots)) {
        const a = by[id];
        a.run(S, [P.fit([Math.min(p[0] - 6, a.start[0] + 18), a.start[1] * 0.5]), P.fit(p)], SPEED[a.pos], 0.45);
        P.draw(a, S, S + 4.2, id === (s.target || 'Z') ? 'target' : 'route');
    }
    by.RB.run(S + 0.2, [P.fit([-5.4, 2.6])], 3, 0.3);
    const zone = { CB1: [ez + 1, -3.4], NB: [ez + 0.5, -0.6], CB2: [ez + 1.2, 2.6], FS: [ez + 1.8, 0.2], SS: [ez - 0.4, 2], LB1: [ez - 3, -1.5], LB2: [ez - 3.5, 2.5] };
    for (const [id, p] of Object.entries(zone)) by[id].run(S + 0.15, [P.fit(p)], SPEED[by[id].pos] * 0.9, 0.4);
    const tp = S + 3.4;
    const from = add(QB.at(tp), [0.5, 0]);
    const C = P.fit([ez, 0.4]);
    const d = dist(from, C);
    const tc = tp + 0.4 + d / 21;
    P.fly(tp, tc, from, C, 6 + d * 0.16, 1.5, 1.6);
    P.ev(tp, 'passline', { t1: tc, from, to: C, air: Math.round(C[0]), result: s.result === 'td' ? 'catch' : 'inc' });
    for (const id of [...Object.keys(spots), ...Object.keys(zone)]) {
        const a = by[id];
        a.chase(tp + 0.3, tc, () => C, SPEED[a.pos] * 0.7, { stop: 1 + r() * 1.6, lead: 0 });
    }
    P.ev(tc, 'burst', { at: C });
    P.ev(tc - 0.1, 'pop', { at: add(C, [0, -3]), text: '¡SALTAN!', tone: 'white' });
    P.say(0, 'Última jugada de la mitad: el Ave María (Hail Mary)');
    P.say(S + 0.6, 'Todos los receptores corren hacia la zona de anotación');
    P.say(S + 1.7, `${nm(QB)} sale del bolsillo para ganar tiempo`);
    P.say(tp, `Lanza alto y lejos: ${Math.round(d)} yardas en el aire`);
    P.say(tc - 0.3, 'Un montón de jugadores salta por el balón…');
    if (s.result === 'td') {
        const tgt = by[s.target || 'Z'];
        tgt.meet(tc, C, 0.4);
        P.held.add(tgt);
        P.hold(tgt, tc);
        scoreTD(P, tc, C);
        P.say(tc, `¡${nm(tgt)} la atrapa entre todos! Touchdown: +6`);
        return P.end(tc + 0.3, 2.8);
    }
    const FS = by.FS;
    FS.meet(tc, P.fit(add(C, [0.7, -0.3])), 0.4);
    P.held.add(FS);
    const B = P.fit(add(C, [2.2, -2.4]));
    P.fly(tc, tc + 0.5, C, B, 0.6, 1.6, 0.12);
    P.rest(tc + 0.5, B);
    P.ev(tc + 0.5, 'x', { at: B });
    P.ev(tc + 0.55, 'pop', { at: B, text: 'INCOMPLETO', tone: 'white' });
    P.say(tc, `${nm(FS)} la manotea al suelo: incompleto, se acaba la mitad`);
    P.end(tc + 0.7, 2.2);
}

// ---------------------------------------------------------------- QB: scramble, spike, rodilla

function buildScramble(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const by = P.by;
    offense(P, 'gun');
    defense(P);
    const QB = by.QB;
    snapTo(P, false);
    passPro(P, S);
    QB.run(S + 0.3, [[-7, 0.2]], 3.4, 0.2);
    routesAndCover(P, S, [], S + 5);
    const side = r() < 0.5 ? 1 : -1;
    const tGo = S + 2.3;
    const E = P.fit(s.result === 'td' ? [P.ytg + 1.5, side * 6] : [s.gain, side * (6 + r() * 6)]);
    const tEnd = QB.run(tGo, [P.fit([-1.2, side * 3.4]), E], 6.9, 0.4);
    P.draw(QB, S + 0.3, tEnd, 'run');
    const ct = (t) => QB.at(t);
    pursue(P, DEF, tGo + 0.25, tEnd, ct, { stop: 1.4 });
    P.say(0, `Formación escopeta: ${nm(QB)} va a pasar`);
    P.say(S, 'Snap: el QB busca a quién lanzar');
    P.say(S + 1.6, 'Nadie está libre y el bolsillo se cierra');
    P.say(tGo, `${nm(QB)} ve un hueco y sale corriendo (scramble)`);
    Object.assign(P.marks, { carrier: QB, tEnd, E });
    if (s.result === 'td') {
        const tg = crossTime(QB, tGo, tEnd, (p) => p[0] >= P.ytg);
        scoreTD(P, tg, E);
        P.say(tg, '¡Llega corriendo a la zona de anotación! +6');
        return P.end(tEnd + 0.3, 2.6);
    }
    if (s.slide) {
        P.held.add(QB);
        P.down(QB, tEnd - 0.1);
        P.ev(tEnd, 'pop', { at: add(E, [0, -2.2]), text: 'SE DESLIZA', tone: 'white' });
        P.say(tEnd - 0.1, 'Se desliza con los pies por delante: así nadie le puede pegar');
        endOfRun(P, tEnd, E, s.gain, null);
        return P.end(tEnd + 0.05);
    }
    const tk = tackle(P, QB, tEnd, E, DEF);
    endOfRun(P, tEnd, E, s.gain, tk);
    P.end(tEnd + 0.05);
}

function buildSpike(P) {
    const S = P.snap;
    offense(P, 'under');
    defense(P);
    const QB = P.by.QB;
    snapTo(P, true);
    QB.run(S + 0.12, [[-2, 0]], 2, 0.2);
    const ts = S + 0.45;
    P.fly(ts, ts + 0.16, add(QB.at(ts), [0.4, 0]), [-0.9, 0.6], 0.05, 1.2, 0.05);
    P.fly(ts + 0.16, ts + 0.6, [-0.9, 0.6], [0.4, 1.8], 0.9, 0.05, 0.1);
    P.rest(ts + 0.6, [0.4, 1.8]);
    for (const id of SKILL) P.by[id].run(S, [add(P.by[id].start, [2, 0])], 4, 0.3);
    for (const id of DL) P.by[id].run(S + 0.05, [add(P.by[id].start, [-0.8, 0])], 2, 0.3);
    P.ev(ts + 0.16, 'burst', { at: [-0.9, 0.6] });
    P.ev(ts + 0.2, 'pop', { at: [-0.9, 0.6], text: 'SPIKE', tone: 'white' });
    P.say(0, 'Quedan segundos en el reloj y no hay tiempos fuera');
    P.say(S, 'Snap rápido al QB');
    P.say(ts, `${nm(QB)} clava el balón al suelo (spike): pase incompleto a propósito`);
    P.say(ts + 0.6, 'El reloj se detiene: pierden un intento pero ganan tiempo');
    P.end(ts + 0.8, 1.8);
}

function buildKneel(P) {
    const S = P.snap;
    offense(P, 'under');
    defense(P);
    const QB = P.by.QB;
    snapTo(P, true);
    QB.run(S + 0.15, [[-2.4, 0]], 2, 0.2);
    for (const id of DL) P.by[id].run(S + 0.05, [add(P.by[id].start, [-0.5, 0])], 1.5, 0.3);
    P.down(QB, S + 0.6);
    P.held.add(QB);
    P.ev(S + 0.6, 'pop', { at: [-2.4, 0], text: 'RODILLA', tone: 'white' });
    P.say(0, 'El equipo que gana tiene el balón y quiere gastar el reloj');
    P.say(S, 'Snap al QB bajo el centro');
    P.say(S + 0.6, `${nm(QB)} se arrodilla: la jugada termina y el reloj sigue corriendo`);
    P.end(S + 0.8, 1.6);
}

// ---------------------------------------------------------------- Captura (sack) y safety

function buildSack(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const by = P.by;
    offense(P, 'gun');
    defense(P);
    const { QB, DE1 } = by;
    snapTo(P, false);
    QB.run(S + 0.3, [[-7.2, 0.2]], 3.4, 0.2);
    passPro(P, S);
    routesAndCover(P, S, [], S + 5);
    const tBeat = DE1.run(S + 0.05, [P.fit([-2.2, -8.2]), P.fit([-5.6, -4.8])], 6.6, 0.35);
    const safety = s.result === 'safety';
    const sideStep = r() < 0.5 ? 1 : -1;
    const E = P.fit(safety ? [-P.own - 1.8, sideStep * 2.2] : [s.gain, sideStep * 2.6]);
    const tSack = QB.run(Math.max(S + 1.7, tBeat - 0.3), [E], 4.4, 0.3);
    DE1.chase(tBeat, tSack, (t) => QB.at(t), 7.2, { lead: 0.25, stop: 0.4 });
    P.draw(DE1, S, tSack, 'def');
    P.draw(QB, S + 0.3, tSack, 'run');
    DE1.meet(tSack, P.fit(add(E, [0.4, -0.8])), 0.5);
    P.held.add(DE1);
    P.held.add(QB);
    P.down(QB, tSack + 0.06);
    P.down(DE1, tSack + 0.12);
    pursue(P, ['DT1', 'DT2', 'DE2', 'LB2'], S + 1.4, tSack, (t) => QB.at(t), { stop: 1.4 });
    P.say(0, `Formación escopeta: ${nm(QB)} va a pasar`);
    P.say(S, 'Snap: el QB retrocede para buscar a quién lanzar');
    P.say(S + 1.2, 'Los receptores están bien cubiertos: nadie queda libre');
    P.say(tBeat - 0.4, `${nm(DE1)} (DE) le gana la esquina al tackle izquierdo`);
    P.ev(tSack, 'burst', { at: E });
    P.marks.gain = s.gain;
    if (safety) {
        P.ev(tSack, 'flash', { end: 'own', side: 'def' });
        P.ev(tSack, 'pop', { at: E, text: 'SAFETY', tone: 'gold' });
        P.ev(tSack, 'score', { side: 'def', pts: 2 });
        P.ev(tSack + 0.15, 'card', { kind: 'safety', side: 'def', title: 'SAFETY', pts: 2, sub: `${nm(DE1)} lo captura en su propia zona` });
        P.say(tSack, '¡Safety! Capturado dentro de su propia zona de anotación: +2 para la defensa');
        P.say(tSack + 0.6, 'Además, el equipo que recibió el safety tiene que patear desde su yarda 20');
        return P.end(tSack + 0.1, 2.6);
    }
    P.ev(tSack + 0.05, 'pop', { at: E, text: `SACK ${gainText(s.gain)}`, tone: 'down' });
    P.ev(tSack + 0.1, 'card', { kind: 'sack', side: 'def', title: 'SACK', sub: `${nm(DE1)} captura a ${nm(QB)}` });
    P.say(tSack, `¡Capturado (sack)! ${nm(QB)} pierde ${yds(-s.gain)}`);
    P.end(tSack + 0.1, 2.1);
}

// ---------------------------------------------------------------- Despeje (punt)

function buildPunt(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const R = s.offR;
    const D = s.defR;
    const pu = Math.max(-14, -P.own - 9);
    P.add('off', 'C', 'LS', 48, '', [-0.9, 0], 'LS');
    P.add('off', 'LG', 'G', 66, '', [-1.0, -2.3]);
    P.add('off', 'RG', 'G', 71, '', [-1.0, 2.3]);
    P.add('off', 'LT', 'T', 77, '', [-1.2, -4.6]);
    P.add('off', 'RT', 'T', 74, '', [-1.2, 4.6]);
    P.add('off', 'LW', 'TE', 86, '', [-2.3, -6.8], 'W');
    P.add('off', 'RW', 'TE', 89, '', [-2.3, 6.8], 'W');
    P.add('off', 'PP', 'RB', 33, '', [Math.max(-6, pu + 3), 1], 'PP');
    const PT = P.add('off', 'P', 'P', R.p.num, R.p.n, [pu, 0], 'P');
    const GL = P.add('off', 'GL', 'WR', 82, '', [-1.1, -19], 'G');
    const GR = P.add('off', 'GR', 'WR', 16, '', [-1.1, 19], 'G');
    const front = [-7.2, -4.6, -1.3, 1.5, 4.6, 7.2];
    front.forEach((v, i) => P.add('def', `F${i}`, i % 3 === 1 ? 'LB' : 'DT', 90 + i, '', [1.3, v], i % 3 === 1 ? 'LB' : 'DL'));
    P.add('def', 'JL', 'CB', 24, '', [1.3, -17.5], 'CB');
    P.add('def', 'JR', 'CB', 21, '', [1.3, 17.5], 'CB');
    P.add('def', 'ML', 'LB', 54, '', [10, -5], 'LB');
    P.add('def', 'MR', 'LB', 52, '', [10, 5], 'LB');
    const L = P.fit([Math.min(s.land, P.ytg + 6), (r() - 0.5) * 14]);
    const PR = P.add('def', 'PR', 'S', D.ret.num, D.ret.n, [Math.min(L[0] + 5, P.ytg + 6), 0], 'PR');

    P.rest(0, [-0.2, 0]);
    P.fly(S, S + 0.75, [-0.2, 0], add(PT.start, [0.5, 0]), 0.35, 0.5, 1);
    P.hold(PT, S + 0.75);
    PT.run(S + 0.8, [add(PT.start, [1.6, 0])], 2.4, 0.2);
    const tk = S + 1.55;
    const hang = 3.6 + Math.min(0.9, s.land / 90);
    const tl = tk + hang;
    const tb = s.touchback;
    P.fly(tk, tl, add(PT.at(tk), [0.6, 0]), L, 15, 1.2, tb ? 0.15 : 1.1);
    P.ev(tk, 'kick', { at: PT.at(tk) });
    P.ev(tk, 'passline', { t1: tl, from: PT.at(tk), to: L, air: Math.round(L[0]), result: 'kick' });
    PR.run(S, [P.fit(add(L, tb ? [-4, 3] : [0, 0]))], 3.5, 0.4);
    for (const g of [GL, GR]) {
        g.run(S, [P.fit([L[0] - 7, g.start[1] * 0.55])], SPEED.WR, 0.4);
        P.draw(g, S, S + 2.6, 'route');
    }
    P.draw(PT, S, tk + 0.4, 'block');
    for (const id of ['JL', 'JR']) {
        const g = id === 'JL' ? GL : GR;
        P.by[id].chase(S + 0.05, tl, (t) => g.at(t), 7.6, { stop: 1.1, lead: 0.1 });
    }
    front.forEach((v, i) => {
        const a = P.by[`F${i}`];
        a.run(S + 0.05, [[0.2, v * 0.95]], 3, 0.3);
        a.run(tk + 0.3, [P.fit([L[0] - 10 - r() * 6, v * 1.4])], 6.2, 0.4);
    });
    for (const id of ['ML', 'MR']) P.by[id].run(tk + 0.2, [P.fit([L[0] - 8, P.by[id].start[1] * 1.6])], 6, 0.4);

    P.say(0, '4º intento: el equipo despeja (punt) para alejar al rival de su zona');
    P.say(S, `Snap largo al pateador ${nm(PT)}, a ${Math.round(-pu)} yardas`);
    P.say(tk, `${nm(PT)} patea: el balón vuela unas ${Math.round(s.land)} yardas`);
    P.say(tk + 0.5, 'Los gunners bajan a toda velocidad para cubrir');
    const ct = (t) => PR.at(t);
    const cover = ['GL', 'GR', 'C', 'LG', 'RG', 'LT', 'RT', 'LW', 'RW', 'PP'];
    if (tb) {
        const B = P.fit([P.ytg + 4 + r() * 3, L[1] + 1]);
        P.fly(tl, tl + 0.8, L, B, 0.9, 0.15, 0.12);
        P.rest(tl + 0.8, B);
        pursue(P, cover, tk + 0.2, tl + 1, () => L, { stop: 3, spread: 4 });
        P.ev(tl + 0.8, 'pop', { at: B, text: 'TOUCHBACK', tone: 'white' });
        P.say(tl + 0.8, 'El balón entra a la zona de anotación: touchback. El rival empieza en su yarda 20');
        return P.end(tl + 1, 2.2);
    }
    P.hold(PR, tl);
    if (s.fair) {
        P.ev(tl - 1.3, 'pop', { at: add(L, [1.5, 0]), text: 'FAIR CATCH', tone: 'white' });
        P.say(tl - 1.3, `${nm(PR)} levanta el brazo: pide fair catch (no lo pueden tocar, pero no puede correr)`);
        P.say(tl, 'Atrapa el balón: su equipo empieza ahí');
        pursue(P, cover, tk + 0.2, tl, ct, { stop: 2.2, spread: 3 });
        return P.end(tl + 0.35, 2.2);
    }
    const td = s.result === 'td';
    const E = P.fit(td ? [-P.own - 2.5, (r() - 0.5) * 10] : [L[0] - s.ret, L[1] + (r() - 0.5) * 12]);
    const mid = P.fit([lerp(L[0], E[0], 0.5), lerp(L[1], E[1], 0.5) + (r() - 0.5) * 8]);
    const tEnd = PR.run(tl + 0.1, [mid, E], 8.2, 0.3);
    P.draw(PR, tl, tEnd, 'run');
    pursue(P, cover, tk + 0.1, tEnd, ct, { stop: td ? 3 : 1.2 });
    if (td) {
        const tg = crossTime(PR, tl, tEnd, (p) => p[0] <= -P.own);
        scoreTD(P, tg, E, 'def');
        P.say(tl, `${nm(PR)} atrapa el balón y arranca el retorno`);
        P.say(tg, `¡Retorno de despeje para touchdown de ${nm(PR)}! +6`);
        return P.end(tEnd + 0.3, 2.6);
    }
    const tk2 = tackle(P, PR, tEnd, E, cover);
    P.ev(tEnd + 0.05, 'pop', { at: E, text: `RETORNO ${s.ret}`, tone: 'white' });
    P.say(tl, `${nm(PR)} atrapa el balón y empieza el retorno`);
    P.say(tEnd, `Lo regresa ${yds(s.ret)} hasta que ${nm(tk2)} lo derriba. Cambio de posesión`);
    P.end(tEnd + 0.05, 2.1);
}

// ---------------------------------------------------------------- Patada inicial (kickoff) y patada corta (onside)

function kickTeam(P, lanes) {
    const R = P.spec.offR;
    const K = P.add('off', 'K', 'K', R.k.num, R.k.n, [-6.5, 0], 'K');
    lanes.forEach((v, i) => P.add('off', `L${i}`, 'CB', 40 + i, '', [-1.2, v], String(40 + i)));
    return K;
}

function buildKickoff(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const D = s.defR;
    const lanes = [-21.5, -16.5, -12, -7.5, -3, 3, 7.5, 12, 16.5, 21.5];
    const K = kickTeam(P, lanes);
    const ret = [
        [10, -13],
        [10, -6.5],
        [10.5, 0],
        [10, 6.5],
        [10, 13],
        [20, -11],
        [20, -4],
        [20, 4],
        [20, 11],
        [P.ytg - 14, 0]
    ];
    ret.forEach(([u, v], i) => P.add('def', `R${i}`, 'LB', 20 + i, '', [u, v], String(20 + i)));
    const L = P.fit([s.land, (r() - 0.5) * 8]);
    const KR = P.add('def', 'KR', 'S', D.ret.num, D.ret.n, [P.ytg - 3, 0], 'KR');

    P.rest(0, [0, 0], 0.3);
    const tk = K.run(S - 0.9, [[-0.3, 0]], 7, 0.3);
    P.ev(tk, 'kick', { at: [0, 0] });
    const hang = 3.7 + Math.min(0.6, s.land / 120);
    const tl = tk + hang;
    P.fly(tk, tl, [0, 0], L, 17, 0.3, 1.1);
    P.ev(tk, 'passline', { t1: tl, from: [0, 0], to: L, air: Math.round(L[0]), result: 'kick' });
    lanes.forEach((v, i) => P.by[`L${i}`].run(tk - 0.35, [P.fit([L[0] - 14 - r() * 6, v * 0.7])], 7.6 + r(), 0.4));
    KR.run(S, [L], 3.5, 0.4);
    ret.slice(0, 9).forEach(([u, v], i) => P.by[`R${i}`].run(tk + 0.15, [P.fit([u + 12 + r() * 6, v * 0.8])], 6.4, 0.4));
    P.by.R9.run(tk + 0.15, [P.fit([L[0] - 8, 2])], 5, 0.4);

    P.say(0, `Patada inicial desde la yarda ${P.own}: así empieza cada mitad y se reanuda tras anotar`);
    P.say(S - 0.6, `${nm(K)} (K) toma impulso y patea`);
    P.say(tk + 0.3, 'El balón vuela alto y profundo; la cobertura baja en línea');
    const cover = lanes.map((_, i) => `L${i}`).concat('K');
    const ct = (t) => KR.at(t);
    P.hold(KR, tl);
    if (s.touchback) {
        P.down(KR, tl + 0.5);
        P.held.add(KR);
        pursue(P, cover, tk + 0.3, tl, () => L, { stop: 8, spread: 6 });
        P.ev(tl + 0.5, 'pop', { at: L, text: 'TOUCHBACK', tone: 'white' });
        P.say(tl, `${nm(KR)} la atrapa dentro de la zona de anotación y se arrodilla`);
        P.say(tl + 0.5, 'Touchback: su equipo empieza en su yarda 25');
        return P.end(tl + 0.6, 2);
    }
    const td = s.result === 'td';
    const E = P.fit(td ? [-P.own - 2.5, (r() - 0.5) * 10] : [L[0] - s.ret, (r() - 0.5) * 14]);
    const mid1 = P.fit([L[0] - 10, L[1] * 0.4]);
    const mid2 = P.fit([lerp(mid1[0], E[0], 0.5), (r() - 0.5) * 14]);
    const tEnd = KR.run(tl + 0.05, [mid1, mid2, E], 8.4, 0.3);
    P.draw(KR, tl, tEnd, 'run');
    pursue(P, cover, tk + 0.4, tEnd, ct, { stop: td ? 3 : 1.3 });
    ret.slice(0, 9).forEach((_, i) => {
        const foe = P.by[`L${i}`];
        P.by[`R${i}`].chase(tl - 0.6, tEnd, (t) => foe.at(t), 6, { stop: 1.1, lead: 0.1 });
    });
    P.say(tl, `${nm(KR)} (KR) atrapa en su yarda ${Math.max(1, Math.round(P.ytg - L[0]))} y arranca el retorno`);
    if (td) {
        const tg = crossTime(KR, tl, tEnd, (p) => p[0] <= -P.own);
        scoreTD(P, tg, E, 'def');
        P.say(tg, `¡Retorno de punta a punta! Touchdown de ${nm(KR)}: +6`);
        return P.end(tEnd + 0.3, 2.6);
    }
    const tk2 = tackle(P, KR, tEnd, E, cover);
    P.ev(tEnd + 0.05, 'pop', { at: E, text: `RETORNO ${s.ret}`, tone: 'white' });
    P.say(tEnd, `Lo derriba ${nm(tk2)}: su equipo empieza en la yarda ${Math.round(P.ytg - E[0])}`);
    P.end(tEnd + 0.05, 2);
}

function buildOnside(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const lanes = [-20, -15, -11, -7.5, -4, 4, 7.5, 11, 15, 20];
    const K = kickTeam(P, lanes);
    const hands = [
        [10.5, -15],
        [10.5, -9],
        [10.5, -3.5],
        [10.5, 3.5],
        [10.5, 9],
        [10.5, 15],
        [15, -11],
        [15, -3],
        [15, 6],
        [21, -5]
    ];
    hands.forEach(([u, v], i) => P.add('def', `H${i}`, 'WR', 80 + i, '', [u, v], String(80 + i)));
    P.add('def', 'KR', 'S', s.defR.ret.num, s.defR.ret.n, [28, 0], 'KR');
    P.rest(0, [0, 0], 0.3);
    const tk = K.run(S - 0.9, [[-0.3, -0.4]], 6.5, 0.3);
    const pts = [
        [0, 0],
        [3.5, -2.6],
        [7.4, -5.6],
        [10.6, -7.6],
        [12.2, -8.4]
    ];
    const peaks = [0.5, 1.9, 0.7, 0.25];
    const durs = [0.35, 0.6, 0.4, 0.26];
    let t = tk;
    for (let i = 0; i < 4; i++) {
        P.fly(t, t + durs[i], pts[i], pts[i + 1], peaks[i], i === 0 ? 0.3 : 0.15, 0.15);
        if (i) P.ev(t, 'burst', { at: pts[i], small: true });
        t += durs[i];
    }
    const B = P.fit(pts[4]);
    P.rest(t, B);
    const tR = t + 0.4;
    P.ev(tk, 'kick', { at: [0, 0] });
    for (const a of P.actors) {
        if (a.side === 'ref' || a === K) continue;
        a.chase(a.side === 'off' ? tk - 0.3 : tk + 0.15, tR + 0.6, () => B, SPEED.CB * (0.8 + r() * 0.2), { stop: 0.9 + r() * 3, lead: 0 });
    }
    const side = s.recover === 'def' ? 'def' : 'off';
    let rec = null;
    let bd = 1e9;
    for (const a of P.actors) {
        if (a.side !== side) continue;
        const d = dist(a.at(tR), B);
        if (d < bd) {
            bd = d;
            rec = a;
        }
    }
    rec.meet(tR, B, 0.5);
    P.held.add(rec);
    P.down(rec, tR + 0.05);
    P.hold(rec, tR);
    P.ev(tR, 'burst', { at: B });
    P.ev(tR + 0.1, 'pop', { at: add(B, [0, -2.6]), text: side === 'off' ? '¡LA RECUPERAN!' : 'LA ASEGURAN', tone: side === 'off' ? 'gold' : 'white' });
    P.ev(tR + 0.25, 'card', { kind: 'onside', side, title: 'PATADA CORTA', sub: side === 'off' ? 'La recupera el equipo que pateó' : 'La asegura el equipo que recibe' });
    P.say(0, 'Patada corta (onside): el equipo que va perdiendo intenta quedarse con el balón');
    P.say(tk, `${nm(K)} le pega de lado para que rebote raro`);
    P.say(tk + 0.8, 'Tiene que recorrer 10 yardas antes de que el equipo que patea la pueda tocar');
    P.say(tR, side === 'off' ? `¡${nm(rec)} se lanza encima! El equipo que pateó se queda con el balón` : `${nm(rec)} la asegura: el equipo que recibe empieza ahí`);
    P.end(tR + 0.4, 2.4);
}

// ---------------------------------------------------------------- Gol de campo, punto extra y patada bloqueada

function buildKick(P) {
    const s = P.spec;
    const r = P.r;
    const S = P.snap;
    const R = s.offR;
    const xp = P.kind === 'xp';
    const line = [
        ['C', 'LS', 0],
        ['LG', 'G', -2.1],
        ['RG', 'G', 2.1],
        ['LT', 'T', -4.2],
        ['RT', 'T', 4.2],
        ['LE', 'TE', -6.3],
        ['RE', 'TE', 6.3]
    ];
    line.forEach(([id, pos, v]) => P.add('off', id, pos, 60 + Math.abs(Math.round(v * 3)), '', [v === 0 ? -0.9 : -1.1, v], pos));
    P.add('off', 'LW', 'TE', 88, '', [-2.3, -8.2], 'W');
    P.add('off', 'RW', 'TE', 89, '', [-2.3, 8.2], 'W');
    const H = P.add('off', 'H', 'P', R.p.num, R.p.n, [-7, 0.9], 'H');
    const K = P.add('off', 'K', 'K', R.k.num, R.k.n, [-10.2, -2.8], 'K');
    [-9.2, -6.6, -3.8, -1.2, 1.2, 3.8, 6.6, 9.2].forEach((v, i) => P.add('def', `D${i}`, i % 2 ? 'DT' : 'DE', 90 + i, '', [1.3, v], 'DL'));
    P.add('def', 'B0', 'LB', 54, '', [6, -5], 'LB');
    P.add('def', 'B1', 'LB', 52, '', [6, 5], 'LB');
    P.add('def', 'B2', 'S', 32, '', [Math.min(10, P.ytg + 7), 0], 'S');

    const spot = [-7, 0];
    P.rest(0, [-0.2, 0]);
    P.fly(S, S + 0.42, [-0.2, 0], spot, 0.2, 0.5, 0.15);
    P.rest(S + 0.42, spot, 0.15);
    const tk = Math.max(S + 1.15, K.run(S + 0.2, [[-8.6, -1.3], [-7.6, -0.4]], 3.6, 0.3));
    for (let i = 0; i < 8; i++) {
        const a = P.by[`D${i}`];
        a.run(S + 0.05, [[0.1, a.start[1] * 0.92]], 3.2, 0.3);
    }
    for (const [id, , v] of line) P.by[id].run(S + 0.05, [[-1.6, v * 1.05]], 2, 0.3);
    P.down(H, S + 0.42);
    P.held.add(H);
    P.ev(tk, 'kick', { at: spot });
    const dist3 = Math.round(P.ytg + 17);
    P.say(0, xp ? `Tras el touchdown: punto extra, patada desde la yarda 15 (${dist3} yardas)` : `Gol de campo: patada de ${dist3} yardas (línea + 7 del holder + 10 de la zona)`);
    P.say(S, `Snap al holder ${nm(H)}, que pone el balón de punta a 7 yardas`);

    if (s.result === 'blocked') {
        const B = P.by.D3;
        B.run(S + 0.05, [[-2.4, -1.0], [-5.4, -0.4]], 6.6, 0.3);
        B.meet(tk + 0.05, [-5.5, -0.3], 0.4);
        P.held.add(B);
        P.down(B, tk + 0.25);
        const deflect = P.fit([-3.4, 3.6 + r() * 3]);
        P.fly(tk, tk + 0.12, spot, [-5.7, -0.2], 0.4, 0.15, 1.8);
        P.fly(tk + 0.12, tk + 0.8, [-5.7, -0.2], deflect, 0.9, 1.8, 0.12);
        P.rest(tk + 0.8, deflect);
        let rec = null;
        let bd = 1e9;
        for (const a of P.actors) {
            if (a.side !== 'def' || a === B) continue;
            const d = dist(a.at(tk + 0.8), deflect);
            if (d < bd) {
                bd = d;
                rec = a;
            }
        }
        const tR = tk + 0.8 + Math.max(0.6, bd / 6);
        rec.chase(tk + 0.2, tR, () => deflect, 6.5, { stop: 0.1, lead: 0 });
        rec.meet(tR, deflect, 0.4);
        P.held.add(rec);
        P.down(rec, tR + 0.05);
        P.hold(rec, tR);
        P.draw(B, S, tk, 'def');
        P.ev(tk + 0.12, 'burst', { at: [-5.7, -0.2] });
        P.ev(tk + 0.15, 'pop', { at: [-5.7, -2.5], text: '¡BLOQUEADA!', tone: 'live' });
        P.ev(tk + 0.3, 'card', { kind: 'block', side: 'def', title: 'PATADA BLOQUEADA', sub: `${nm(B)} se cuela por el medio` });
        P.say(tk - 0.4, `${nm(B)} se cuela entre dos bloqueadores`);
        P.say(tk + 0.1, '¡Bloqueada! Le pega al balón con la mano justo al salir');
        P.say(tR, `${nm(rec)} cae encima: el balón es de la defensa`);
        return P.end(tR + 0.3, 2.4);
    }

    const GU = P.ytg + 10;
    const good = s.result === 'good';
    const aim = good ? (r() - 0.5) * 2.4 : s.miss === 'left' ? -4.8 : 4.8;
    const endU = GU + 4;
    const total = endU - spot[0];
    const flight = total / 25 + 0.5;
    const endV = (aim * total) / (GU - spot[0]);
    P.fly(tk, tk + flight, spot, [endU, endV], 7 + total * 0.12, 0.15, 2.5);
    P.rest(tk + flight, [endU + 1, endV], 0);
    const tx = tk + (flight * (GU - spot[0])) / total;
    P.ev(tk, 'passline', { t1: tx, from: spot, to: [GU, aim], air: dist3, result: good ? 'kickgood' : 'kickmiss' });
    P.say(tk, `${nm(K)} (K) patea`);
    if (good) {
        P.ev(tx, 'posts', { good: true });
        P.ev(tx, 'score', { side: 'off', pts: xp ? 1 : 3 });
        P.ev(tx + 0.1, 'card', { kind: xp ? 'xp' : 'fg', side: 'off', title: xp ? 'PUNTO EXTRA' : 'GOL DE CAMPO', pts: xp ? 1 : 3, sub: `${nm(K)} desde ${dist3} yardas` });
        P.say(tx, xp ? '¡Es bueno! Pasa entre los postes: +1' : '¡Es bueno! Pasa por encima del travesaño y entre los postes: +3');
    } else {
        P.ev(tx, 'posts', { good: false });
        P.ev(tx + 0.05, 'pop', { at: [GU, aim], text: 'FALLADO', tone: 'down' });
        P.say(tx, `¡Desviado a la ${s.miss === 'left' ? 'izquierda' : 'derecha'}! No hay puntos`);
        if (!xp) P.say(tx + 0.5, 'La defensa toma el balón donde se pateó');
    }
    P.end(tx + 0.5, 2.3);
}

function build2pt(P) {
    if (P.spec.sub === 'pass') buildPass(P);
    else buildRun(P);
}

// ---------------------------------------------------------------- Situaciones: faltas antes del snap, tiempo fuera

function buildPreSnap(P) {
    const s = P.spec;
    const S = P.snap;
    const code = s.penalty.code;
    offense(P, 'gun');
    defense(P);
    P.rest(0, [-0.2, 0]);
    let tf = S - 0.2;
    let at = [0, 0];
    if (code === 'false_start') {
        const a = P.by.RT;
        a.run(tf, [add(a.start, [0.9, 0.2])], 3, 0.15);
        at = add(a.start, [0.9, 0.2]);
        P.by.DE2.run(tf + 0.15, [add(P.by.DE2.start, [0.4, 0])], 2, 0.2);
        P.say(0, 'Todos quietos en la línea antes del snap…');
        P.say(tf, `El tackle derecho (#${a.num}) se mueve antes del snap`);
    } else if (code === 'offside') {
        const a = P.by.DE2;
        a.run(tf, [[-0.4, a.start[1] - 0.6]], 4, 0.15);
        a.run(tf + 0.45, [a.start], 3, 0.2);
        at = [-0.4, a.start[1]];
        P.say(0, 'El QB da la cadencia: «¡Hut, hut!»');
        P.say(tf, `El ala defensiva (#${a.num}) cruza la línea antes del snap`);
    } else if (code === 'delay') {
        [3, 2, 1, 0].forEach((n, i) => P.ev(0.2 + i * 0.5, 'pop', { at: [-3.2, -3], text: `0:0${n}`, tone: n ? 'white' : 'down' }));
        tf = 1.75;
        P.say(0, 'El reloj de jugada (40 s) se está acabando');
        P.say(1.7, 'Llega a 0 y todavía no hay snap');
    } else {
        const f = foulOf(s.penalty);
        at = [f.team === 'off' ? -1.2 : 1.4, 0];
        P.say(0, 'Los equipos se ponen en la línea…');
        P.say(tf, `Falta antes del snap: ${f.name.toLowerCase()}`);
    }
    P.flagAt(tf + 0.2, at);
    P.ev(tf + 0.95, 'pop', { at: add(at, [0, -2.6]), text: '¡PAÑUELO!', tone: 'flag' });
    P.say(tf + 0.2, '¡Pañuelo amarillo! Pitan y la jugada se detiene');
    P.end(tf + 0.5, 1.6);
}

function buildTimeout(P) {
    const s = P.spec;
    const two = s.variant === 'twomin';
    offense(P, 'gun');
    defense(P);
    P.rest(0, [-0.2, 0]);
    const t0 = 0.6;
    P.refsDone = true;
    const R = P.by.refR;
    R.run(0.2, [[-3.2, 0.8]], 3.4, 0.3);
    P.ev(t0, 'pop', { at: [-3.2, -2.2], text: two ? 'AVISO 2:00' : 'TIEMPO FUERA', tone: 'white' });
    P.ev(t0 + 0.4, 'card', { kind: 'timeout', side: two ? 'none' : 'off', title: two ? 'AVISO DE 2 MINUTOS' : 'TIEMPO FUERA', sub: two ? 'El reloj se detiene solo' : s.sub || 'Le quedan 2 tiempos fuera' });
    for (const a of P.actors) {
        if (a.side === 'ref') continue;
        const k = P.r();
        const bench = a.side === 'off' ? -(HALF_W + 3) : HALF_W + 3;
        a.run(t0 + 0.7 + k * 0.6, [[a.start[0] + (k - 0.5) * 6, bench + (P.r() - 0.5) * 2]], 2.6 + k, 0.5);
    }
    P.say(0, two ? 'Faltan 2 minutos para terminar la mitad' : 'El entrenador pide tiempo fuera');
    P.say(t0, two ? 'Aviso de 2 minutos: el reloj se detiene automáticamente' : 'El árbitro detiene el reloj: cada equipo tiene 3 tiempos fuera por mitad');
    P.say(t0 + 1, 'Los jugadores van a sus bancas a hablar con los entrenadores');
    P.end(5.2, 0.4);
}

// ---------------------------------------------------------------- Pañuelos durante la jugada y desafío

function penaltyWrap(P) {
    const pen = P.spec.penalty;
    if (!pen) return;
    const f = foulOf(pen);
    const by = P.by;
    const m = P.marks;
    const S = P.snap;
    if (pen.code === 'holding') {
        const pairs = [
            ['LT', 'DE1'],
            ['RT', 'DE2'],
            ['LG', 'DT1'],
            ['RG', 'DT2']
        ];
        const [o, d] = pairs.find(([, d]) => by[d] && !P.held.has(by[d])) || pairs[0];
        const OLp = by[o];
        const DLp = by[d];
        const tf = S + 0.85;
        DLp.chase(tf - 0.2, P.whistle, (t) => add(OLp.at(t), [1.0, 0.2]), 2.5, { stop: 0.4, lead: 0 });
        P.held.add(DLp);
        P.ev(tf, 'grab', { a: OLp, b: DLp, t1: tf + 1.2 });
        P.flagAt(tf + 0.3, OLp.at(tf));
        P.ev(tf + 1.05, 'pop', { at: add(OLp.at(tf), [0, -2.6]), text: '¡PAÑUELO!', tone: 'flag' });
        P.say(tf, `El ${OLp.label === 'T' ? 'tackle' : 'guardia'} #${OLp.num} agarra del jersey a #${DLp.num} para frenarlo (holding)`);
        P.say(tf + 0.3, '¡Pañuelo amarillo! El árbitro lo tira donde fue la falta… pero la jugada sigue');
    } else if (pen.code === 'roughing') {
        const QB = by.QB;
        const rusher = ['DT2', 'DT1', 'DE2'].map((id) => by[id]).find((a) => !P.held.has(a));
        const tf = m.tp + 0.6;
        rusher.chase(m.tp - 0.4, tf, (t) => QB.at(t), 6.5, { stop: 0.2, lead: 0 });
        rusher.meet(tf, add(QB.at(tf), [0.95, 0.3]), 0.35);
        P.held.add(rusher);
        P.held.add(QB);
        QB.fill(tf, QB.at(tf));
        P.down(QB, tf + 0.05);
        P.down(rusher, tf + 0.1);
        P.ev(tf, 'burst', { at: QB.at(tf) });
        P.flagAt(tf + 0.15, QB.at(tf), { from: add(by.refR.at(tf), [0, 0]) });
        P.ev(tf + 0.9, 'pop', { at: add(QB.at(tf), [0, -2.6]), text: '¡PAÑUELO!', tone: 'flag' });
        P.say(tf, `#${rusher.num} le pega al QB cuando ya había soltado el balón (golpe tardío)`);
        P.say(tf + 0.15, '¡Pañuelo! El árbitro principal vigila al QB y lo marca');
    } else if (pen.code === 'facemask') {
        const tf = m.tEnd;
        P.ev(tf, 'grab', { a: m.tackler, b: m.carrier, t1: tf + 0.9 });
        P.flagAt(tf + 0.2, m.E);
        P.ev(tf + 0.95, 'pop', { at: add(m.E, [0, -2.6]), text: '¡PAÑUELO!', tone: 'flag' });
        P.say(tf, `${nm(m.tackler)} lo derriba agarrándolo de la máscara del casco (facemask)`);
        P.say(tf + 0.2, '¡Pañuelo amarillo! Es una falta peligrosa');
    } else if (!FOULS[pen.code] && P.kind !== 'presnap') {
        // Falta del juego real durante la jugada: el pañuelo cae donde termina
        const at = m.E || [0, 0];
        const tf = Math.max(P.snap + 0.6, (m.tEnd ?? P.whistle) - 0.4);
        P.flagAt(tf, at);
        P.ev(tf + 0.85, 'pop', { at: add(at, [0, -2.6]), text: '¡PAÑUELO!', tone: 'flag' });
        P.say(tf, `¡Pañuelo amarillo! ${f.name}`);
    }
    const after = pen.code === 'roughing' || pen.code === 'facemask' || (pen.enforce === 'end' && m.gain != null);
    const base = pen.code === 'dpi' ? (m.spot ?? 0) : after ? (m.gain ?? 0) : 0;
    const to = pen.to ?? (FOULS[pen.code] ? foulSpot(pen.code, P.ytg, base) : base + (f.team === 'off' ? -f.yards : f.yards));
    const from = after ? base : 0;
    const te = P.whistle + 1.4;
    const move = to - from;
    const yards = pen.code === 'dpi' ? `balón en el lugar de la falta (${to > 0 ? '+' : ''}${Math.round(to)})` : `${move >= 0 ? '+' : '−'}${Math.abs(Math.round(move))} yardas`;
    P.ev(te - 0.3, 'card', { kind: 'flag', side: f.team, title: 'PAÑUELO', sub: `${f.name} · ${f.team === 'off' ? 'ataque' : 'defensa'} · ${yards}`, signal: f.signal });
    P.ev(te + 1.4, 'enforce', { from, to, text: pen.code === 'dpi' ? 'LUGAR DE LA FALTA' : `${move >= 0 ? '+' : '−'}${Math.abs(Math.round(move))}` });
    P.say(te - 0.3, `El árbitro anuncia: ${f.name.toLowerCase()} contra ${f.team === 'off' ? 'el ataque' : 'la defensa'} (señal: ${f.signal.toLowerCase()})`);
    P.say(te + 1.4, f.say);
    P.marks.penaltyTo = to;
    P.dur = te + 4;
}

function challengeWrap(P) {
    const s = P.spec;
    if (!s.challenge || !P.marks.E) return;
    const tw = P.whistle;
    const E = P.marks.E;
    const sg = Math.sign(E[1]) || 1;
    P.flagAt(tw + 0.7, [E[0] - 2, sg * (HALF_W - 3)], { from: [E[0] - 6, sg * (HALF_W + 3.5)], color: 'red' });
    P.ev(tw + 0.9, 'card', { kind: 'challenge', side: 'def', title: 'DESAFÍO', sub: 'El coach tira el pañuelo rojo: pide revisar la jugada' });
    P.ev(tw + 3.4, 'card', { kind: 'review', side: s.upheld === false ? 'def' : 'off', title: 'REVISIÓN', sub: s.upheld === false ? 'Se revoca: pisó la línea, pase incompleto' : 'Se confirma: tenía los dos pies dentro, pase completo' });
    P.say(tw + 0.7, 'El coach de la defensa tira el pañuelo rojo: quiere que revisen el video (desafío)');
    P.say(tw + 2.2, 'El árbitro va a la pantalla y mira la repetición desde varios ángulos');
    P.say(tw + 3.4, s.upheld === false ? 'Se revoca: el receptor pisó fuera, es incompleto' : 'Se confirma la jugada: el coach pierde un tiempo fuera');
    P.dur = tw + 6.2;
}

/**
 * Formación en espera (en vivo, entre jugadas): los equipos formados en la línea de golpeo esperando el snap.
 * variant: 'scrim' (jugada normal), 'pat' (punto extra) o 'kickoff' (patada inicial). Se arma la jugada real de
 * ese tipo y se corta antes del snap, así la formación es la misma que luego se anima.
 */
function buildFormation(P) {
    const s = P.spec;
    const v = s.variant || 'scrim';
    if (v === 'kickoff') {
        P.spec = { ...s, land: 64, ret: 20 };
        buildKickoff(P);
    } else if (v === 'pat') {
        P.spec = { ...s, result: 'good' };
        P.kind = 'xp';
        buildKick(P);
    } else {
        offense(P, s.form || 'gun');
        defense(P);
        P.rest(0, [-0.2, 0]);
    }
    // Todos quietos en su lugar y el balón en la línea (o en el tee)
    for (const a of P.actors) a.fill(0, a.at(0));
    P.held = new Set(P.actors);
    P.refsDone = true;
    P.ball = [{ k: 'rest', t0: 0, at: v === 'kickoff' ? [0, 0] : [-0.2, 0], h: v === 'kickoff' ? 0.3 : 0.12 }];
    P.kind = 'formation';
    P.marks = {};
    P.events = [];
    P.routes = [];
    P.steps = [{ t: 0, text: s.text || 'Esperando el snap…' }];
    P.flags = [];
    P.downs = [];
    // El que manda en esa formación lleva su nombre: el QB, o el pateador en el punto extra y la patada
    const lead = v === 'scrim' ? P.by.QB : P.by.K;
    if (lead) lead.key = true;
    P.end(0.4, 3.2);
}

const BUILDERS = {
    run: buildRun,
    pass: buildPass,
    flea: buildFlea,
    hail: buildHail,
    scramble: buildScramble,
    spike: buildSpike,
    sack: buildSack,
    punt: buildPunt,
    kickoff: buildKickoff,
    onside: buildOnside,
    fg: buildKick,
    xp: buildKick,
    '2pt': build2pt,
    kneel: buildKneel,
    presnap: buildPreSnap,
    timeout: buildTimeout,
    formation: buildFormation
};

const REF_MODE = { kickoff: 'kick', onside: 'kick', punt: 'punt', fg: 'fg', xp: 'fg' };

/** Arma una jugada a partir de su especificación (tipo, yardas a la meta, ganancia, resultado, nombres…) */
export function buildPlay(spec) {
    const P = new Play(spec);
    officials(P, REF_MODE[spec.kind] || 'scrim');
    BUILDERS[spec.kind](P);
    if (spec.kind === 'presnap' || spec.penalty) penaltyWrap(P);
    // Jugada grande (20 yardas o más, sin anotación): su tarjeta al terminar, como «¡85 YARDAS!»
    if (spec.big && !P.events.some((e) => e.type === 'card')) P.ev(P.whistle + 0.15, 'card', { kind: 'big', side: 'off', title: `¡${spec.gain} YARDAS!`, sub: spec.bigText || '' });
    challengeWrap(P);
    P.finalize();
    // Números reales de los jugadores (juegos de la NFL): «P.Mahomes» → 15
    if (spec.jerseys)
        for (const a of P.actors) {
            const j = a.name && spec.jerseys[a.name];
            if (j) {
                a.num = j;
                a.realNum = true;
            }
        }
    return P;
}
