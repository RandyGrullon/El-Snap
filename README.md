# El-Snap

**El Snap** es una PWA de fútbol americano jugada a jugada, con la misma estética de El Play: cada jugada animada sobre el terreno, el pase de dónde a dónde, los pañuelos de los árbitros, cómo se anota y una guía para entenderlo todo. Funciona sin internet y se instala como app.

## Qué trae

- **En vivo**: un juego simulado completo (4 cuartos, reloj, downs, posesiones, prórroga) entre los Tiburones y los Volcanes. Marcador tipo odómetro, probabilidad de ganar, jugada a jugada por series y repetición de cualquier jugada.
- **Todas las animaciones**: 49 jugadas animadas en 7 categorías, cada una con su explicación y el paso a paso sincronizado.
- **Puntos**: las 6 formas de anotar animadas, marcador por cuarto, anotaciones del juego y estadísticas.
- **Guía**: el terreno con sus partes numeradas, las reglas por puntos, las posiciones, un glosario y los ajustes.

En cada jugada se ve:

- Los 22 jugadores y los 5 árbitros moviéndose, con la cámara siguiendo al balón (o el campo completo).
- La **pizarra**: las rutas dibujadas antes del snap.
- El **pase de dónde a dónde**: de qué yarda lanza, dónde atrapa, yardas en el aire y yardas tras atrapar.
- El rastro del balón (por tierra y por aire), los contactos, las primeras y 10 y las anotaciones.
- El **pañuelo amarillo** volando desde el árbitro, la tarjeta de la falta con su señal y el castigo de yardas animado; el **pañuelo rojo** del desafío y la revisión.
- Una barra de tiempo para pausar, adelantar o regresar, y velocidad 0.5× / 1× / 2×.

## Todas las animaciones

| Categoría | Jugadas |
| --- | --- |
| Carreras | Carrera por el medio · Carrera por fuera (barrida) · QB sneak · Jet sweep con movimiento antes del snap · Scramble del QB · Touchdown por tierra · Primera y 10 |
| Pases | Pase corto (slant) · Pase medio (cruce) · Pase profundo (bomba) · Pantalla (screen) · Play-action · Touchdown por aire · Pase incompleto · Ave María (Hail Mary) · Flea flicker · Spike |
| Defensa | Sack · Intercepción · Pick-six · Balón suelto (fumble) · Scoop and score · Safety · Cuarta oportunidad fallida |
| Patadas | Patada inicial con retorno · Touchback · Retorno para touchdown · Patada corta (onside) · Despeje con retorno · Fair catch · Despeje a la zona (touchback) · Gol de campo · Gol de campo fallado · Patada bloqueada |
| Anotaciones | Punto extra · Conversión de 2 por tierra · Conversión de 2 por pase · Conversión fallida |
| Pañuelos y reglas | Holding · Salida en falso · Fuera de lugar · Retraso de juego · Interferencia de pase · Rudeza contra el pasador · Facemask · Desafío (pañuelo rojo) |
| Reloj | Tiempo fuera · Aviso de 2 minutos · Rodilla (kneel) |

## Correrla en tu computadora

No necesita compilar nada: son archivos estáticos (HTML, CSS y JavaScript con módulos).

```bash
python -m http.server 5173
```

Luego abre `http://localhost:5173`. El service worker solo funciona en `localhost` o con HTTPS.

## Estructura

- `index.html`: las 4 pestañas.
- `css/app.css`: estilos con los tokens de El Play (claro y oscuro).
- `js/plays.js`: el motor de jugadas (posiciones cuadro a cuadro, balón, árbitros, pañuelos, efectos y pasos).
- `js/field.js`: el terreno en SVG, la cámara y el dibujo de cada jugada.
- `js/game.js`: el juego simulado (reloj, downs, anotaciones, faltas, desafíos, tiempos fuera).
- `js/catalog.js`: la lista de todas las animaciones.
- `js/app.js`: la interfaz.
- `sw.js` y `manifest.webmanifest`: la parte PWA.
