// Estado compartido entre pantallas: los juegos de la semana (para el botón rojo de en vivo) y la instalación.
import { openSheet } from './ui.js';

export const store = {
    sb: null,
    games: [],
    week: null,
    stype: null,
    subs: new Set(),
    on(fn) {
        this.subs.add(fn);
        return () => this.subs.delete(fn);
    },
    emit() {
        for (const fn of this.subs) fn(this);
    }
};

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    store.emit();
});
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

export const install = {
    can: () => !standalone() && (!!deferred || ios),
    async prompt() {
        if (deferred) {
            deferred.prompt();
            await deferred.userChoice;
            deferred = null;
            store.emit();
            return;
        }
        openSheet(
            'Instalar El Snap',
            `<div class="m-card"><h3>En iPhone (Safari)</h3><ol class="rules"><li>Toca el botón <b>Compartir</b> (el cuadro con la flecha).</li><li>Baja y toca <b>Agregar a inicio</b>.</li><li>Toca <b>Agregar</b>: El Snap queda con su ícono como una app.</li></ol></div><div class="m-card"><h3>En Android (Chrome)</h3><ol class="rules"><li>Toca el menú <b>⋮</b>.</li><li>Toca <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li></ol></div>`
        );
    }
};
