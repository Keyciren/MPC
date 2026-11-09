import { S, loadDb, isAdmin, logout, setRerender, esc, toast, publish, fetchPublished, CONFIG } from './core.js';
import { homeView, calendarView, tournamentView, rankingView, pointsView, statsView, bindTabs, clockState, fmtMs } from './views-public.js';
import { loginView, playersView, seasonAdminView, pointsAdminView, tournamentAdminView, settingsView } from './views-admin.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');
let current = null;

function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts: path.split('/').filter(Boolean), q, path };
}

function route() {
  const { parts, q } = parseHash();
  const [a, b, c] = parts;
  if (!a) return homeView();
  if (a === 'calendario') return calendarView(q);
  if (a === 'torneo' && b) return tournamentView(b);
  if (a === 'ranking') return rankingView(q);
  if (a === 'puntajes') return pointsView();
  if (a === 'estadisticas') return statsView(q);
  if (a === 'login') return loginView();
  if (a === 'admin') {
    if (!isAdmin()) return loginView();
    if (b === 'jugadores') return playersView();
    if (b === 'temporada') return seasonAdminView(q);
    if (b === 'puntajes') return pointsAdminView();
    if (b === 'fecha' && c) return tournamentAdminView(c);
    if (b === 'ajustes') return settingsView();
    return seasonAdminView(q);
  }
  return { html: '<p>Página no encontrada.</p>' };
}

function renderNav() {
  const { path } = parseHash();
  const link = (href, label) => `<a href="${href}" class="${path === href.slice(1) || (href !== '#/' && path.startsWith(href.slice(1))) ? 'on' : ''}">${label}</a>`;
  nav.innerHTML = `
    <a class="brand" href="#/">♠ ${esc(S.db.settings.clubName)}</a>
    <button class="burger" aria-label="Menú" onclick="document.body.classList.toggle('menu-open')">☰</button>
    <div class="links">
      ${link('#/calendario', 'Calendario')}
      ${link('#/ranking', 'Posiciones')}
      ${link('#/puntajes', 'Puntajes')}
      ${link('#/estadisticas', 'Estadísticas')}
      ${
        isAdmin()
          ? `<span class="sep"></span><button class="btn sm ${S.dirty ? '' : 'ghost'} pub-btn" data-publish ${S.publishing ? 'disabled' : ''} title="${S.dirty ? 'Hay cambios guardados solo en este navegador' : 'Todo publicado'}">${S.publishing ? 'Publicando…' : S.dirty ? '⬆ Publicar cambios' : '✓ Publicado'}</button>${link('#/admin/temporada', 'Temporada')}${link('#/admin/jugadores', 'Jugadores')}${link('#/admin/puntajes', 'Editar puntajes')}${link('#/admin/ajustes', 'Ajustes')}<a href="#" data-logout>Salir</a>`
          : `<a href="#/login" class="admin-link">Admin</a>`
      }
    </div>`;
  const pb = nav.querySelector('[data-publish]');
  if (pb) pb.onclick = () => publish();
  const lo = nav.querySelector('[data-logout]');
  if (lo)
    lo.onclick = async (e) => {
      e.preventDefault();
      logout();
      await loadDb();
      location.hash = '#/';
      render();
    };
}

function render() {
  if (!S.db) return;
  const y = window.scrollY;
  renderNav();
  try {
    current = route();
  } catch (e) {
    console.error(e);
    current = { html: `<div class="panel warn"><p>Ocurrió un error mostrando esta página.</p><pre class="small">${esc(e.stack || e.message)}</pre></div>` };
  }
  main.innerHTML = current.html;
  bindTabs(main);
  if (current.bind) current.bind(main);
  window.scrollTo(0, y);
}

setRerender(render);

window.addEventListener('hashchange', () => {
  document.body.classList.remove('menu-open');
  render();
  window.scrollTo(0, 0);
});

// Reloj en pantalla (vista jugador y admin)
setInterval(() => {
  if (!current || !S.db) return;
  if (current.tick) return current.tick(main);
  const el = main.querySelector('[data-time]');
  const { parts } = parseHash();
  if (el && parts[0] === 'torneo') {
    const t = S.db.tournaments.find((x) => x.id === parts[1]);
    if (t && t.config) el.textContent = fmtMs(clockState(t).remaining);
  }
}, 500);

// Jugadores: revisan cada 30 s si el administrador publicó algo nuevo
setInterval(async () => {
  if (isAdmin() || !S.db || document.hidden) return;
  if (document.querySelector('.modal-back')) return;
  try {
    const pub = await fetchPublished();
    if (pub && pub.version !== S.db.version) {
      S.db = pub;
      S.noData = false;
      render();
    }
  } catch {}
}, 30000);

// Administrador: con un torneo en juego, publica solo cada pocos minutos
setInterval(() => {
  if (!isAdmin() || !S.db || !S.dirty || S.publishing || !CONFIG.autoPublishMinutes) return;
  if (!S.db.tournaments.some((t) => t.status === 'running')) return;
  if (Date.now() - S.lastPublish < CONFIG.autoPublishMinutes * 60000) return;
  if (!S.lastPublish) S.lastPublish = Date.now(); // primera vez: espera un intervalo
  else publish({ auto: true });
}, 20000);

window.addEventListener('beforeunload', (e) => {
  if (isAdmin() && S.dirty) e.preventDefault();
});

loadDb()
  .then(render)
  .catch((e) => {
    main.innerHTML = `<div class="panel warn">No se pudo conectar con el servidor: ${esc(e.message)}</div>`;
    toast(e.message, 'error');
  });
