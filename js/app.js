// El Snap: como El Play, pero para la NFL. Rutas, la barra de abajo con el botón rojo de en vivo y la hoja de
// juegos en vivo. Cada pantalla vive en js/views/.
import { $, $$, esc, I, badge, applyTheme, openSheet, closeSheet } from './ui.js';
import { scoreboard, eventCard } from './espn.js';
import { store } from './store.js';
import { homeView } from './views/home.js';
import { gameView } from './views/game.js';
import { standingsView } from './views/standings.js';
import { moreView } from './views/more.js';
import { catalogView, pointsView, guideView, practiceView } from './views/learn.js';
import { timeOf, dayOf, miniField, ownFrom } from './views/common.js';

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------------------------------------------------------------- Barra de abajo (ElPlayTabBar)

$('.tb').innerHTML = `<a href="#/" data-t="home">${I.home}<span>Juegos</span></a><a href="#/posiciones" data-t="pos">${I.chart}<span>Posiciones</span></a><div class="tb-live"><button aria-label="Juegos en vivo">${I.live}<span class="cnt" hidden></span></button></div><a href="#/jugadas" data-t="jug">${I.ball}<span>Jugadas</span></a><a href="#/mas" data-t="mas">${I.menu}<span>Más</span></a>`;
const liveCount = () => store.games.filter((g) => g.state === 'in').length;
store.on(() => {
    const n = liveCount();
    const c = $('.tb-live .cnt');
    c.hidden = !n;
    c.textContent = n;
});
$('.tb-live button').onclick = async () => {
    if (!store.games.length) await refreshGames();
    openLive();
};

/** Hoja «En vivo ahora» (en-vivo.tsx de El Play) */
function openLive() {
    const live = store.games.filter((g) => g.state === 'in');
    const next = store.games.filter((g) => g.state === 'pre').sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
    const rows = (list) =>
        list
            .map((g) => {
                const [a, h] = g.teams;
                const sit = g.situation;
                const att = sit?.possession === h.id ? h : a;
                const def = att === h ? a : h;
                return `<a class="lv-row" href="#/juego/${g.id}">${badge(a)}<span><b>${esc(a.abbr)} ${esc(a.score)} <span class="muted">·</span> ${esc(h.abbr)} ${esc(h.score)}</b><small>${g.state === 'in' ? esc(sit ? `${sit.text} · ${sit.spot}` : g.detail) : `${esc(dayOf(g.date))} · ${esc(timeOf(g.date))}`}</small></span>${g.state === 'in' && sit ? miniField(att, def, ownFrom(sit.spot, att.abbr), sit.distance, 48, 18) : '<span></span>'}${g.state === 'in' ? `<span class="livepill"><i class="pulse"></i>${esc(g.detail)}</span>` : `<span class="tpill muted">${esc(timeOf(g.date))}</span>`}${badge(h)}</a>`;
            })
            .join('');
    const body = openSheet(live.length ? 'En vivo ahora' : 'Nada en vivo');
    body.innerHTML = live.length ? rows(live) : `<p class="muted" style="margin:0">${next.length ? 'Estos son los próximos juegos:' : 'No hay juegos en los próximos días.'}</p>${rows(next)}`;
    body.addEventListener('click', (e) => {
        if (e.target.closest('.lv-row')) closeSheet();
    });
}

async function refreshGames() {
    try {
        const sb = await scoreboard({});
        store.sb = sb;
        store.games = (sb.events || []).map(eventCard);
        store.emit();
    } catch {
        /* sin datos: el botón queda sin número */
    }
}
refreshGames();
setInterval(() => {
    if (!document.hidden) refreshGames();
}, 60000);

// ---------------------------------------------------------------- Rutas

const ROUTES = [
    [/^\/$/, homeView, 'home'],
    [/^\/juego\/([\w-]+)$/, gameView, 'home', (m) => ({ id: m[1] })],
    [/^\/posiciones$/, standingsView, 'pos'],
    [/^\/jugadas(?:\/([\w-]+))?$/, catalogView, 'jug', (m) => ({ id: m[1] })],
    [/^\/mas$/, moreView, 'mas'],
    [/^\/aprende\/puntos$/, pointsView, 'mas'],
    [/^\/aprende\/guia$/, guideView, 'mas'],
    [/^\/practica$/, practiceView, 'mas']
];
// Enlaces de la versión anterior
const OLD = { nfl: '/', vivo: '/practica', puntos: '/aprende/puntos', guia: '/aprende/guia', jugadas: '/jugadas' };

let current = null;
let currentPath = '';
function route() {
    let h = location.hash.replace(/^#/, '');
    const oldKey = h.split('/')[0];
    if (OLD[oldKey] && !h.startsWith('/')) {
        const sub = h.split('/')[1];
        location.replace(`#${OLD[oldKey]}${oldKey === 'jugadas' && sub ? `/${sub}` : ''}`);
        return;
    }
    if (!h.startsWith('/')) h = `/${h}`;
    const [path, qs] = h.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    // Cambios de la misma pantalla que ella misma escribe en la dirección (días, secciones, jugada)
    if (path === currentPath && current?.keep) return;
    const hit = ROUTES.map(([re, fn, tab, map]) => ({ m: re.exec(path), fn, tab, map })).find((r) => r.m) || { m: [], fn: homeView, tab: 'home' };
    closeSheet();
    current?.unmount?.();
    const view = $('#view');
    view.replaceChildren();
    const el = document.createElement('div');
    view.append(el);
    current = hit.fn(el, { ...params, ...(hit.map ? hit.map(hit.m) : {}) }) || {};
    currentPath = path;
    $$('.tb a').forEach((a) => a.classList.toggle('on', a.dataset.t === hit.tab));
    window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.search.includes('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.elSnap = { store, route };
