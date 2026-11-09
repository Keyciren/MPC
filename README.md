# ♠ Club de Poker — Gestor de torneos Texas Hold'em

Web para administrar las temporadas del club: calendario, inscripción, mesas, reloj de ciegas, recompras/add on,
eliminaciones con cartas y fotos, premios, puntajes, ranking, estadísticas y un **resumen lúdico** de cada fecha
(descargable en Word).

## Cómo correrla

Requisitos: Node.js 18 o superior.

```bash
npm install
```

```bash
ADMIN_PASSWORD=tu-clave npm start
```

Abre <http://localhost:3000>. Los jugadores entran sin clave (solo lectura). El administrador entra con **Admin** y la
contraseña de `ADMIN_PASSWORD` (si no la defines, es `admin`).

Variables de entorno:

| Variable         | Uso                                                        | Por defecto |
|------------------|------------------------------------------------------------|-------------|
| `ADMIN_PASSWORD` | Contraseña del administrador                               | `admin`     |
| `PORT`           | Puerto HTTP                                                | `3000`      |
| `DATA_DIR`       | Carpeta donde se guardan `db.json` y las fotos (`uploads/`) | `./data`    |

Todos los datos quedan en `data/db.json` y las fotos en `data/uploads/`. Respalda esa carpeta (o usa
**Ajustes → Descargar respaldo**).

### Publicarla para el club

Sirve cualquier hosting de Node con **disco persistente** (Render, Railway, Fly.io, un VPS o un PC de la casa).
Monta el disco en una ruta y apunta `DATA_DIR` a ella; si no, las fotos y los datos se pierden al reiniciar.

## Qué hace

### Perfil administrador
- **Jugadores**: nombre, nickname, correo, si es del club o invitado, activo/inactivo.
- **Temporada y calendario**: N fechas por temporada; cada fecha puede tener varias opciones de día y se marca la final
  con un clic. Además: sede, modalidad (Rebuy/Freezeout), tipo (Normal/Grand Slam), dealers y trainee.
- **Valores de la temporada**: buy-in Freezeout y Rebuy, recompra, add on, fee, fichas iniciales, de recompra y de
  add on, hasta qué nivel se puede recomprar, lucky loser, % de premios, redondeo y estructura de ciegas. Cada fecha
  copia estos valores al prepararla y se pueden ajustar solo para esa fecha.
- **Tablas de puntaje** editables (Normal por cantidad de jugadores y Grand Slam), precargadas con las del club.
- **Fecha**:
  1. *Inscripción*: se eligen los jugadores (o se crea un invitado al vuelo), la modalidad y los jugadores por mesa.
  2. *Mesas*: se elige el crupier de cada mesa (un jugador, otra persona o ninguno). Las mesas se sortean
     equilibradas y el crupier que también juega queda sentado en su mesa.
  3. *En vivo*: reloj de ciegas con aviso sonoro, pozo, premios y stack promedio en tiempo real. Botones de recompra
     (+R/−R) y add on (una vez por jugador). En **Eliminar** se registra quién eliminó a quién, las cartas de cada uno,
     en qué calle fue el all in y quién lo hizo, el board y la foto de la mano.
     - En Rebuy, mientras el periodo está abierto, la eliminación puede ser una recompra.
     - En Freezeout se ofrece el **lucky loser** (una vez por jugador).
     - Tras cada eliminación definitiva se sugiere **balancear o romper mesas** y se aplica con un clic (o se mueve a
       mano con ⇄).
     - Además: jackpot (jugador, rival, mano, cartas, monto y foto), inscripción tardía y puntos extra para el ranking.
  4. *Finalizar*: se habilita cuando queda un solo jugador. Se puede subir la foto del ganador con la mano final.
  5. *Resultados y Resumen*: posiciones, puntos, premios, eliminaciones y recompras. El resumen lúdico se escribe solo
     a partir de las eliminaciones (primer eliminado, mesa final, bubble, heads up, ganador, jackpot y cómo queda el
     ranking). Cada párrafo se puede editar y se descarga en **Word**.
- **Reabrir** una fecha finalizada para corregirla, y **Deshacer/Editar** cualquier registro.

### Perfil jugador (público)
- **Calendario** con mini calendario mensual y tabla de fechas; cada fecha lleva a su resumen con las fotos.
- **Fecha en vivo**: reloj, mesas, premios y eliminados, que se actualizan solos cada pocos segundos.
- **Tablas de puntaje**, **Tabla de posiciones** (T1…Tn, con `x` cuando el jugador no asistió) y **Estadísticas**
  (asistencia, victorias, mesas finales, cobros, hitman y jackpots).

## Reglas que aplica el sistema
- El **lugar** de cada jugador sale del orden de eliminaciones definitivas; el último en pie es el 1°.
- Los **puntos** salen de la tabla del tipo de fecha (Normal/GS), según la columna que corresponde a la cantidad de
  inscritos. Con más jugadores que la columna más alta, se usa esa columna.
- **Pozo** = buy-ins + recompras + add on + lucky losers. El **fee** se muestra aparte y no entra al pozo.
- Los **invitados** juegan, ocupan lugar y reciben premio, pero no aparecen en el ranking.

## Desarrollo

```bash
npm test
```

- `server.js`: API Express (datos en JSON, subida de imágenes, login de administrador, Word).
- `public/js/logic.js`: reglas puras (puntajes, premios, mesas, balanceo, ranking, resumen). La usan el navegador y
  el servidor.
- `public/js/views-*.js`: pantallas de jugador y de administrador (JavaScript sin compilación).
- `lib/docx.js`: genera el resumen en Word.
