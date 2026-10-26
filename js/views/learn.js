// Aprende: todas las animaciones (pestaña Jugadas), cómo se anota, el terreno y las reglas, y el juego de práctica.
import { $, $$, esc, I, badge, odo, toast, PlayerView, wpChart } from '../ui.js';
import { buildPlay, FOULS } from '../plays.js';
import { staticField, yardLabel, FW } from '../field.js';
import { Game, TEAMS, QUARTER, QSHORT, clockText } from '../game.js';
import { CATALOG, CATS, SCORING } from '../catalog.js';

const hashId = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

function catalogPlay(item) {
    const own = item.own;
    const ytg = item.spec.ytg ?? 100 - own;
    const losX = 10 + own;
    const spec = { offR: TEAMS[0].roster, defR: TEAMS[1].roster, seed: hashId(item.id), ytg, ...item.spec };
    const firstX = item.down && item.toGo < ytg ? losX + item.toGo : null;
    const view = { losX, dir: 1, offTeam: TEAMS[0], defTeam: TEAMS[1], firstX, left: TEAMS[0], right: TEAMS[1], losLabel: yardLabel(losX, TEAMS[0], TEAMS[1]) };
    return { play: buildPlay(spec), view, meta: { yards: item.spec.gain ?? null, pts: item.pts ? { n: item.pts.n, abbr: item.pts.who === 'defensa' ? TEAMS[1].abbr : TEAMS[0].abbr } : null } };
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

// ---------------------------------------------------------------- Jugadas (todas las animaciones)

export function catalogView(el, params) {
    el.innerHTML = `<div class="screen wide">
<div class="sec-title"><div><small>Fútbol americano · ${CATALOG.length} animaciones</small><h1>Jugadas</h1></div></div>
<div class="cat-layout"><div class="cat-main"><div class="cat-player"></div><div class="now card cat-now"></div><div class="summary cat-summary"></div><div class="card"><div class="card-h"><h3>Paso a paso</h3><span class="muted">Qué pasa en cada momento</span></div><ol class="steps cat-steps"></ol></div></div>
<div class="cat-side"><div class="chips cat-chips" role="group" aria-label="Categorías"></div><div class="cat-list"></div></div></div></div>`;
    const player = new PlayerView($('.cat-player', el), { steps: $('.cat-steps', el), summary: $('.cat-summary', el) });
    let filter = 'all';
    let current = params.id && CATALOG.some((c) => c.id === params.id) ? params.id : 'pass-deep';
    $('.cat-chips', el).innerHTML = [{ id: 'all', name: 'Todas' }, ...CATS].map((c) => `<button class="chip-btn ${c.id === 'all' ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)} <small>${c.id === 'all' ? CATALOG.length : CATALOG.filter((x) => x.cat === c.id).length}</small></button>`).join('');
    const renderList = () => {
        $('.cat-list', el).innerHTML = CATS.filter((c) => filter === 'all' || c.id === filter)
            .map(
                (c) =>
                    `<div class="cat-group"><h3>${esc(c.name)}</h3><div class="cat-grid">${CATALOG.filter((x) => x.cat === c.id)
                        .map(
                            (x) =>
                                `<button class="cat-item ${x.id === current ? 'on' : ''}" data-id="${x.id}"><span class="ci-n">${CATALOG.indexOf(x) + 1}</span><span class="ci-body"><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></span>${x.pts ? `<span class="chip gold">+${x.pts.n}</span>` : x.spec.penalty || x.id === 'challenge' ? `<span class="chip flag">${I.flagFill}</span>` : ''}</button>`
                        )
                        .join('')}</div></div>`
            )
            .join('');
    };
    const select = (id, scroll) => {
        current = id;
        playCatalog(player, id, $('.cat-now', el));
        $$('.cat-item', el).forEach((x) => x.classList.toggle('on', x.dataset.id === id));
        history.replaceState(null, '', `#/jugadas/${id}`);
        if (scroll) $('.cat-player', el).scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    el.addEventListener('click', (ev) => {
        const b = ev.target.closest('.chip-btn');
        if (b) {
            filter = b.dataset.cat;
            $$('.cat-chips .chip-btn', el).forEach((x) => x.classList.toggle('on', x === b));
            return renderList();
        }
        const it = ev.target.closest('.cat-item');
        if (it) select(it.dataset.id, true);
    });
    renderList();
    select(current, false);
    return { unmount: () => player.destroy() };
}

// ---------------------------------------------------------------- Cómo se anota

export function pointsView(el) {
    el.innerHTML = `<div class="screen"><div class="back-row"><a class="icon-btn" href="#/mas" aria-label="Volver">${I.back}</a><h1>Cómo se anota</h1></div><div class="scoring"></div><div class="pts-player"></div><div class="now card pts-now"></div><div class="card"><div class="card-h"><h3>Paso a paso</h3></div><ol class="steps pts-steps"></ol></div></div>`;
    const player = new PlayerView($('.pts-player', el), { steps: $('.pts-steps', el) });
    $('.scoring', el).innerHTML = SCORING.map((s, i) => `<button class="score-card ${i === 0 ? 'on' : ''}" data-i="${i}"><span class="sc-n">${s.n}</span><span class="sc-body"><b>${esc(s.title)}</b><small>${esc(s.who)} · ${esc(s.desc)}</small></span><span class="sc-go">${I.play}</span></button>`).join('');
    const show = (s) => {
        playCatalog(player, s.play, $('.pts-now', el));
        if (s.also) $('.pts-now', el).insertAdjacentHTML('beforeend', ` <button class="link" data-also="${s.also}">Ver otra forma</button>`);
    };
    el.addEventListener('click', (ev) => {
        const b = ev.target.closest('.score-card');
        if (b) {
            $$('.score-card', el).forEach((x) => x.classList.toggle('on', x === b));
            show(SCORING[Number(b.dataset.i)]);
            return $('.pts-player', el).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const a = ev.target.closest('[data-also]');
        if (a) playCatalog(player, a.dataset.also, $('.pts-now', el));
    });
    show(SCORING[0]);
    return { unmount: () => player.destroy() };
}

// ---------------------------------------------------------------- El terreno y las reglas

export function guideView(el) {
    el.innerHTML = `<div class="screen"><div class="back-row"><a class="icon-btn" href="#/mas" aria-label="Volver">${I.back}</a><h1>El terreno y las reglas</h1></div>
<div class="card"><div class="card-h"><h3>El terreno</h3><span class="muted">120 × 53⅓ yardas</span></div><div class="guide-field"></div><ol class="legend"></ol></div>
<div class="card"><h3>Cómo se juega, por puntos</h3><ol class="rules">
<li>Dos equipos de 11. El que tiene el balón (<b>ataque</b>) quiere llevarlo a la zona de anotación del rival.</li>
<li>Cada jugada empieza con el <b>snap</b>: el centro le pasa el balón al QB por entre las piernas.</li>
<li>El ataque tiene <b>4 intentos (downs)</b> para avanzar 10 yardas. Si lo logra, vuelve a tener <b>primera y 10</b>.</li>
<li>Se avanza <b>corriendo</b> con el balón o con <b>un pase hacia adelante</b> por jugada, lanzado desde detrás de la línea.</li>
<li>La jugada termina cuando derriban al que lleva el balón, sale por la banda, el pase cae <b>incompleto</b> o alguien anota.</li>
<li>Si en el 3er intento no llegan, en el 4º casi siempre <b>despejan (punt)</b> o patean un <b>gol de campo</b>.</li>
<li>La defensa puede robar el balón: <b>intercepción</b> o <b>balón suelto (fumble)</b>.</li>
<li>Los árbitros tiran el <b>pañuelo amarillo</b> cuando ven una falta y la castigan con yardas.</li>
<li>Son <b>4 cuartos de 15 minutos</b>. El reloj se para con pases incompletos, salidas por la banda, anotaciones y tiempos fuera.</li>
<li>Gana el que tenga más puntos. Si empatan, hay <b>prórroga</b>.</li></ol></div>
<div class="card"><h3>Posiciones</h3><div class="positions"><h4>Ataque</h4><ul>
<li><i class="o">QB</i><b>Quarterback</b> Recibe el snap, lanza o entrega el balón.</li><li><i class="o">RB</i><b>Corredor</b> Corre con el balón y ayuda a proteger.</li><li><i class="o">WR</i><b>Receptor</b> Corre rutas para atrapar pases.</li><li><i class="o">TE</i><b>Ala cerrada</b> Bloquea y también atrapa.</li><li><i class="o">C·G·T</i><b>Línea ofensiva</b> Centro, guardias y tackles: protegen al QB y abren huecos.</li></ul>
<h4>Defensa</h4><ul><li><i class="d">DE·DT</i><b>Línea defensiva</b> Presionan al QB y frenan la carrera.</li><li><i class="d">LB</i><b>Linebacker</b> Tacklean, cubren pases cortos y hacen blitz.</li><li><i class="d">CB</i><b>Esquinero</b> Cubre a los receptores.</li><li><i class="d">S</i><b>Safety</b> La última línea, cubre lo profundo.</li></ul>
<h4>Patadas y árbitros</h4><ul><li><i class="o">K·P</i><b>Pateador y despejador</b> Goles de campo, patadas iniciales y despejes.</li><li><i class="d">KR·PR</i><b>Regresadores</b> Atrapan las patadas y las regresan.</li><li><i class="r">R·U</i><b>Árbitros</b> Principal, umpire, jueces de línea y de fondo. Tiran el pañuelo.</li></ul></div></div>
<div class="card"><h3>Glosario</h3><dl class="gloss">
<dt>Snap</dt><dd>El pase del centro al QB que empieza cada jugada.</dd><dt>Down</dt><dd>Cada uno de los 4 intentos para avanzar 10 yardas.</dd><dt>Línea de golpeo</dt><dd>Donde está el balón antes del snap (azul en el campo).</dd><dt>Bolsillo</dt><dd>El espacio que la línea ofensiva le arma al QB para lanzar.</dd><dt>Blitz</dt><dd>Cuando un linebacker o un defensivo profundo también va por el QB.</dd><dt>Sack</dt><dd>Derribar al QB antes de que lance.</dd><dt>Touchback</dt><dd>Patada que termina en la zona de anotación: el balón sale a la 20 o 25.</dd><dt>Fair catch</dt><dd>El que recibe la patada levanta el brazo: no lo tocan, pero no corre.</dd><dt>Pick-six</dt><dd>Intercepción regresada para touchdown.</dd><dt>Play-action</dt><dd>Fingir una carrera para lanzar un pase.</dd><dt>Scramble</dt><dd>El QB sale corriendo cuando no encuentra a quién lanzar.</dd><dt>Zona roja</dt><dd>Las últimas 20 yardas antes de la zona de anotación.</dd><dt>Turnover</dt><dd>Perder el balón: intercepción, fumble o 4º intento fallido.</dd><dt>Pañuelo amarillo</dt><dd>Lo tira un árbitro para marcar una falta.</dd><dt>Pañuelo rojo</dt><dd>Lo tira un coach para pedir revisar una jugada en video (desafío).</dd><dt>YAC</dt><dd>Yardas que el receptor corre después de atrapar el pase.</dd></dl></div></div>`;
    const svgEl = staticField($('.guide-field', el), TEAMS[0], TEAMS[1]);
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
    $('.legend', el).innerHTML = [
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
    return { unmount() {} };
}

// ---------------------------------------------------------------- Juego de práctica (simulado)

function boardHtml() {
    return `${TEAMS.map(
        (t, i) => `<div class="sb-team" data-i="${i}" style="--c:${t.color}"><div class="sb-stripes"></div><div class="sb-row">${badge(t, 'lg')}<span class="sb-poss">${I.ball}</span></div><div class="sb-name">${esc(t.name)}<small>${esc(t.city)}</small></div><div class="sb-score"><span class="odo"></span><span class="sb-plus"></span></div><div class="sb-tos"><i></i><i></i><i></i></div></div>`
    ).join('')}`;
}

export function practiceView(el) {
    el.innerHTML = `<div class="screen wide"><div class="back-row"><a class="icon-btn" href="#/mas" aria-label="Volver">${I.back}</a><h1>Juego de práctica</h1></div>
<p class="muted" style="margin:0">Un juego simulado entre dos equipos inventados, para ver cómo avanza un juego de punta a punta.</p>
<div class="live-grid"><div class="col-main"><div class="scoreboard pr-board"></div><div class="now card"><div class="now-head"><span class="live-dot"></span><h2 class="pr-title">Preparando…</h2></div><p class="now-text pr-text"></p></div><div class="pr-player"></div><div class="summary pr-summary"></div><div class="card"><div class="card-h"><h3>Paso a paso</h3></div><ol class="steps pr-steps"></ol></div></div>
<div class="col-side"><div class="card"><div class="card-h"><h3>Probabilidad de ganar</h3></div><div class="pr-wp"></div></div><div class="card"><div class="card-h"><h3>Jugada a jugada</h3><span class="muted pr-count"></span></div><div class="pbp pr-pbp"></div></div><button class="btn-wide pr-new">Empezar un juego nuevo</button></div></div></div>`;
    const board = $('.pr-board', el);
    board.innerHTML = boardHtml();
    const mid = document.createElement('div');
    mid.className = 'sb-mid';
    mid.innerHTML = '<div class="sb-q"></div><div class="sb-clock"></div><div class="sb-down"></div><div class="sb-spot"></div>';
    board.insertBefore(mid, $('.sb-team[data-i="1"]', board));

    let game = null;
    let current = null;
    let replay = false;
    let timer = 0;
    let alive = true;
    const player = new PlayerView($('.pr-player', el), {
        extra: `<button class="btn-round pr-next" aria-label="Siguiente jugada">${I.next}</button><button class="pill pr-skip">${I.fast}<span>Anotación</span></button>`,
        steps: $('.pr-steps', el),
        summary: $('.pr-summary', el),
        onEnd: () => {
            if (replay) {
                replay = false;
                return;
            }
            commit();
            if (alive && !game.over && !document.hidden) timer = setTimeout(next, 1000 / Math.max(0.5, player.stage.speed));
        },
        onEvent: (e) => {
            if (e.type === 'score' && !replay && current?.pts) paint({ ...current.before, score: current.after.score }, current.pts);
        },
        onUser: () => clearTimeout(timer)
    });

    function paint(s, pop) {
        const ytg = 100 - s.own;
        TEAMS.forEach((t, i) => {
            const tEl = $(`.sb-team[data-i="${i}"]`, board);
            odo($('.odo', tEl), s.score[i]);
            tEl.classList.toggle('has', s.phase === 'scrim' && s.poss === i);
            $$('.sb-tos i', tEl).forEach((d, k) => d.classList.toggle('used', k >= s.timeouts[i]));
        });
        $('.sb-q', board).textContent = s.over ? 'Final' : QUARTER[s.q];
        $('.sb-clock', board).textContent = s.over ? '—' : clockText(s.clock);
        $('.sb-down', board).textContent = s.over ? 'Final' : s.phase === 'kickoff' ? 'Patada inicial' : s.phase === 'pat' ? 'Punto extra' : `${s.down}ª y ${s.toGo >= ytg ? 'gol' : s.toGo}`;
        $('.sb-spot', board).textContent = s.phase === 'scrim' && !s.over ? game.spot(s.poss, s.own) : '';
        if (pop) {
            const tEl = $(`.sb-team[data-i="${pop.team}"]`, board);
            const plus = $('.sb-plus', tEl);
            plus.textContent = `+${pop.n}`;
            plus.classList.remove('go');
            tEl.classList.remove('flash');
            void board.offsetWidth;
            plus.classList.add('go');
            tEl.classList.add('flash');
        }
    }
    function lists() {
        const done = game.log.filter((r) => r.committed);
        $('.pr-wp', el).innerHTML = wpChart(TEAMS, game.wpHist, { h: 90 });
        const groups = new Map();
        for (const r of done) (groups.get(r.drive) || groups.set(r.drive, []).get(r.drive)).push(r);
        $('.pr-pbp', el).innerHTML =
            [...groups.entries()]
                .reverse()
                .map(([dId, recs]) => {
                    const d = game.drives[dId - 1];
                    const t = TEAMS[d ? d.team : recs[0].team];
                    return `<div class="drive" style="--c:${t.color}"><div class="drive-h">${badge(t, 'sm')}<b>${esc(t.name)}</b>${d ? `<span>${d.plays} jugadas · ${d.yards} yd</span><em>${esc(d.result || 'En curso')}</em>` : ''}</div>${[...recs]
                        .reverse()
                        .map((r) => `<button class="pbp-row ${r.pts ? 'score' : ''}" data-n="${r.n}"><span class="pbp-when"><b>${QSHORT[r.q]} ${clockText(r.clock)}</b><span>${r.down ? `${esc(r.down)} · ` : ''}${esc(r.spotText)}</span></span><span class="pbp-text"><span class="pbp-label">${esc(r.label)}</span>${esc(r.text)}</span>${r.pts ? `<span class="chip gold">+${r.pts.n}</span>` : ''}</button>`)
                        .join('')}</div>`;
                })
                .join('') || '<p class="empty">Las jugadas aparecen aquí cuando terminan.</p>';
        $('.pr-count', el).textContent = `${done.length} jugadas`;
    }
    function commit() {
        if (!current || current.committed || replay) return;
        current.committed = true;
        paint(current.after);
        if (current.quarterEnd) toast(current.quarterEnd);
        lists();
        if (game.over) toast(`Final: ${TEAMS[0].abbr} ${game.score[0]} · ${TEAMS[1].abbr} ${game.score[1]}`);
    }
    function show(rec, isReplay) {
        clearTimeout(timer);
        replay = isReplay;
        if (!isReplay && current && !current.committed) commit();
        current = rec;
        if (!isReplay) paint(rec.before);
        player.show(buildPlay(rec.spec), rec.view, rec);
        $('.pr-title', el).innerHTML = `${isReplay ? '<span class="tag-replay">Repetición</span>' : ''}${esc(rec.label)} <small>${QSHORT[rec.q]} ${clockText(rec.clock)}${rec.down ? ` · ${rec.down}` : ''} · ${esc(rec.spotText)}</small>`;
        $('.pr-text', el).textContent = rec.text;
        player.start();
    }
    function next() {
        clearTimeout(timer);
        if (!replay) commit();
        if (game.over) return;
        const rec = game.step();
        if (rec) show(rec, false);
    }
    function newGame() {
        clearTimeout(timer);
        game = new Game();
        current = null;
        paint(game.snapshot());
        lists();
        next();
    }
    el.addEventListener('click', (ev) => {
        if (ev.target.closest('.pr-next')) return next();
        if (ev.target.closest('.pr-new')) return newGame();
        if (ev.target.closest('.pr-skip')) {
            clearTimeout(timer);
            commit();
            const recs = game.skipToScore();
            const last = recs.pop();
            for (const r of recs) r.committed = true;
            lists();
            if (last) show(last, false);
            return;
        }
        const row = ev.target.closest('.pbp-row');
        if (row) {
            const rec = game.log.find((r) => r.n === Number(row.dataset.n));
            if (rec) show(rec, true);
        }
    });
    newGame();
    return {
        unmount() {
            alive = false;
            clearTimeout(timer);
            player.destroy();
        }
    };
}
