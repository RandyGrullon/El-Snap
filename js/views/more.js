// Más: como la pestaña Más de El Play. Instalar, apariencia (tema, animaciones de jugadas, velocidad), aprende
// (todas las animaciones, cómo se anota, el terreno, la práctica), compartir la app y acerca de.
import { $, $$, esc, I, settings, saveSettings, applyTheme, share } from '../ui.js';
import { LOGO_PATHS } from '../field.js';
import { install } from '../store.js';

const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(settings[key]) === String(v) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;

export function moreView(el) {
    const render = () => {
        el.innerHTML = `<div class="screen">
<h1 class="m-title">Más</h1>
${install.can() ? `<div class="m-list"><button class="m-row inst"><span class="ic grad">${I.download}</span><span><b>Instalar la app</b><small>Gratis, sin tienda y en segundos</small></span>${I.chev}</button></div>` : ''}
<div class="m-sec"><div class="eyebrow">Apariencia</div>
<div class="m-card"><h3>Tema</h3>${seg('theme', [
            ['auto', 'Automático'],
            ['light', 'Claro'],
            ['dark', 'Oscuro']
        ])}</div>
<div class="m-card"><h3>Animaciones de jugadas</h3><p>En los juegos en vivo el campo sigue cada jugada solo. Con «Grandes» pasa solo las anotaciones, pérdidas de balón, pañuelos y jugadas largas.</p>${seg('anim', [
            ['big', 'Grandes'],
            ['all', 'Todas'],
            ['off', 'Apagadas']
        ])}</div>
<div class="m-card"><h3>Velocidad de las jugadas</h3>${seg('speed', [
            [0.5, '0.5×'],
            [1, '1×'],
            [2, '2×']
        ])}</div>
<div class="m-card"><label class="set-row"><span>Pizarra (rutas dibujadas antes del snap)</span><input type="checkbox" class="switch" data-b="pizarra" ${settings.pizarra ? 'checked' : ''}></label><label class="set-row" style="border:0"><span>Vibrar al anotar y con pañuelos</span><input type="checkbox" class="switch" data-b="vibrate" ${settings.vibrate ? 'checked' : ''}></label></div></div>
<div class="m-sec"><div class="eyebrow">Aprende</div><div class="m-list">
<a class="m-row" href="#/jugadas"><span class="ic">${I.ball}</span><span><b>Todas las animaciones</b><small>49 jugadas: carreras, pases, patadas, pañuelos…</small></span>${I.chev}</a>
<a class="m-row" href="#/aprende/puntos"><span class="ic">${I.trophy}</span><span><b>Cómo se anota</b><small>Touchdown, punto extra, gol de campo, safety…</small></span>${I.chev}</a>
<a class="m-row" href="#/aprende/guia"><span class="ic">${I.book}</span><span><b>El terreno y las reglas</b><small>Las partes del campo, los downs y las posiciones</small></span>${I.chev}</a>
<a class="m-row" href="#/practica"><span class="ic">${I.field}</span><span><b>Juego de práctica</b><small>Un juego simulado de punta a punta</small></span>${I.chev}</a>
</div></div>
<div class="m-list"><button class="m-row invite"><span class="ic">${I.share}</span><span><b>Pásale El Snap a alguien</b><small>Comparte el enlace para que la instale en su teléfono</small></span>${I.chev}</button></div>
<div class="m-card"><div class="about"><svg viewBox="0 0 64 64" aria-hidden="true">${LOGO_PATHS('lg-more')}</svg><div><b>El Snap</b><small>Fútbol americano en vivo</small><em>Versión 2.1 · Datos de los juegos: ESPN</em></div></div></div>
</div>`;
    };
    render();
    el.addEventListener('click', (ev) => {
        const b = ev.target.closest('.seg[data-k] [data-v]');
        if (b) {
            const k = b.closest('.seg').dataset.k;
            settings[k] = k === 'speed' ? Number(b.dataset.v) : b.dataset.v;
            saveSettings();
            if (k === 'theme') applyTheme();
            $$(`.seg[data-k="${k}"] button`, el).forEach((x) => x.classList.toggle('on', x === b));
            return;
        }
        if (ev.target.closest('.inst')) return install.prompt();
        if (ev.target.closest('.invite')) return share('El Snap', 'El Snap: los juegos de la NFL con cada jugada animada, como El Play.');
    });
    el.addEventListener('change', (ev) => {
        const c = ev.target.closest('[data-b]');
        if (!c) return;
        settings[c.dataset.b] = c.checked;
        saveSettings();
    });
    return { unmount() {} };
}
