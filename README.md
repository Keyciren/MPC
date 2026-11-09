# ♠ Club de Poker — Gestor de torneos Texas Hold'em

Web para administrar las temporadas del club: calendario, inscripción, mesas, reloj de ciegas, recompras/add on,
eliminaciones con cartas y fotos, premios, puntajes, ranking, estadísticas y un **resumen lúdico** de cada fecha
(descargable en Word).

## Dónde vive y dónde se guardan los datos

Todo funciona con tu cuenta de GitHub, sin servidores ni cuentas extra:

- **La web** se publica gratis en **GitHub Pages**: `https://keyciren.github.io/MPC/`.
- **Los datos** son un archivo `public/data/db.json` dentro de este mismo repositorio, y las fotos van en
  `public/data/uploads/`. Los jugadores leen desde ahí.
- **El administrador** trabaja sobre una **base de datos local** en su navegador (IndexedDB): todo se guarda al instante,
  aunque se corte internet. Con el botón **⬆ Publicar cambios** se suben los datos y las fotos al repositorio en un
  solo commit. Durante un torneo en juego se publica solo cada 3 minutos. Los jugadores ven lo nuevo en 1–2 minutos
  (y la página se refresca sola).
- Los **correos** de los jugadores no se publican (el repositorio es público): quedan solo en el navegador del
  administrador y en el respaldo.

### Activar GitHub Pages (una sola vez)

1. En GitHub, abre el repositorio → **Settings → Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Ve a **Actions → Publicar web en GitHub Pages → Run workflow** (o espera al próximo cambio en `main`).
   En 1–2 minutos la web queda en `https://keyciren.github.io/MPC/`.

### Ingresar como administrador

El administrador entra con **Admin** usando un **token de GitHub** (se guarda solo en ese navegador):

1. Abre <https://github.com/settings/personal-access-tokens/new>.
2. En **Repository access** elige *Only select repositories* → **MPC**.
3. En **Repository permissions → Contents**, elige **Read and write**.
4. Presiona **Generate token**, cópialo y pégalo en la pantalla de ingreso.

Para administrar desde otro computador o celular, ingresa con el token allí. Para tener también los correos, usa
**Ajustes → Descargar respaldo** en el primero y **Cargar respaldo** en el segundo.

### Probarla en tu computador

Con Node.js 18 o superior:

```bash
npm start
```

Se abre en <http://localhost:3000>. Ojo: **Publicar** sube los datos a GitHub igual que la versión en línea.

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
     ranking). Cada párrafo se puede editar y se descarga en **Word** (se genera en el navegador).
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

- `public/`: la web completa (HTML, CSS y JavaScript sin compilación). Es lo que publica GitHub Pages.
- `public/js/logic.js`: reglas puras (puntajes, premios, mesas, balanceo, ranking, resumen).
- `public/js/store.js`: base local (IndexedDB) y publicación en GitHub (un commit por publicación).
- `public/js/config.js`: repositorio y rama donde se publica, y cada cuántos minutos se publica sola durante un torneo.
- `public/js/word.js` + `public/vendor/docx.iife.js`: resumen en Word.
- `.github/workflows/pages.yml`: publica `public/` en GitHub Pages en cada cambio de `main`.
