// Juegos: la portada de El Play para la NFL. Fecha y título, aviso para instalar, los escudos de los equipos
// del día, los días con juegos y las tarjetas de cada juego (por empezar, en vivo y final).
import { $, $$, esc, I, badge, settings, saveSettings, toggleIn, toast, share } from '../ui.js';
import { LOGO_PATHS } from '../field.js';
import { scoreboard, eventCards } from '../espn.js';
import { describe } from '../nfl.js';
import { store, install } from '../store.js';
import { teamVars, timeOf, dayOf, longDay, soon, dayKey, miniField, ownFrom } from './common.js';

const today = () => dayKey(Date.now());
const rel = (key) => {
    const d = (new Date(`${key}T12:00`) - new Date(`${today()}T12:00`)) / 864e5;
    return d === 0 ? 'Hoy' : d === -1 ? 'Ayer' : d === 1 ? 'Mañana' : null;
};

export function homeView(el, params) {
    let alive = true;
    let timer = 0;
    let week = params.w ? Number(params.w) : undefined;
    let stype = params.t ? Number(params.t) : undefined;
    let day = params.d || null;
    let filter = null;
    let games = [];

    el.innerHTML = `<div class="screen flush">
  <header class="home-h"><div><div class="h-date"></div><h1 class="h-title">NFL</h1></div><button class="logo-tile" aria-label="Elegir semana"><svg viewBox="0 0 64 64" aria-hidden="true">${LOGO_PATHS('lg-home')}</svg></button></header>
  <div class="install-slot"></div>
  <div class="stories" role="list"></div>
  <div class="pills days" role="tablist" aria-label="Días"></div>
  <div class="cards"><div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div></div>
</div>`;

    const load = async () => {
        clearTimeout(timer);
        try {
            const sb = await scoreboard({ week, seasontype: stype });
            if (!alive) return;
            store.sb = sb;
            store.week = sb.week?.number ?? week;
            store.stype = sb.season?.type ?? stype;
            week = store.week;
            stype = store.stype;
            games = eventCards(sb);
            store.games = games;
            store.emit();
            const keys = [...new Set(games.map((g) => dayKey(g.date)))].sort();
            if (!day || (!keys.includes(day) && day !== today())) {
                const t = today();
                day = keys.includes(t) ? t : keys.find((k) => k > t) || keys[keys.length - 1] || t;
                const live = games.find((g) => g.state === 'in');
                if (live) day = dayKey(live.date);
            }
            render();
            if (games.some((g) => g.state === 'in')) timer = setTimeout(load, 10000);
        } catch {
            if (!alive) return;
            $('.cards', el).innerHTML = `<div class="sec empty-card">${I.info}<b>No se pudieron cargar los juegos</b><p class="muted">Si estás en la red de un trabajo o una escuela, puede que bloquee los datos deportivos: prueba con tus datos móviles.</p><button class="pill2 sm on retry">Reintentar</button></div>`;
            $('.retry', el).onclick = load;
        }
    };

    function render() {
        const keys = [...new Set(games.map((g) => dayKey(g.date)))].sort();
        if (!keys.includes(today())) keys.push(today());
        keys.sort();
        $('.h-date', el).textContent = longDay(`${day}T12:00`);
        $('.h-title', el).textContent = day === today() ? 'Hoy en la NFL' : `NFL · Semana ${week ?? ''}`.trim();
        // Aviso para instalar
        $('.install-slot', el).innerHTML = install.can() && !settings.hideInstall ? `<div class="install-banner"><svg class="lg" viewBox="0 0 64 64" aria-hidden="true">${LOGO_PATHS('lg-ib')}</svg><div><b>Ten El Snap en tu teléfono</b><small>Gratis, sin tienda y en segundos</small></div><button class="ib-go">${I.download}Instalar</button><button class="ib-x" aria-label="Ahora no">${I.x}</button></div>` : '';
        $('.ib-go', el)?.addEventListener('click', () => install.prompt());
        $('.ib-x', el)?.addEventListener('click', () => {
            settings.hideInstall = true;
            saveSettings();
            render();
        });
        // Días
        const dayGames = (k) => games.filter((g) => dayKey(g.date) === k);
        $('.days', el).innerHTML =
            `<button class="pill2 wk" data-w="-1">${I.left}Sem. ${Math.max(1, (week || 2) - 1)}</button>` +
            keys
                .map((k) => {
                    const gs = dayGames(k);
                    const label = rel(k) || dayOf(`${k}T12:00`);
                    return `<button class="pill2 ${k === day ? 'on' : ''} ${gs.length ? '' : 'dim'}" data-d="${k}" role="tab" aria-selected="${k === day}">${esc(label)}${gs.some((g) => g.state === 'in') ? '<i class="ldot"></i>' : ''}</button>`;
                })
                .join('') +
            `<button class="pill2 wk" data-w="1">Sem. ${(week || 0) + 1}${I.chev}</button>`;
        $$('.days .pill2 svg', el).forEach((s) => s.setAttribute('width', '14'));
        $('.days .on', el)?.scrollIntoView({ inline: 'center', block: 'nearest' });
        // Escudos del día
        const list = dayGames(day);
        const teamsToday = list.flatMap((g) => g.teams.map((t) => ({ t, g })));
        const order = { in: 0, pre: 1, post: 2 };
        teamsToday.sort((a, b) => order[a.g.state] - order[b.g.state] || a.t.abbr.localeCompare(b.t.abbr));
        $('.stories', el).innerHTML = teamsToday
            .map(({ t, g }) => `<button class="story ${g.state === 'in' ? 'live' : g.state === 'pre' ? 'later' : 'final'} ${filter === t.abbr ? 'sel' : ''}" data-t="${esc(t.abbr)}" aria-label="${esc(t.full)}"><span class="story-ring">${badge(t)}</span><span>${esc(t.abbr)}</span></button>`)
            .join('');
        // Tarjetas
        const fav = (g) => g.teams.some((t) => settings.favs.includes(t.abbr));
        const shown = list.filter((g) => !filter || g.teams.some((t) => t.abbr === filter)).sort((a, b) => order[a.state] - order[b.state] || fav(b) - fav(a) || new Date(a.date) - new Date(b.date));
        $('.cards', el).innerHTML = shown.length ? shown.map(card).join('') : emptyCard(keys, dayGames);
        if (!shown.length) $('.next-day', el)?.addEventListener('click', (e) => go(e.currentTarget.dataset.d));
    }

    function emptyCard(keys) {
        const next = keys.find((k) => k > day && games.some((g) => dayKey(g.date) === k));
        return `<div class="sec empty-card">${I.clock}<b>${filter ? 'Ese equipo no juega este día' : 'No hay juegos este día'}</b>${next ? `<button class="link next-day" data-d="${next}">Próximos juegos: ${esc(dayOf(`${next}T12:00`))} →</button>` : '<p class="muted">No hay juegos programados en estas fechas.</p>'}</div>`;
    }

    const go = (k) => {
        day = k;
        filter = null;
        history.replaceState(null, '', `#/?w=${week}&t=${stype}&d=${k}`);
        render();
    };

    el.addEventListener('click', (ev) => {
        const d = ev.target.closest('.days [data-d]');
        if (d) return go(d.dataset.d);
        const w = ev.target.closest('.days [data-w]');
        if (w) {
            week = Math.max(1, (week || 1) + Number(w.dataset.w));
            day = null;
            $('.cards', el).innerHTML = '<div class="skel-card"></div><div class="skel-card"></div>';
            return load();
        }
        const st = ev.target.closest('.story');
        if (st) {
            filter = filter === st.dataset.t ? null : st.dataset.t;
            return render();
        }
        const bell = ev.target.closest('.bell');
        if (bell) {
            ev.preventDefault();
            const on = toggleIn('bells', bell.dataset.id);
            toast(on ? 'Listo: te avisamos cuando empiece.' : 'Quitamos el aviso de este juego.');
            if (on && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
            return render();
        }
        const sh = ev.target.closest('.share-g');
        if (sh) {
            ev.preventDefault();
            const g = games.find((x) => x.id === sh.dataset.id);
            if (g) share(`${g.teams[0].abbr} ${g.teams[0].score}-${g.teams[1].score} ${g.teams[1].abbr}`, `${g.teams[0].name} ${g.teams[0].score} · ${g.teams[1].name} ${g.teams[1].score} (Final) en El Snap`);
        }
        const logo = ev.target.closest('.logo-tile');
        if (logo) {
            week = undefined;
            stype = undefined;
            day = null;
            load();
        }
    });

    load();
    return {
        unmount() {
            alive = false;
            clearTimeout(timer);
        }
    };
}

// Última jugada que ya se mostró de cada juego en vivo: cuando cambia, la franja se ilumina un momento
const seenLast = new Map();

/** Tarjeta de un juego, como GameFeedCard de El Play */
export function card(g) {
    const [a, h] = g.teams;
    const href = `#/juego/${g.id}`;
    const favStar = (t) => (settings.favs.includes(t.abbr) ? `<span class="fav">${I.starFill}</span>` : '');
    if (g.state === 'in') {
        const sit = g.situation;
        const poss = sit?.possession;
        const att = poss === h.id ? h : a;
        const def = att === h ? a : h;
        const own = sit ? ownFrom(sit.spot, att.abbr) : null;
        const half = /medio tiempo|half/i.test(g.detail);
        const ball = (t) => (poss === t.id && !half ? `<span class="ballpos">${I.ball}</span>` : '');
        const lp = sit?.lastPlay ? describe(sit.lastPlay) : '';
        const fresh = lp && seenLast.has(g.id) && seenLast.get(g.id) !== lp;
        if (lp) seenLast.set(g.id, lp);
        return `<a class="lcard" href="${href}">
  <div class="lc-halves"><div class="lc-half" style="${teamVars(a)}"><b>${esc(a.name)} ${ball(a)}</b><div class="sc">${esc(a.score)}</div></div><div class="lc-half home" style="${teamVars(h)}"><b>${ball(h)} ${esc(h.name)}</b><div class="sc">${esc(h.score)}</div></div></div>
  <div class="lc-strip"><span class="livepill"><i class="pulse"></i>${esc(half ? 'Medio tiempo' : g.detail)}</span>${half ? '<span class="dd">Medio tiempo</span>' : `${miniField(att, def, own, sit?.distance)}<span class="dd">${esc(sit?.text?.split(' at ')[0] || '')}</span><span class="lastp">${esc(sit?.spot || '')}${sit?.redZone ? ' · zona roja' : ''}</span>`}</div>
  ${lp ? `<div class="lc-last ${fresh ? 'new' : ''}"><small>Última jugada</small>${esc(lp)}</div>` : ''}
</a>`;
    }
    const rows = g.teams
        .map((t, i) => {
            const other = g.teams[1 - i];
            const lose = g.state === 'post' && Number(t.score) < Number(other.score);
            return `<div class="trow ${lose ? 'lose' : ''}">${badge(t)}<b>${esc(t.full)}</b>${favStar(t)}<span class="rec">${esc(t.record)}</span>${g.state === 'post' ? `<span class="sc">${esc(t.score)}</span>` : ''}</div>`;
        })
        .join('');
    if (g.state === 'post') {
        const foot = g.leaders.length ? g.leaders.map((l) => `${l.label}: ${l.who} ${l.value}`).join(' · ') : g.note;
        return `<a class="gcard" href="${href}"><div class="gc-top"><span class="tpill muted">${esc(/OT/i.test(g.detail) ? 'Final (prórroga)' : 'Final')}</span><button class="round36 share-g" data-id="${g.id}" aria-label="Compartir">${I.share}</button></div>${rows}${foot ? `<div class="gc-foot">${esc(foot)}</div>` : ''}</a>`;
    }
    const bad = /pospuesto|cancelado|retrasado/i.test(g.detail);
    const on = settings.bells.includes(g.id);
    const s = soon(g.date);
    const foot = [g.venue, g.tv, g.odds && `${g.odds}${g.ou ? ` · O/U ${g.ou}` : ''}`].filter(Boolean).join(' · ');
    return `<a class="gcard" href="${href}"><div class="gc-top"><span class="tpill ${bad ? 'bad' : ''}">${bad ? esc(g.detail) : `${esc(timeOf(g.date))}${s ? `<span class="soon"> · ${s}</span>` : ''}`}</span>${g.note ? `<span class="gc-desc">${esc(g.note)}</span>` : ''}${bad ? '' : `<button class="bell ${on ? 'on' : ''}" data-id="${g.id}">${on ? I.bellOn : I.bell}${on ? 'Te avisaremos' : 'Avisarme'}</button>`}</div>${rows}${foot ? `<div class="gc-foot">${esc(foot)}</div>` : ''}</a>`;
}
