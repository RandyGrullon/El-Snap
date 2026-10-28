# El-Snap

**El Snap** es El Play para la NFL: la misma app (pantallas, estilo y forma de usarla) con los juegos reales de la NFL, donde **cada jugada se ve animada en el campo** con los jugadores que participan. Es una PWA: funciona en el teléfono y en la computadora, se instala sin tienda y la parte que no depende de internet funciona sin conexión.

En producción: **https://el-snap.vercel.app**

## Pantallas (como en El Play)

- **Juegos:** la portada de El Play. Fecha y título, los escudos de los equipos del día (anillo rojo si juegan ahora), los días de la semana y las tarjetas de cada juego:
  - por empezar: hora, cuenta regresiva, TV, estadio, apuestas y el botón «Avisarme»;
  - en vivo: el marcador con los colores de cada equipo, quién tiene el balón, el down y la yarda en un campito, y la última jugada en español (por ejemplo «P.Mahomes pase de 54 yardas a X.Worthy»), que se ilumina cuando cambia;
  - final: el marcador y las figuras del juego.
- **El juego:** el marcador partido con los colores de cada equipo.
  - **En vivo** (revisa ESPN cada 5 s): la situación (down, distancia, yarda, zona roja) y **el campo en vivo**: los equipos esperan formados la próxima jugada (o el punto extra tras un touchdown, o la patada tras anotar); cada jugada nueva se anima en cuanto llega y luego las fichas caminan hasta la nueva línea. Sin repeticiones: las jugadas que ya pasaron se ven en la hoja «Jugadas». Las de 20 yardas o más salen con su tarjeta («¡54 YARDAS!»). Además, los jugadores que participan en la jugada (con foto, papel y número), los jugadores del juego (el QB en grande y las figuras), el marcador por cuartos, las últimas jugadas estilo chat (toca una para verla en la hoja), así va el juego (probabilidad de ganar y las jugadas que más pesaron) y los detalles.
  - **Final:** la historia de «la jugada del juego» con la jugada animada, las figuras, el marcador por cuartos y las anotaciones; luego así va el juego, las anotaciones, el mapa de series y los detalles.
  - **Previa:** probabilidad de victoria, hora y lugar, quiénes destacan, cómo llegan y lesionados.
  - Hojas **Jugadas** (todas, por serie; al tocar una se anima ahí mismo) y **Box score** (comparación y números de cada jugador).
- **Botón rojo:** los juegos en vivo ahora mismo (o los próximos).
- **Posiciones:** por división (la tarjeta grande del primero y las filas de los demás) y la siembra de playoffs, y los **Líderes** de la temporada.
- **Jugadas:** las 49 animaciones de El Snap para aprender (carreras, pases, defensa, patadas, anotaciones, pañuelos y reloj).
- **Más:** instalar, tema, animaciones de jugadas (todas, solo las grandes o apagadas), velocidad, pizarra, vibración, y Aprende: cómo se anota, el terreno y las reglas, y un juego de práctica simulado.

## Qué se ve en cada jugada

- Los 22 jugadores y los 5 árbitros moviéndose, con la cámara siguiendo al balón (o el campo completo).
- Los protagonistas con su número y su nombre real: el que lanza, el que atrapa, el que corre, el que taclea, el que patea, el que regresa.
- La **pizarra** con las rutas antes del snap, el **pase de dónde a dónde** (de qué yarda lanza, dónde atrapa, yardas en el aire y tras atrapar) y el rastro del balón.
- El **pañuelo amarillo** volando desde el árbitro, la tarjeta de la falta y el castigo de yardas; el **pañuelo rojo** del desafío.
- Las tarjetas de touchdown, gol de campo, intercepción, sack… con el color del equipo, y el paso a paso narrado en español.
- Una barra de tiempo para pausar, adelantar o regresar, y velocidad 0.5× / 1× / 2×.

## Datos

Los juegos vienen de los datos públicos de ESPN (`site.api.espn.com`, sin clave). Son públicos pero no oficiales: pueden cambiar sin aviso. Algunas redes de trabajo o escuela los bloquean; en ese caso la app lo avisa. La posición exacta de cada jugador en el campo es una recreación a partir de lo que dice cada jugada (tipo, yardas, yarda de inicio, down y texto oficial).

## Correrla en tu computadora

No necesita compilar nada: son archivos estáticos (HTML, CSS y JavaScript con módulos).

```bash
python -m http.server 5173
```

Luego abre `http://localhost:5173`. El service worker solo funciona en `localhost` o con HTTPS.

## Estructura

- `index.html`: la base; cada pantalla la arma `js/views/`.
- `css/app.css` y `css/elplay.css`: los tokens y las piezas de El Play (claro y oscuro).
- `js/app.js`: rutas, la barra de abajo y el botón rojo de en vivo.
- `js/views/`: `home.js` (Juegos), `game.js` (el juego), `standings.js` (Posiciones y Líderes), `more.js` (Más), `learn.js` (Jugadas, cómo se anota, la guía y la práctica).
- `js/espn.js`: los datos de ESPN (juegos, juego completo, posiciones, líderes, jugadores).
- `js/nfl.js`: traduce cada jugada de ESPN a una animación y al español.
- `js/plays.js`: el motor de jugadas (posiciones cuadro a cuadro, balón, árbitros, pañuelos, efectos y pasos).
- `js/field.js`: el terreno en SVG, la cámara y el dibujo de cada jugada.
- `js/game.js` y `js/catalog.js`: el juego de práctica y la lista de animaciones.
- `sw.js` y `manifest.webmanifest`: la parte PWA.
