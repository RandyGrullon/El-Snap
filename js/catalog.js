// Todas las jugadas que El Snap sabe animar, por categoría. Cada una trae su especificación para el motor,
// dónde empieza (yarda propia del ataque), el down y la distancia, y una explicación corta.

export const CATS = [
    { id: 'carrera', name: 'Carreras', icon: 'run' },
    { id: 'pase', name: 'Pases', icon: 'pass' },
    { id: 'defensa', name: 'Defensa', icon: 'shield' },
    { id: 'patadas', name: 'Patadas', icon: 'kick' },
    { id: 'puntos', name: 'Anotaciones', icon: 'trophy' },
    { id: 'reglas', name: 'Pañuelos y reglas', icon: 'flag' },
    { id: 'reloj', name: 'Reloj', icon: 'clock' }
];

const A = (n) => ({ n, who: 'ataque' });
const D = (n) => ({ n, who: 'defensa' });

export const CATALOG = [
    // Carreras
    { id: 'run-inside', cat: 'carrera', title: 'Carrera por el medio', own: 30, down: 1, toGo: 10, spec: { kind: 'run', variant: 'inside', gain: 6 }, desc: 'El QB le entrega el balón al corredor (RB), que entra por el hueco que abren los linieros.' },
    { id: 'run-outside', cat: 'carrera', title: 'Carrera por fuera (barrida)', own: 42, down: 2, toGo: 8, spec: { kind: 'run', variant: 'outside', gain: 13, first: true, side: 1 }, desc: 'El corredor busca la esquina hacia la banda, donde hay más espacio pero más camino.' },
    { id: 'sneak', cat: 'carrera', title: 'QB sneak', own: 48, down: 3, toGo: 1, spec: { kind: 'run', variant: 'sneak', gain: 2, first: true }, desc: 'Para ganar una yarda: el QB se lanza de frente justo detrás de su centro.' },
    { id: 'jet', cat: 'carrera', title: 'Jet sweep (con movimiento)', own: 35, down: 1, toGo: 10, spec: { kind: 'run', variant: 'jet', gain: 17, first: true }, desc: 'Un receptor cruza la formación antes del snap (motion) y recibe el balón en plena carrera.' },
    { id: 'scramble', cat: 'carrera', title: 'Scramble del QB', own: 40, down: 3, toGo: 7, spec: { kind: 'scramble', gain: 9, slide: true, first: true }, desc: 'Nadie está libre: el QB sale corriendo y se desliza para que no le peguen.' },
    { id: 'run-td', cat: 'carrera', title: 'Touchdown por tierra', own: 88, down: 1, toGo: 10, pts: A(6), spec: { kind: 'run', variant: 'inside', gain: 12, result: 'td', side: -1 }, desc: 'El corredor cruza la línea de gol con el balón: 6 puntos.' },
    { id: 'first', cat: 'carrera', title: 'Primera y 10', own: 26, down: 3, toGo: 4, spec: { kind: 'run', variant: 'outside', gain: 7, first: true, side: -1 }, desc: 'Avanza más que la línea amarilla: el ataque gana 4 intentos nuevos para otras 10 yardas.' },

    // Pases
    { id: 'pass-short', cat: 'pase', title: 'Pase corto (slant)', own: 30, down: 2, toGo: 6, spec: { kind: 'pass', variant: 'short', gain: 9, target: 'SL', route: 'slant', first: true }, desc: 'Pase rápido a un receptor que corta en diagonal hacia el medio.' },
    { id: 'pass-medium', cat: 'pase', title: 'Pase medio (cruce)', own: 34, down: 1, toGo: 10, spec: { kind: 'pass', variant: 'medium', gain: 17, target: 'Z', route: 'dig', first: true }, desc: 'El receptor sube 12 yardas y cruza por dentro, entre linebackers y safeties.' },
    { id: 'pass-deep', cat: 'pase', title: 'Pase profundo (bomba)', own: 25, down: 1, toGo: 10, spec: { kind: 'pass', variant: 'deep', gain: 44, target: 'X', route: 'go', first: true }, desc: 'El receptor corre en línea recta y el QB lanza largo por encima del esquinero.' },
    { id: 'screen', cat: 'pase', title: 'Pase de pantalla (screen)', own: 30, down: 2, toGo: 9, spec: { kind: 'pass', variant: 'screen', gain: 11, first: true }, desc: 'Pase corto detrás de la línea al corredor, con los linieros delante como escolta.' },
    { id: 'pa', cat: 'pase', title: 'Play-action', own: 45, down: 1, toGo: 10, spec: { kind: 'pass', variant: 'deep', gain: 28, target: 'Z', route: 'post', pa: true, first: true }, desc: 'El QB finge entregar el balón; la defensa muerde la carrera y queda un receptor libre.' },
    { id: 'pass-td', cat: 'pase', title: 'Touchdown por aire', own: 75, down: 2, toGo: 6, pts: A(6), spec: { kind: 'pass', variant: 'deep', result: 'td', target: 'Z', route: 'corner' }, desc: 'El receptor atrapa el pase dentro de la zona de anotación: 6 puntos.' },
    { id: 'inc', cat: 'pase', title: 'Pase incompleto', own: 40, down: 1, toGo: 10, spec: { kind: 'pass', variant: 'medium', result: 'incomplete', target: 'X', route: 'out' }, desc: 'El balón toca el suelo sin que nadie lo atrape: el reloj se para y se pierde un intento.' },
    { id: 'hail', cat: 'pase', title: 'Ave María (Hail Mary)', own: 52, down: 1, toGo: 10, pts: A(6), spec: { kind: 'hail', result: 'td', target: 'Z' }, desc: 'Última jugada: todos a la zona de anotación y el QB lanza lo más lejos que puede.' },
    { id: 'flea', cat: 'pase', title: 'Flea flicker (engaño)', own: 40, down: 1, toGo: 10, spec: { kind: 'flea', gain: 36, first: true }, desc: 'El corredor recibe, frena y le devuelve el balón al QB, que lanza profundo.' },
    { id: 'spike', cat: 'pase', title: 'Spike', own: 62, down: 1, toGo: 10, spec: { kind: 'spike', gain: 0 }, desc: 'El QB clava el balón al suelo a propósito para detener el reloj.' },

    // Defensa
    { id: 'sack', cat: 'defensa', title: 'Sack (captura)', own: 35, down: 2, toGo: 8, spec: { kind: 'sack', gain: -8 }, desc: 'La defensa derriba al QB antes de que lance: pierde yardas.' },
    { id: 'int', cat: 'defensa', title: 'Intercepción', own: 40, down: 2, toGo: 7, spec: { kind: 'pass', variant: 'medium', result: 'int', ret: 14, target: 'Z', route: 'dig' }, desc: 'Un defensor atrapa el pase: el balón cambia de equipo en ese momento.' },
    { id: 'pick6', cat: 'defensa', title: 'Pick-six', own: 30, down: 3, toGo: 6, pts: D(6), spec: { kind: 'pass', variant: 'short', result: 'int', pick6: true, target: 'SL', route: 'slant' }, desc: 'Intercepción que el defensor regresa hasta la zona de anotación: 6 para la defensa.' },
    { id: 'fumble', cat: 'defensa', title: 'Balón suelto (fumble)', own: 45, down: 1, toGo: 10, spec: { kind: 'run', variant: 'inside', gain: 4, fumble: true }, desc: 'El golpe le saca el balón al corredor y la defensa cae encima: cambio de posesión.' },
    { id: 'scoop', cat: 'defensa', title: 'Scoop and score', own: 70, down: 2, toGo: 5, pts: D(6), spec: { kind: 'run', variant: 'inside', gain: 3, fumble: true, scoop: true }, desc: 'La defensa recoge el balón suelto sin detenerse y lo lleva hasta la zona: touchdown.' },
    { id: 'safety', cat: 'defensa', title: 'Safety', own: 2, down: 2, toGo: 10, pts: D(2), spec: { kind: 'sack', gain: -4, result: 'safety' }, desc: 'Derriban al ataque dentro de su propia zona de anotación: 2 puntos para la defensa.' },
    { id: 'downs', cat: 'defensa', title: 'Cuarta oportunidad fallida', own: 55, down: 4, toGo: 2, spec: { kind: 'run', variant: 'inside', gain: 1, downs: true }, desc: 'En 4º intento no llegan a la línea amarilla: el balón pasa a la defensa ahí mismo.' },

    // Patadas
    { id: 'kickoff', cat: 'patadas', title: 'Patada inicial con retorno', own: 35, spec: { kind: 'kickoff', land: 63, ret: 26 }, desc: 'Empieza cada mitad y se repite tras anotar: el que recibe intenta avanzar lo más posible.' },
    { id: 'kickoff-tb', cat: 'patadas', title: 'Touchback', own: 35, spec: { kind: 'kickoff', land: 69, touchback: true }, desc: 'La patada llega a la zona de anotación y el que recibe se arrodilla: empieza en su 25.' },
    { id: 'kickoff-td', cat: 'patadas', title: 'Retorno para touchdown', own: 35, pts: D(6), spec: { kind: 'kickoff', land: 62, result: 'td' }, desc: 'El que recibe la patada la regresa todo el campo hasta anotar.' },
    { id: 'onside', cat: 'patadas', title: 'Patada corta (onside)', own: 35, spec: { kind: 'onside', recover: 'off' }, desc: 'El equipo que va perdiendo patea corto para tratar de recuperar el balón él mismo.' },
    { id: 'punt', cat: 'patadas', title: 'Despeje (punt) con retorno', own: 30, down: 4, toGo: 7, spec: { kind: 'punt', land: 46, ret: 9 }, desc: 'En 4º intento se patea lejos para que el rival empiece lo más atrás posible.' },
    { id: 'fair', cat: 'patadas', title: 'Fair catch', own: 38, down: 4, toGo: 5, spec: { kind: 'punt', land: 44, fair: true }, desc: 'El que recibe levanta el brazo: no lo pueden tocar, pero tampoco puede correr.' },
    { id: 'punt-tb', cat: 'patadas', title: 'Despeje a la zona (touchback)', own: 58, down: 4, toGo: 9, spec: { kind: 'punt', land: 46, touchback: true }, desc: 'El despeje entra a la zona de anotación: el rival empieza en su 20.' },
    { id: 'fg', cat: 'patadas', title: 'Gol de campo', own: 72, down: 4, toGo: 6, pts: A(3), spec: { kind: 'fg', result: 'good' }, desc: 'Patada entre los postes y por encima del travesaño: 3 puntos.' },
    { id: 'fg-miss', cat: 'patadas', title: 'Gol de campo fallado', own: 66, down: 4, toGo: 8, spec: { kind: 'fg', result: 'miss', miss: 'right' }, desc: 'La patada se va desviada: no hay puntos y la defensa toma el balón.' },
    { id: 'fg-block', cat: 'patadas', title: 'Patada bloqueada', own: 74, down: 4, toGo: 4, spec: { kind: 'fg', result: 'blocked' }, desc: 'Un defensor se cuela y toca el balón justo al salir del pie del pateador.' },

    // Anotaciones
    { id: 'xp', cat: 'puntos', title: 'Punto extra', own: 85, pts: A(1), spec: { kind: 'xp', result: 'good' }, desc: 'Después del touchdown: patada corta desde la yarda 15 que vale 1 punto.' },
    { id: '2pt-run', cat: 'puntos', title: 'Conversión de 2 por tierra', own: 98, pts: A(2), spec: { kind: '2pt', ytg: 2, sub: 'run', variant: 'outside', result: 'td', gain: 2, side: 1 }, desc: 'En vez del punto extra: una jugada desde la yarda 2. Si entra, vale 2 puntos.' },
    { id: '2pt-pass', cat: 'puntos', title: 'Conversión de 2 por pase', own: 98, pts: A(2), spec: { kind: '2pt', ytg: 2, sub: 'pass', variant: 'short', result: 'td', target: 'TE', route: 'out' }, desc: 'La conversión también se puede intentar con un pase a la zona.' },
    { id: '2pt-fail', cat: 'puntos', title: 'Conversión fallida', own: 98, spec: { kind: '2pt', ytg: 2, sub: 'run', variant: 'inside', gain: 1 }, desc: 'Lo detienen antes de la línea de gol: el touchdown queda en 6.' },

    // Pañuelos y reglas
    { id: 'holding', cat: 'reglas', title: 'Holding (agarrar)', own: 35, down: 1, toGo: 10, spec: { kind: 'run', variant: 'inside', gain: 9, penalty: { code: 'holding' } }, desc: 'Un liniero agarra a un defensor para frenarlo. El pañuelo cae, la jugada sigue y luego se castiga.' },
    { id: 'false_start', cat: 'reglas', title: 'Salida en falso', own: 40, down: 2, toGo: 4, spec: { kind: 'presnap', penalty: { code: 'false_start' } }, desc: 'Un jugador del ataque se mueve antes del snap: pitan antes de que empiece la jugada.' },
    { id: 'offside', cat: 'reglas', title: 'Fuera de lugar', own: 40, down: 1, toGo: 10, spec: { kind: 'presnap', penalty: { code: 'offside' } }, desc: 'Un defensor cruza la línea antes del snap: 5 yardas a favor del ataque.' },
    { id: 'delay', cat: 'reglas', title: 'Retraso de juego', own: 30, down: 3, toGo: 3, spec: { kind: 'presnap', penalty: { code: 'delay' } }, desc: 'El reloj de jugada llega a 0 sin snap: 5 yardas atrás.' },
    { id: 'dpi', cat: 'reglas', title: 'Interferencia de pase', own: 35, down: 2, toGo: 10, spec: { kind: 'pass', variant: 'deep', result: 'incomplete', catchU: 24, target: 'X', route: 'go', penalty: { code: 'dpi' } }, desc: 'El defensor choca al receptor antes de que llegue el balón: el balón va al lugar de la falta.' },
    { id: 'roughing', cat: 'reglas', title: 'Rudeza contra el pasador', own: 40, down: 1, toGo: 10, spec: { kind: 'pass', variant: 'short', gain: 7, target: 'SL', route: 'slant', penalty: { code: 'roughing' } }, desc: 'Le pegan al QB cuando ya soltó el balón: 15 yardas y primera y 10.' },
    { id: 'facemask', cat: 'reglas', title: 'Facemask', own: 30, down: 1, toGo: 10, spec: { kind: 'run', variant: 'outside', gain: 6, side: 1, penalty: { code: 'facemask' } }, desc: 'Derriba al corredor jalándolo de la máscara del casco: 15 yardas.' },
    { id: 'challenge', cat: 'reglas', title: 'Desafío (pañuelo rojo)', own: 40, down: 2, toGo: 8, spec: { kind: 'pass', variant: 'medium', gain: 13, target: 'Z', route: 'out', challenge: true, upheld: true, first: true }, desc: 'El coach tira el pañuelo rojo para pedir que revisen una jugada en video.' },

    // Reloj
    { id: 'timeout', cat: 'reloj', title: 'Tiempo fuera', own: 45, down: 2, toGo: 6, spec: { kind: 'timeout' }, desc: 'Un equipo para el reloj para hablar con su entrenador. Hay 3 por mitad.' },
    { id: 'twomin', cat: 'reloj', title: 'Aviso de 2 minutos', own: 45, down: 1, toGo: 10, spec: { kind: 'timeout', variant: 'twomin' }, desc: 'Cuando faltan 2 minutos de cada mitad el reloj se detiene solo.' },
    { id: 'kneel', cat: 'reloj', title: 'Rodilla (kneel)', own: 30, down: 1, toGo: 10, spec: { kind: 'kneel', gain: -1 }, desc: 'El que va ganando se arrodilla tras el snap para dejar correr el reloj.' }
];

/** Las formas de anotar (pestaña Puntos) con la jugada que las anima */
export const SCORING = [
    { n: 6, title: 'Touchdown', who: 'Ataque', play: 'pass-td', also: 'run-td', desc: 'Llevar el balón (corriendo o atrapándolo) a la zona de anotación rival.' },
    { n: 1, title: 'Punto extra', who: 'Tras el TD', play: 'xp', desc: 'Patada desde la 15 después del touchdown.' },
    { n: 2, title: 'Conversión de 2', who: 'Tras el TD', play: '2pt-run', also: '2pt-pass', desc: 'Una jugada desde la 2 en vez del punto extra.' },
    { n: 3, title: 'Gol de campo', who: 'Ataque', play: 'fg', desc: 'Patada entre los postes en cualquier down (casi siempre en el 4º).' },
    { n: 2, title: 'Safety', who: 'Defensa', play: 'safety', desc: 'Derribar al ataque dentro de su propia zona de anotación.' },
    { n: 6, title: 'TD de la defensa', who: 'Defensa', play: 'pick6', also: 'scoop', desc: 'Intercepción o balón suelto regresado hasta la zona.' }
];
