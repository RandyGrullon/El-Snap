// Posiciones: la pestaña de El Play para la NFL. «Posiciones | Líderes»; las posiciones van por división con la
// tarjeta grande del primero y las filas de los demás, y la siembra de playoffs por conferencia.
import { $, esc, I, badge, settings, toggleIn, toast, share } from '../ui.js';
import { standings, leaders } from '../espn.js';
import { teamVars } from './common.js';

export function standingsView(el, params) {
    let alive = true;
    let section = params.s === 'lideres' ? 'lideres' : 'posiciones';
    let conf = params.c === 'NFC' ? 'NFC' : 'AFC';
    let mode = params.m === 'siembra' ? 'siembra' : 'division';
    let data = null;
    let lead = null;
    let cat = 0;

    el.innerHTML = `<div class="screen"><div class="pills sec-pills" role="tablist"><button class="pill2 sm" data-s="posiciones">Posiciones</button><button class="pill2 sm" data-s="lideres">Líderes</button></div><div class="sec-title"><div><small>NFL · Temporada</small><h1>Posiciones</h1></div><button class="share48" aria-label="Compartir">${I.share}</button></div><div class="st-body"><div class="skel-card"></div><div class="skel-card"></div></div></div>`;

    const body = () => $('.st-body', el);
    const setUrl = () => history.replaceState(null, '', `#/posiciones?s=${section}&c=${conf}&m=${mode}`);

    async function load() {
        $('.sec-pills', el).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.s === section));
        $('.sec-title h1', el).textContent = section === 'lideres' ? 'Líderes' : 'Posiciones';
        $('.share48', el).hidden = section === 'lideres';
        try {
            if (section === 'posiciones') {
                data = data || (await standings());
                if (!alive) return;
                $('.sec-title small', el).textContent = `NFL · Temporada ${data.season || ''}`.trim();
                renderStandings();
            } else {
                lead = lead || (await leaders());
                if (!alive) return;
                renderLeaders();
            }
        } catch {
            if (!alive) return;
            body().innerHTML = `<div class="sec empty-card">${I.info}<b>No se pudieron cargar los datos</b><p class="muted">Revisa tu conexión: en algunas redes los datos deportivos están bloqueados.</p><button class="pill2 sm on retry">Reintentar</button></div>`;
            $('.retry', el).onclick = load;
        }
    }

    function row(t, i, gb, out) {
        const fav = settings.favs.includes(t.abbr);
        const rec = `${t.w}-${t.l}${t.t ? `-${t.t}` : ''}`;
        return `<div class="srow ${out ? 'out' : ''}" style="${teamVars(t)}"><span class="rk-sq">${i}</span>${badge(t)}<div><b>${esc(t.name)}</b><small>${esc([t.streak && streakEs(t.streak), t.div && `Div ${t.div}`, t.diff ? `Dif ${t.diff > 0 ? '+' : ''}${t.diff}` : ''].filter(Boolean).join(' · '))}</small></div><span class="wl">${rec}</span><span class="gb">${esc(gb)}</span><button class="star-btn ${fav ? 'on' : ''}" data-fav="${esc(t.abbr)}" aria-label="Favorito">${fav ? I.starFill : I.star}</button></div>`;
    }
    function leadCard(t, i, label) {
        const fav = settings.favs.includes(t.abbr);
        return `<div class="st-lead" style="${teamVars(t)}"><span class="rk">${i}</span><div><b>${esc(t.full)}</b><small>${t.w}-${t.l}${t.t ? `-${t.t}` : ''} · ${esc(t.pct || '')}</small><small>${esc(label)}</small></div>${t.streak ? `<span class="streak">${esc(streakEs(t.streak))}</span>` : '<span></span>'}<button class="star-btn ${fav ? 'on' : ''}" data-fav="${esc(t.abbr)}" aria-label="Favorito">${fav ? I.starFill : I.star}</button></div>`;
    }
    const gbOf = (t, top) => {
        const g = (top.w - t.w + (t.l - top.l)) / 2;
        return g <= 0 ? '—' : String(g).replace('.5', '½').replace(/^0½/, '½');
    };

    function renderStandings() {
        const confs = `<div class="pills"><button class="pill2 sm ${conf === 'AFC' ? 'on' : ''}" data-c="AFC">AFC</button><button class="pill2 sm ${conf === 'NFC' ? 'on' : ''}" data-c="NFC">NFC</button><span class="grow"></span><div class="seg small"><button data-m="division" class="${mode === 'division' ? 'on' : ''}">Divisiones</button><button data-m="siembra" class="${mode === 'siembra' ? 'on' : ''}">Playoffs</button></div></div>`;
        let html = '';
        if (mode === 'division') {
            for (const d of data.divisions.filter((x) => x.name.startsWith(conf))) {
                if (!d.teams.length) continue;
                const top = d.teams[0];
                html += `<div class="div-group"><div class="eyebrow">${esc(d.name)}</div>${leadCard(top, 1, `Líder de la ${d.name}`)}${d.teams
                    .slice(1)
                    .map((t, i) => row(t, i + 2, gbOf(t, top)))
                    .join('')}</div>`;
            }
        } else {
            const list = conf === 'AFC' ? data.afc : data.nfc;
            const top = list[0];
            html = `<div class="div-group">${list
                .map((t, i) => {
                    const cut = i === 7 ? '<div class="cutline">Clasifican a los playoffs</div>' : '';
                    return `${cut}${i === 0 ? leadCard(t, 1, 'Primer lugar: descansa la primera ronda') : row(t, i + 1, gbOf(t, top), i >= 7)}`;
                })
                .join('')}</div><p class="note">Siete equipos por conferencia van a los playoffs: los 4 líderes de división y 3 comodines.</p>`;
        }
        body().innerHTML = confs + (html || '<p class="muted">Todavía no hay posiciones.</p>');
    }

    function renderLeaders() {
        if (!lead.length) {
            body().innerHTML = '<p class="muted">Todavía no hay líderes esta temporada.</p>';
            return;
        }
        cat = Math.min(cat, lead.length - 1);
        const c = lead[cat];
        body().innerHTML = `<div class="pills ld-cats">${lead.map((x, i) => `<button class="pill2 sm ${i === cat ? 'on' : ''}" data-cat="${i}">${esc(x.label)}</button>`).join('')}</div><div class="ld-carousel">${c.leaders
            .slice(0, 6)
            .map((l, i) => {
                const vars = i === 0 ? `--c:${l.teamColor};--on:#fff` : '';
                return `<div class="ld-card ${i === 0 ? 'first' : ''}" style="${vars}"><div class="top"><span>N.º ${i + 1}</span><span>${esc(l.team)}</span></div><div class="mid"><span class="val">${esc(l.value)}</span><img src="${esc(l.headshot)}" alt="" onerror="this.style.visibility='hidden'"></div><b>${esc(l.name)}</b><small>${esc(l.pos)} · ${esc(c.label)}</small></div>`;
            })
            .join('')}</div><p class="note">Datos de ESPN de la temporada regular.</p>`;
    }

    el.addEventListener('click', (ev) => {
        const s = ev.target.closest('.sec-pills [data-s]');
        if (s) {
            section = s.dataset.s;
            setUrl();
            body().innerHTML = '<div class="skel-card"></div><div class="skel-card"></div>';
            return load();
        }
        const c = ev.target.closest('[data-c]');
        if (c) {
            conf = c.dataset.c;
            setUrl();
            return renderStandings();
        }
        const m = ev.target.closest('[data-m]');
        if (m) {
            mode = m.dataset.m;
            setUrl();
            return renderStandings();
        }
        const k = ev.target.closest('[data-cat]');
        if (k) {
            cat = Number(k.dataset.cat);
            return renderLeaders();
        }
        const f = ev.target.closest('[data-fav]');
        if (f) {
            const on = toggleIn('favs', f.dataset.fav);
            toast(on ? `${f.dataset.fav} es tu equipo favorito` : `Quitaste a ${f.dataset.fav} de favoritos`);
            return renderStandings();
        }
        if (ev.target.closest('.share48') && data) {
            const list = data.divisions.filter((x) => x.name.startsWith(conf));
            share(`Posiciones ${conf}`, list.map((d) => `${d.name}: ${d.teams.map((t) => `${t.abbr} ${t.w}-${t.l}`).join(', ')}`).join('\n'));
        }
    });

    load();
    return {
        unmount() {
            alive = false;
        }
    };
}

const streakEs = (s) => String(s).replace(/^W/, 'G').replace(/^L/, 'P').replace(/^T/, 'E');
