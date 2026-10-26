// Juego simulado de El Snap: reloj, cuartos, downs, posesiones, anotaciones, pañuelos, desafíos y tiempos fuera.
// Cada paso decide qué pasa (con semilla) y devuelve la especificación que el motor de jugadas anima.
import { FOULS, foulSpot, rng } from './plays.js';

export const TEAMS = [
    {
        id: 0,
        name: 'Tiburones',
        city: 'Santo Domingo',
        abbr: 'TIB',
        color: '#1e4fd8',
        color2: '#7cc4ff',
        emblem: 'shark',
        roster: {
            qb: { num: 12, n: 'Peña' },
            rb: { num: 28, n: 'Marte' },
            x: { num: 11, n: 'Soto' },
            z: { num: 13, n: 'Batista' },
            sl: { num: 17, n: 'Cruz' },
            te: { num: 87, n: 'Reyes' },
            k: { num: 3, n: 'Ozuna' },
            p: { num: 8, n: 'Valdez' },
            de: { num: 94, n: 'Jiménez' },
            dt: { num: 99, n: 'Mota' },
            lb: { num: 54, n: 'Guerrero' },
            cb: { num: 24, n: 'Rosario' },
            nb: { num: 31, n: 'Abreu' },
            fs: { num: 32, n: 'Polanco' },
            ss: { num: 29, n: 'Frías' },
            ret: { num: 84, n: 'Lora' }
        }
    },
    {
        id: 1,
        name: 'Volcanes',
        city: 'del Cibao',
        abbr: 'VOL',
        color: '#e11d48',
        color2: '#ffb38a',
        emblem: 'volcano',
        roster: {
            qb: { num: 7, n: 'Almonte' },
            rb: { num: 22, n: 'Féliz' },
            x: { num: 18, n: 'Taveras' },
            z: { num: 81, n: 'Peralta' },
            sl: { num: 15, n: 'Santana' },
            te: { num: 85, n: 'Ureña' },
            k: { num: 4, n: 'Medina' },
            p: { num: 6, n: 'Tejada' },
            de: { num: 97, n: 'Castillo' },
            dt: { num: 95, n: 'Vólquez' },
            lb: { num: 50, n: 'Encarnación' },
            cb: { num: 23, n: 'Mejía' },
            nb: { num: 36, n: 'Rondón' },
            fs: { num: 27, n: 'Núñez' },
            ss: { num: 20, n: 'Sánchez' },
            ret: { num: 19, n: 'Báez' }
        }
    }
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const QUARTER = ['', '1er cuarto', '2º cuarto', '3er cuarto', '4º cuarto', 'Prórroga'];
export const QSHORT = ['', '1C', '2C', '3C', '4C', 'OT'];
export const clockText = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
export const downText = (down, toGo, ytg) => `${down}ª y ${toGo >= ytg ? 'gol' : toGo}`;
const yd = (n) => `${n} ${Math.abs(n) === 1 ? 'yarda' : 'yardas'}`;

const newStats = () => ({ plays: 0, yards: 0, pass: 0, rush: 0, first: 0, to: 0, sacks: 0, pen: 0, penYds: 0, top: 0 });

export class Game {
    constructor(seed = Math.floor(Math.random() * 1e9)) {
        this.seed = seed;
        this.r = rng(seed);
        this.score = [0, 0];
        this.byQ = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ];
        this.q = 1;
        this.clock = 900;
        this.firstKick = this.r() < 0.5 ? 0 : 1;
        this.kicker = this.firstKick;
        this.kickFrom = 35;
        this.poss = 1 - this.firstKick;
        this.own = 25;
        this.down = 1;
        this.toGo = 10;
        this.phase = 'kickoff';
        this.timeouts = [3, 3];
        this.warned = {};
        this.over = false;
        this.log = [];
        this.drives = [];
        this.drive = null;
        this.stats = [newStats(), newStats()];
        this.wpHist = [this.wp()];
        this.pendingTimeout = null;
        this.n = 0;
    }

    dir(team) {
        return (team === 0) === (this.q % 2 === 1) ? 1 : -1;
    }
    losX(team, own) {
        return this.dir(team) > 0 ? 10 + own : 110 - own;
    }
    sides() {
        const leftTeam = this.dir(0) > 0 ? 0 : 1;
        return { left: TEAMS[leftTeam], right: TEAMS[1 - leftTeam] };
    }
    timeLeft() {
        return this.q <= 4 ? (4 - this.q) * 900 + this.clock : Math.max(this.clock, 60);
    }
    /** Probabilidad de ganar de los Tiburones (0–1) */
    wp() {
        if (this.over) return this.score[0] > this.score[1] ? 1 : this.score[0] < this.score[1] ? 0 : 0.5;
        let diff = this.score[0] - this.score[1];
        if (this.phase === 'scrim') {
            const ep = (this.own - 25) / 16 + 0.5;
            diff += this.poss === 0 ? ep : -ep;
        } else if (this.phase === 'pat') diff += this.poss === 0 ? 0.95 : -0.95;
        const sd = 13.5 * Math.sqrt(Math.max(this.timeLeft(), 20) / 3600) + 0.6;
        return 1 / (1 + Math.exp((-1.6 * diff) / sd));
    }
    snapshot() {
        return { score: [...this.score], q: this.q, clock: this.clock, poss: this.poss, own: this.own, down: this.down, toGo: this.toGo, phase: this.phase, timeouts: [...this.timeouts], wp: this.wp(), over: this.over };
    }
    spot(team, own) {
        if (own === 50) return '50';
        return own < 50 ? `${TEAMS[team].abbr} ${Math.round(own)}` : `${TEAMS[1 - team].abbr} ${Math.round(100 - own)}`;
    }

    // ------------------------------------------------------------ Paso a paso

    step() {
        if (this.over) return null;
        const before = this.snapshot();
        let rec;
        if (this.pendingTimeout != null) rec = this.timeout(this.pendingTimeout);
        else if (this.phase === 'scrim' && (this.q === 2 || this.q === 4) && this.clock <= 120 && !this.warned[this.q]) {
            this.warned[this.q] = true;
            this.clock = 120;
            rec = this.situation({ kind: 'timeout', variant: 'twomin' }, 'Aviso de 2 minutos: el reloj se detiene', 'Aviso de 2 minutos');
        } else if (this.phase === 'kickoff') rec = this.kickoff();
        else if (this.phase === 'pat') rec = this.pat();
        else rec = this.scrimmage();
        if (this.clock <= 0 && this.phase !== 'pat' && !this.over) rec.quarterEnd = this.endQuarter();
        rec.before = before;
        rec.after = this.snapshot();
        rec.n = ++this.n;
        this.wpHist.push(this.wp());
        rec.wp = this.wp();
        this.log.push(rec);
        return rec;
    }

    /** Arma el registro de una jugada: especificación para el motor, vista del campo, textos y datos */
    rec(team, spec, o) {
        const own = o.own ?? this.own;
        const ytg = spec.ytg ?? 100 - own;
        const losX = this.losX(team, own);
        const dir = this.dir(team);
        const { left, right } = this.sides();
        const fd = o.firstX ?? (this.phase === 'scrim' && !o.special && this.toGo < ytg ? losX + dir * this.toGo : null);
        return {
            team,
            q: this.q,
            clock: this.clock,
            kind: spec.kind,
            label: o.label,
            text: o.text,
            yards: o.yards ?? null,
            first: !!o.first,
            turnover: !!o.turnover,
            pts: o.pts || null,
            flag: !!spec.penalty,
            special: !!o.special,
            situation: !!o.situation,
            down: o.special ? null : downText(this.down, this.toGo, ytg),
            spotText: this.spot(team, own),
            drive: this.drive?.id ?? 0,
            spec: { offR: TEAMS[team].roster, defR: TEAMS[1 - team].roster, seed: (this.seed + this.n * 7919) >>> 0, ytg, ...spec },
            view: { losX, dir, offTeam: TEAMS[team], defTeam: TEAMS[1 - team], firstX: fd, left, right, losLabel: this.spot(team, own) }
        };
    }

    startDrive(team) {
        if (this.drive && this.drive.team === team && !this.drive.result) return;
        this.closeDrive();
        this.drive = { id: this.drives.length + 1, team, start: this.spot(team, this.own), startOwn: this.own, plays: 0, yards: 0, q: this.q, clock: this.clock, secs: 0, result: '' };
        this.drives.push(this.drive);
    }
    closeDrive(result) {
        if (this.drive && !this.drive.result) this.drive.result = result || 'Fin';
    }
    tick(sec) {
        const s = Math.min(sec, this.clock);
        this.clock -= s;
        if (this.phase === 'scrim' && this.drive) {
            this.drive.secs += s;
            this.stats[this.poss].top += s;
        }
    }
    points(team, n) {
        this.score[team] += n;
        this.byQ[team][Math.min(this.q, 5) - 1] += n;
    }
    changePoss(newOwn, result) {
        this.closeDrive(result);
        this.poss = 1 - this.poss;
        this.own = clamp(Math.round(newOwn), 1, 99);
        this.down = 1;
        this.toGo = Math.min(10, 100 - this.own);
        this.phase = 'scrim';
        this.startDrive(this.poss);
    }
    endQuarter() {
        const q = this.q;
        if (q === 1 || q === 3) {
            this.q++;
            this.clock = 900;
            return `Fin del ${QUARTER[q]}: los equipos cambian de lado`;
        }
        if (q === 2) {
            this.closeDrive('Fin de la mitad');
            this.q = 3;
            this.clock = 900;
            this.phase = 'kickoff';
            this.kicker = 1 - this.firstKick;
            this.kickFrom = 35;
            this.timeouts = [3, 3];
            return 'Medio tiempo';
        }
        if (q === 4 && this.score[0] === this.score[1]) {
            this.closeDrive('Fin del tiempo');
            this.q = 5;
            this.clock = 600;
            this.phase = 'kickoff';
            this.kicker = this.r() < 0.5 ? 0 : 1;
            this.kickFrom = 35;
            this.timeouts = [2, 2];
            return 'Empate: ¡prórroga!';
        }
        this.closeDrive('Fin del juego');
        this.over = true;
        this.phase = 'final';
        return 'Final del juego';
    }
    /** ¿Termina el juego por anotar en prórroga? */
    suddenDeath() {
        if (this.q === 5 && this.score[0] !== this.score[1]) {
            this.over = true;
            this.phase = 'final';
            this.closeDrive('Anotación en prórroga');
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------ Patadas

    kickoff() {
        const r = this.r;
        const k = this.kicker;
        const recv = 1 - k;
        const from = this.kickFrom;
        const ytg = 100 - from;
        const K = TEAMS[k];
        const R = TEAMS[recv];
        this.own = from;
        const trailing = this.score[k] < this.score[recv] && this.score[recv] - this.score[k] <= 8;
        if (from === 35 && this.q === 4 && this.clock < 240 && trailing) {
            const got = r() < 0.18;
            const rec = this.rec(k, { kind: 'onside', recover: got ? 'off' : 'def' }, { own: from, special: true, label: 'Patada corta', text: `Patada corta (onside) de ${K.roster.k.n}: ${got ? `¡la recupera ${K.name}!` : `la asegura ${R.name}`}`, turnover: false });
            this.tick(4);
            if (got) {
                this.poss = k;
                this.own = from + 12;
                this.down = 1;
                this.toGo = 10;
                this.phase = 'scrim';
                this.closeDrive();
                this.startDrive(k);
            } else {
                this.poss = k;
                this.changePoss(100 - (from + 12), 'Patada corta');
            }
            rec.drive = this.drive.id;
            return rec;
        }
        const tb = from === 35 && r() < 0.58;
        let land;
        let ret = 0;
        let td = false;
        if (tb) land = ytg + 1 + Math.round(r() * 6);
        else {
            land = from === 35 ? ytg - 2 - Math.round(r() * 7) : ytg - 14 - Math.round(r() * 12);
            ret = 15 + Math.round(r() * 15);
            if (r() < 0.06) ret += 20 + Math.round(r() * 20);
            if (r() < 0.012) td = true;
        }
        let newOwn = tb ? 25 : ytg - land + ret;
        if (newOwn >= 100) td = true;
        newOwn = clamp(newOwn, 1, 99);
        const spec = { kind: 'kickoff', land, ret: td ? 99 : Math.max(0, Math.round(newOwn - (ytg - land))), touchback: tb, result: td ? 'td' : '' };
        const text = tb
            ? `${K.roster.k.n} patea hasta la zona de anotación: touchback, ${R.name} empieza en su 25`
            : td
              ? `¡${R.roster.ret.n} regresa la patada inicial hasta la zona de anotación! Touchdown de ${R.name}`
              : `Patada inicial de ${K.roster.k.n}; ${R.roster.ret.n} la regresa ${spec.ret} yardas hasta la ${this.spot(recv, newOwn)}`;
        const rec = this.rec(k, spec, { own: from, special: true, label: from === 20 ? 'Patada libre' : 'Patada inicial', text, pts: td ? { team: recv, n: 6, label: 'TD' } : null });
        this.tick(tb ? 0 : 6);
        this.poss = k;
        this.closeDrive();
        this.changePoss(td ? 99 : newOwn);
        rec.drive = this.drive.id;
        if (td) {
            this.points(recv, 6);
            this.closeDrive('Touchdown');
            this.phase = 'pat';
            this.suddenDeath();
        }
        return rec;
    }

    punt() {
        const r = this.r;
        const p = this.poss;
        const d = 1 - p;
        const ytg = 100 - this.own;
        const land = Math.min(39 + Math.round(r() * 13), ytg + 6);
        const tb = land >= ytg;
        const fair = !tb && r() < 0.35;
        let ret = tb || fair ? 0 : Math.round(r() * 12);
        if (!tb && !fair && r() < 0.04) ret += 15 + Math.round(r() * 15);
        const newOwn = tb ? 20 : ytg - land + ret;
        const T = TEAMS[p];
        const spec = { kind: 'punt', land, ret, fair, touchback: tb };
        const text = tb ? `Despeje de ${T.roster.p.n} que entra a la zona: touchback` : fair ? `Despeje de ${land} yardas de ${T.roster.p.n}; ${TEAMS[d].roster.ret.n} pide fair catch` : `Despeje de ${land} yardas de ${T.roster.p.n}; ${TEAMS[d].roster.ret.n} lo regresa ${yd(ret)}`;
        const rec = this.rec(p, spec, { special: true, label: 'Despeje', text });
        this.tick(7);
        this.changePoss(newOwn, 'Despeje');
        return rec;
    }

    fieldGoal() {
        const r = this.r;
        const p = this.poss;
        const ytg = 100 - this.own;
        const dist = ytg + 17;
        const pGood = dist < 30 ? 0.97 : dist < 40 ? 0.91 : dist < 50 ? 0.8 : 0.6;
        const roll = r();
        const blocked = roll < 0.02;
        const good = !blocked && roll < pGood;
        const T = TEAMS[p];
        const miss = r() < 0.5 ? 'left' : 'right';
        const spec = { kind: 'fg', result: blocked ? 'blocked' : good ? 'good' : 'miss', miss };
        const text = blocked ? `¡Bloquean el gol de campo de ${dist} yardas de ${T.roster.k.n}!` : good ? `Gol de campo de ${dist} yardas de ${T.roster.k.n}: ¡es bueno!` : `${T.roster.k.n} falla el gol de campo de ${dist} yardas (desviado a la ${miss === 'left' ? 'izquierda' : 'derecha'})`;
        const rec = this.rec(p, spec, { special: true, label: 'Gol de campo', text, pts: good ? { team: p, n: 3, label: 'FG' } : null, turnover: !good });
        this.tick(5);
        if (good) {
            this.points(p, 3);
            this.closeDrive('Gol de campo');
            if (!this.suddenDeath()) {
                this.phase = 'kickoff';
                this.kicker = p;
                this.kickFrom = 35;
            }
        } else this.changePoss(blocked ? 100 - (this.own - 4) : Math.max(20, ytg + 7), blocked ? 'Patada bloqueada' : 'Gol de campo fallado');
        return rec;
    }

    pat() {
        const r = this.r;
        const p = this.poss;
        const d = 1 - p;
        const T = TEAMS[p];
        const lead = this.score[p] - this.score[d];
        const go2 = (this.q >= 4 && this.clock < 600 && [-2, -5, -10, 1, 5, -1].includes(lead)) || r() < 0.05;
        let rec;
        if (go2) {
            const ok = r() < 0.48;
            const sub = r() < 0.55 ? 'pass' : 'run';
            const spec = sub === 'pass' ? { kind: '2pt', sub, variant: 'short', result: ok ? 'td' : 'incomplete', gain: 2 } : { kind: '2pt', sub, variant: r() < 0.5 ? 'inside' : 'outside', result: ok ? 'td' : '', gain: ok ? 2 : 1 };
            rec = this.rec(p, { ytg: 2, ...spec }, { own: 98, special: true, label: 'Conversión de 2', text: `Conversión de 2 ${sub === 'pass' ? 'por pase' : 'por tierra'}: ${ok ? '¡buena!' : 'falla'}`, pts: ok ? { team: p, n: 2, label: '2PT' } : null });
            if (ok) this.points(p, 2);
        } else {
            const good = r() < 0.945;
            rec = this.rec(p, { kind: 'xp', ytg: 15, result: good ? 'good' : 'miss', miss: r() < 0.5 ? 'left' : 'right' }, { own: 85, special: true, label: 'Punto extra', text: `Punto extra de ${T.roster.k.n}: ${good ? 'bueno' : 'fallado'}`, pts: good ? { team: p, n: 1, label: 'XP' } : null });
            if (good) this.points(p, 1);
        }
        this.phase = 'kickoff';
        this.kicker = p;
        this.kickFrom = 35;
        return rec;
    }

    // ------------------------------------------------------------ Jugadas desde la línea

    /** Resultado de ganar `gain` yardas: touchdown, safety, primera, cambio por downs o normal */
    peek(gain) {
        const ytg = 100 - this.own;
        if (gain >= ytg) return 'td';
        if (this.own + gain <= 0) return 'safety';
        if (gain >= this.toGo) return 'first';
        if (this.down === 4) return 'downs';
        return 'ok';
    }
    applyGain(gain, kindStat) {
        const p = this.poss;
        const out = this.peek(gain);
        const st = this.stats[p];
        st.plays++;
        if (this.drive) this.drive.plays++;
        if (out !== 'safety') {
            st.yards += Math.min(gain, 100 - this.own);
            if (kindStat) st[kindStat] += Math.min(gain, 100 - this.own);
            if (this.drive) this.drive.yards += Math.min(gain, 100 - this.own);
        }
        if (out === 'td') {
            this.points(p, 6);
            this.closeDrive('Touchdown');
            this.phase = 'pat';
            this.own = 98;
            this.suddenDeath();
            return out;
        }
        if (out === 'safety') {
            this.points(1 - p, 2);
            this.closeDrive('Safety');
            if (!this.suddenDeath()) {
                this.phase = 'kickoff';
                this.kicker = p;
                this.kickFrom = 20;
            }
            return out;
        }
        this.own += gain;
        if (out === 'first') {
            st.first++;
            this.down = 1;
            this.toGo = Math.min(10, 100 - this.own);
            return out;
        }
        this.down++;
        this.toGo -= gain;
        if (this.down > 4) {
            this.stats[p].to++;
            this.changePoss(100 - this.own, 'Cuarta fallida');
            return 'downs';
        }
        return out;
    }

    scrimmage() {
        const r = this.r;
        const p = this.poss;
        const d = 1 - p;
        const ytg = 100 - this.own;
        const lead = this.score[p] - this.score[d];
        this.startDrive(p);
        if (this.q === 4 && lead > 0 && this.clock <= 110) return this.kneel();
        if ((this.q === 2 || this.q === 4) && this.clock <= 8 && ytg >= 30 && ytg <= 62 && (this.q === 2 || lead <= 0)) return this.hail();
        if ((this.q === 2 || this.q === 4) && this.clock <= 35 && this.clock > 8 && lead <= 0 && this.down < 4 && this.timeouts[p] === 0 && r() < 0.35) return this.spike();
        if (this.down === 4) {
            const fgd = ytg + 17;
            const desperate = this.q >= 4 && lead < 0 && this.clock < 300;
            const goForIt = desperate ? !(fgd <= 50 && lead >= -3) : (this.toGo <= 2 && this.own >= 42 && fgd > 50 && r() < 0.55) || (this.toGo <= 1 && ytg <= 4 && r() < 0.45);
            if (!goForIt) return fgd <= 56 ? this.fieldGoal() : this.punt();
        }
        if (r() < 0.065) return this.penalty();
        const passP = this.toGo >= 8 ? 0.66 : this.toGo <= 2 ? 0.32 : 0.55;
        return r() < passP ? this.pass() : this.run();
    }

    runClock() {
        return this.clock <= 120 && (this.q === 2 || this.q === 4) ? 20 : 33 + Math.round(this.r() * 7);
    }

    run() {
        const r = this.r;
        const p = this.poss;
        const T = TEAMS[p];
        const D = TEAMS[1 - p];
        const ytg = 100 - this.own;
        const u = r();
        let gain = u < 0.1 ? -1 - Math.floor(r() * 3) : u < 0.22 ? Math.floor(r() * 2) : u < 0.62 ? 2 + Math.floor(r() * 4) : u < 0.86 ? 6 + Math.floor(r() * 5) : u < 0.96 ? 11 + Math.floor(r() * 9) : 20 + Math.floor(r() * 40);
        let variant = this.toGo <= 1 && r() < 0.5 ? 'sneak' : r() < 0.1 ? 'jet' : r() < 0.33 ? 'outside' : 'inside';
        if (variant === 'sneak') gain = r() < 0.7 ? 1 + Math.floor(r() * 2) : 0;
        if (variant === 'jet' || variant === 'outside') gain = Math.max(gain, -2);
        gain = Math.min(gain, ytg);
        const carrier = variant === 'sneak' ? T.roster.qb.n : variant === 'jet' ? T.roster.sl.n : T.roster.rb.n;
        // Balón suelto
        if (r() < 0.014 && gain < ytg && gain > 0) {
            const scoop = r() < 0.12;
            const spec = { kind: 'run', variant: variant === 'sneak' ? 'inside' : variant, gain, fumble: true, scoop };
            const rec = this.rec(p, spec, { label: 'Balón suelto', text: scoop ? `¡${carrier} pierde el balón y la defensa lo regresa para touchdown!` : `¡Balón suelto! ${carrier} lo pierde y lo recupera ${D.name}`, turnover: true, pts: scoop ? { team: 1 - p, n: 6, label: 'TD' } : null });
            this.stats[p].plays++;
            this.stats[p].rush += gain;
            this.stats[p].to++;
            this.tick(scoop ? 12 : 8);
            if (scoop) {
                this.changePoss(99, 'Balón suelto');
                this.points(this.poss, 6);
                this.closeDrive('Touchdown');
                this.phase = 'pat';
                this.suddenDeath();
            } else this.changePoss(100 - (this.own + gain + 2), 'Balón suelto');
            return rec;
        }
        const out = this.peek(gain);
        const spec = { kind: 'run', variant, gain, result: out === 'td' ? 'td' : '', first: out === 'first', downs: out === 'downs' };
        const how = { inside: 'por el medio', outside: 'por fuera', sneak: 'de frente (QB sneak)', jet: 'en jet sweep' }[variant];
        const text = out === 'td' ? `¡Touchdown! ${carrier} corre ${yd(gain)} ${how} hasta la zona de anotación` : out === 'safety' ? `¡Safety! Derriban a ${carrier} en su propia zona` : `${carrier} corre ${how}: ${gain > 0 ? `gana ${yd(gain)}` : gain < 0 ? `pierde ${yd(-gain)}` : 'sin ganancia'}`;
        const rec = this.rec(p, spec, { label: out === 'td' ? 'TD por tierra' : 'Carrera', text, yards: gain, first: out === 'first', turnover: out === 'downs', pts: out === 'td' ? { team: p, n: 6, label: 'TD' } : out === 'safety' ? { team: 1 - p, n: 2, label: 'SAF' } : null });
        this.tick(out === 'td' ? 8 : this.runClock());
        this.applyGain(gain, 'rush');
        this.maybeTimeout();
        return rec;
    }

    pass() {
        const r = this.r;
        const p = this.poss;
        const T = TEAMS[p];
        const D = TEAMS[1 - p];
        const ytg = 100 - this.own;
        const u = r();
        const qb = T.roster.qb.n;
        if (u < 0.065) {
            let gain = -(4 + Math.floor(r() * 7));
            const safety = this.own + gain <= 0;
            if (safety) gain = -this.own;
            const rec = this.rec(p, { kind: 'sack', gain, result: safety ? 'safety' : '' }, { label: safety ? 'Safety' : 'Sack', text: safety ? `¡Safety! ${D.roster.de.n} captura a ${qb} dentro de su zona` : `Sack: ${D.roster.de.n} captura a ${qb}, pierde ${yd(-gain)}`, yards: gain, pts: safety ? { team: 1 - p, n: 2, label: 'SAF' } : null, turnover: !safety && this.down === 4 });
            this.stats[1 - p].sacks++;
            this.tick(this.runClock());
            this.applyGain(gain, 'pass');
            return rec;
        }
        if (u < 0.105) {
            const gain = Math.min(2 + Math.floor(r() * 12), ytg);
            const out = this.peek(gain);
            const rec = this.rec(p, { kind: 'scramble', gain, slide: r() < 0.6, result: out === 'td' ? 'td' : '', first: out === 'first', downs: out === 'downs' }, { label: out === 'td' ? 'TD por tierra' : 'Scramble', text: out === 'td' ? `¡${qb} sale corriendo y anota!` : `${qb} no encuentra a nadie y sale corriendo: ${yd(gain)}`, yards: gain, first: out === 'first', turnover: out === 'downs', pts: out === 'td' ? { team: p, n: 6, label: 'TD' } : null });
            this.tick(this.runClock());
            this.applyGain(gain, 'rush');
            return rec;
        }
        const v = r();
        const variant = v < 0.52 ? 'short' : v < 0.82 ? 'medium' : v < 0.94 ? 'deep' : 'screen';
        const pa = (variant === 'deep' || variant === 'medium') && this.down <= 2 && r() < 0.25;
        const flea = variant === 'deep' && !pa && r() < 0.08;
        if (u < 0.131) {
            const catchU = variant === 'deep' ? 20 + Math.floor(r() * 15) : variant === 'medium' ? 10 + Math.floor(r() * 6) : 4 + Math.floor(r() * 4);
            const cu = Math.min(catchU, ytg + 5);
            const pick6 = r() < 0.08;
            const ret = pick6 ? 0 : Math.floor(r() * 25);
            const spec = { kind: 'pass', variant: variant === 'screen' ? 'short' : variant, result: 'int', catchU: cu, ret, pick6, pa };
            const rec = this.rec(p, spec, { label: pick6 ? 'Pick-six' : 'Intercepción', text: pick6 ? `¡Pick-six! ${D.roster.cb.n} intercepta a ${qb} y anota` : `¡Intercepción! ${D.name} se roba el pase de ${qb} y lo regresa ${yd(ret)}`, turnover: true, pts: pick6 ? { team: 1 - p, n: 6, label: 'TD' } : null });
            this.stats[p].plays++;
            this.stats[p].to++;
            this.tick(this.runClock());
            if (pick6) {
                this.changePoss(99, 'Intercepción');
                this.points(this.poss, 6);
                this.closeDrive('Touchdown');
                this.phase = 'pat';
                this.suddenDeath();
            } else {
                const endU = Math.min(cu + 0.8, ytg + 8) - ret;
                const nOwn = 100 - (this.own + endU);
                this.changePoss(nOwn >= 100 ? 99 : nOwn <= 0 ? 20 : nOwn, 'Intercepción');
            }
            return rec;
        }
        if (u < 0.44) {
            const out = this.down === 4 ? 'downs' : 'ok';
            const rec = this.rec(p, { kind: 'pass', variant: variant === 'screen' ? 'short' : variant, result: 'incomplete', pa, downs: out === 'downs' }, { label: 'Incompleto', text: `Pase incompleto de ${qb}`, yards: 0, turnover: out === 'downs' });
            this.tick(5);
            this.applyGain(0, 'pass');
            return rec;
        }
        let gain = variant === 'short' ? 2 + Math.floor(r() * 8) + (r() < 0.2 ? Math.floor(r() * 10) : 0) : variant === 'medium' ? 10 + Math.floor(r() * 10) + (r() < 0.2 ? Math.floor(r() * 12) : 0) : variant === 'deep' ? 20 + Math.floor(r() * 29) : -2 + Math.floor(r() * 16);
        gain = Math.min(gain, ytg);
        const out = this.peek(gain);
        const challenge = variant === 'medium' && out === 'first' && !pa && r() < 0.12 && this.timeouts[1 - p] > 0;
        const upheld = r() < 0.7;
        const spec = flea
            ? { kind: 'flea', gain, result: out === 'td' ? 'td' : '', first: out === 'first' }
            : { kind: 'pass', variant, gain, pa, result: out === 'td' ? 'td' : '', first: out === 'first' && !(challenge && !upheld), downs: out === 'downs', ...(challenge ? { target: 'Z', route: 'out', challenge: true, upheld } : {}) };
        const T2 = T.roster;
        const to = [T2.x.n, T2.z.n, T2.sl.n, T2.te.n][Math.floor(r() * 4)];
        const text = flea ? `Flea flicker: ${qb} recibe el balón de vuelta y lanza profundo, ${out === 'td' ? '¡touchdown!' : `ganancia de ${yd(gain)}`}` : out === 'td' ? `¡Touchdown! Pase de ${yd(gain)} de ${qb}` : `${pa ? 'Play-action: ' : ''}pase ${variant === 'screen' ? 'de pantalla' : variant === 'deep' ? 'profundo' : ''} de ${qb} a ${variant === 'screen' ? T2.rb.n : to}: ${gain >= 0 ? `gana ${yd(gain)}` : `pierde ${yd(-gain)}`}`;
        if (challenge && !upheld) {
            const rec = this.rec(p, spec, { label: 'Desafío', text: `Pase completo… pero ${D.name} lo desafía y se revoca: incompleto`, yards: 0 });
            this.tick(5);
            this.applyGain(0, 'pass');
            return rec;
        }
        const rec = this.rec(p, spec, { label: out === 'td' ? 'TD por aire' : challenge ? 'Desafío' : 'Pase', text: challenge ? `${text}. ${D.name} lo desafía y se confirma` : text, yards: gain, first: out === 'first', turnover: out === 'downs', pts: out === 'td' ? { team: p, n: 6, label: 'TD' } : null });
        if (challenge) this.timeouts[1 - p]--;
        this.tick(out === 'td' ? 8 : this.runClock());
        this.applyGain(gain, 'pass');
        this.maybeTimeout();
        return rec;
    }

    penalty() {
        const r = this.r;
        const p = this.poss;
        const T = TEAMS[p];
        const D = TEAMS[1 - p];
        const ytg = 100 - this.own;
        const w = r();
        const code = w < 0.24 ? 'false_start' : w < 0.48 ? 'holding' : w < 0.62 ? 'offside' : w < 0.68 ? 'delay' : w < 0.8 ? 'dpi' : w < 0.87 ? 'roughing' : 'facemask';
        const f = FOULS[code];
        const guilty = f.team === 'off' ? p : 1 - p;
        let spec;
        let to;
        let auto1st = false;
        if (f.when === 'pre') {
            to = foulSpot(code, ytg, 0);
            spec = { kind: 'presnap', penalty: { code, to } };
        } else if (code === 'holding') {
            to = foulSpot(code, ytg, 0);
            const g = Math.min(4 + Math.floor(r() * 10), ytg - 1);
            spec = { kind: r() < 0.5 ? 'run' : 'pass', variant: r() < 0.5 ? 'inside' : 'short', gain: g, penalty: { code, to } };
            if (spec.kind === 'pass') spec.variant = 'short';
        } else if (code === 'dpi') {
            const cu = Math.min(10 + Math.floor(r() * 22), ytg + 4);
            to = foulSpot(code, ytg, cu);
            spec = { kind: 'pass', variant: cu > 17 ? 'deep' : 'medium', result: 'incomplete', catchU: cu, penalty: { code, to } };
            auto1st = true;
        } else {
            const g = Math.min(2 + Math.floor(r() * 7), ytg - 2);
            to = foulSpot(code, ytg, g);
            spec = code === 'roughing' ? { kind: 'pass', variant: 'short', gain: g, penalty: { code, to } } : { kind: 'run', variant: 'inside', gain: g, penalty: { code, to } };
            auto1st = true;
        }
        const yards = Math.round(to);
        const text = `Pañuelo: ${f.name.toLowerCase()} contra ${TEAMS[guilty].name} (${yards >= 0 ? '+' : ''}${yards} para ${T.abbr}${auto1st ? ', primera y 10' : ''})`;
        const rec = this.rec(p, spec, { label: 'Pañuelo', text, yards });
        this.stats[guilty].pen++;
        this.stats[guilty].penYds += Math.abs(yards);
        this.tick(f.when === 'pre' ? 0 : code === 'dpi' ? 6 : 8);
        this.own = clamp(this.own + yards, 1, 99);
        if (auto1st || yards >= this.toGo) {
            this.down = 1;
            this.toGo = Math.min(10, 100 - this.own);
        } else this.toGo = Math.min(this.toGo - yards, 100 - this.own);
        return rec;
    }

    maybeTimeout() {
        const d = 1 - this.poss;
        if (this.phase === 'scrim' && this.q === 4 && this.clock < 180 && this.clock > 10 && this.score[d] < this.score[this.poss] && this.timeouts[d] > 0 && this.r() < 0.6) this.pendingTimeout = d;
    }

    timeout(team) {
        this.pendingTimeout = null;
        this.timeouts[team]--;
        const left = this.timeouts[team];
        return this.situation({ kind: 'timeout', sub: `A ${TEAMS[team].name} le ${left === 1 ? 'queda 1' : `quedan ${left}`}` }, `Tiempo fuera de ${TEAMS[team].name}`, 'Tiempo fuera');
    }

    situation(spec, text, label) {
        return this.rec(this.poss, { ...spec }, { special: true, situation: true, label, text, firstX: null });
    }

    kneel() {
        const p = this.poss;
        const rec = this.rec(p, { kind: 'kneel', gain: -1 }, { label: 'Rodilla', text: `${TEAMS[p].roster.qb.n} se arrodilla para gastar el reloj`, yards: -1 });
        this.tick(Math.min(40, this.clock));
        this.applyGain(-1);
        return rec;
    }

    spike() {
        const p = this.poss;
        const rec = this.rec(p, { kind: 'spike', gain: 0 }, { label: 'Spike', text: `${TEAMS[p].roster.qb.n} clava el balón para detener el reloj`, yards: 0 });
        this.tick(2);
        this.applyGain(0);
        return rec;
    }

    hail() {
        const r = this.r;
        const p = this.poss;
        const ytg = 100 - this.own;
        const ok = r() < 0.12;
        const rec = this.rec(p, { kind: 'hail', result: ok ? 'td' : 'incomplete', target: 'Z' }, { label: ok ? 'Hail Mary TD' : 'Hail Mary', text: ok ? `¡Hail Mary! ${TEAMS[p].roster.qb.n} lanza ${ytg} yardas y la atrapan en la zona` : `Hail Mary de ${TEAMS[p].roster.qb.n}: incompleto`, yards: ok ? ytg : 0, pts: ok ? { team: p, n: 6, label: 'TD' } : null });
        this.tick(this.clock);
        this.applyGain(ok ? ytg : 0, 'pass');
        return rec;
    }

    /** Juega hasta la próxima anotación (sin animar) y devuelve las jugadas saltadas */
    skipToScore() {
        const skipped = [];
        while (!this.over) {
            const before = this.score[0] + this.score[1];
            const rec = this.step();
            if (!rec) break;
            skipped.push(rec);
            if (this.score[0] + this.score[1] !== before) break;
            if (skipped.length > 200) break;
        }
        return skipped;
    }
}
