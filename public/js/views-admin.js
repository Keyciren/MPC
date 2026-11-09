import {
  S,
  esc,
  mutate,
  toast,
  modal,
  confirmDlg,
  pickCards,
  pickImage,
  cardsHtml,
  imgHtml,
  on,
  pname,
  playerById,
  currentSeason,
  playerOptions,
  login,
  fmtDate,
  refresh,
  publish,
} from './core.js';
import { CONFIG } from './config.js';
import { downloadWord } from './word.js';
import {
  uid,
  defaultSeasonConfig,
  buildConfig,
  seasonTournaments,
  entryState,
  alivePlayers,
  totals,
  prizes,
  money,
  buildTables,
  balanceSuggestions,
  applyMoves,
  tableOf,
  busts,
  outEvents,
  STREETS,
  buildSummary,
  results,
  defaultLevels,
  newTournament,
  STRUCTURE_KEYS,
  levelsFor,
  rebuyOpenAt,
  luckyLoserOpenAt,
  dealersToSeatOne,
  isTableDealer,
  needsFinalTable,
  drawFinalTable,
  tableName,
} from './logic.js';
import { importedTournament, badges, clockHtml, clockState, resultsTable, seasonPicker, seasonFromQuery, pointsTableHtml, STATUS } from './views-public.js';

// ---------- utilidades de formularios ----------
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  ks.slice(0, -1).forEach((k) => {
    if (o[k] == null) o[k] = {};
    o = o[k];
  });
  o[ks[ks.length - 1]] = val;
}
function readField(el) {
  const t = el.dataset.type || 'str';
  if (el.type === 'checkbox') return el.checked;
  if (t === 'num') return el.value === '' ? 0 : Number(el.value);
  if (t === 'list') return el.value.split(/[,;\s]+/).filter(Boolean).map(Number).filter((x) => !isNaN(x));
  return el.value;
}
function field(label, path, value, { type = 'num', input = 'number', hint = '', attrs = '' } = {}) {
  const v = Array.isArray(value) ? value.join(', ') : value ?? '';
  return `<label class="fld"><span>${esc(label)}</span>${
    input === 'checkbox'
      ? `<input type="checkbox" data-f="${path}" ${value ? 'checked' : ''} ${attrs}>`
      : `<input type="${input}" data-f="${path}" data-type="${type}" value="${esc(v)}" ${attrs}>`
  }${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</label>`;
}
// Guarda cada campo [data-f] al cambiar. getTarget(db) devuelve el objeto a modificar.
function bindFields(root, getTarget, after) {
  on(root, '[data-f]', 'change', (el) =>
    mutate(
      (db) => {
        const tgt = getTarget(db);
        setPath(tgt, el.dataset.f, readField(el));
        if (after) after(db, tgt, el.dataset.f);
      },
      { silent: true }
    ).catch(() => {})
  );
}

function levelsToText(levels) {
  return (levels || []).map((l) => (l.break ? `descanso/${l.minutes}` : `${l.sb}/${l.bb}/${l.ante || 0}/${l.minutes}`)).join('\n');
}
function textToLevels(txt) {
  return txt
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (/^(d|descanso|break|pausa)/i.test(l)) return { break: true, minutes: Number((l.match(/\d+/) || [10])[0]) };
      const [sb, bb, ante, minutes] = l.split(/[\/\s,;]+/).map(Number);
      return { sb: sb || 0, bb: bb || sb * 2 || 0, ante: ante || 0, minutes: minutes || 20 };
    });
}
const LEVELS_HELP = 'Una línea por nivel: ciega chica / ciega grande / ante / minutos (ej: 600/1200/1200/15). Para un descanso escribe: descanso/5';

// ---------- Formato de la fecha (modalidad + tipo) ----------
const FORMATS = [
  { id: 'rebuy', modality: 'rebuy', type: 'normal', label: 'Rebuy' },
  { id: 'freezeout', modality: 'freezeout', type: 'normal', label: 'Freezeout' },
  { id: 'gs', modality: 'rebuy', type: 'gs', label: 'Grand Slam' },
  { id: 'gs-freezeout', modality: 'freezeout', type: 'gs', label: 'Grand Slam freezeout', rare: true },
];
function formatOf(t) {
  return FORMATS.find((f) => f.modality === t.modality && f.type === (t.type || 'normal')) || FORMATS[0];
}
function formatSelect(t, attrs = '') {
  const cur = formatOf(t);
  return `<select data-format ${attrs}>${FORMATS.filter((f) => !f.rare || f.id === cur.id)
    .map((f) => `<option value="${f.id}" ${f.id === cur.id ? 'selected' : ''}>${f.label}</option>`)
    .join('')}</select>`;
}
// Cambia el formato y, si la fecha ya está en preparación, recarga montos, fichas y estructura de ciegas
function applyFormat(x, db, fid) {
  const f = FORMATS.find((y) => y.id === fid) || FORMATS[0];
  x.modality = f.modality;
  x.type = f.type;
  if (x.config && x.status !== 'running' && x.status !== 'finished') {
    const season = db.seasons.find((s) => s.id === x.seasonId);
    x.config = { ...buildConfig(season, x.modality, x.type), perTable: x.config.perTable, luckyLoserAllowed: x.config.luckyLoserAllowed ?? true };
  }
}
function formatSummary(t) {
  const c = t.config;
  if (!c) return '';
  const cur = c.currency;
  const rounds = c.levels.filter((l) => !l.break).length;
  const breaks = c.levels.filter((l) => l.break).length;
  const parts = [`Buy-in ${money(c.buyIn, cur)} · ${c.startChips.toLocaleString('es-CL')} fichas`];
  if (t.modality === 'rebuy') {
    parts.push(`Recompra ${money(c.rebuyCost, cur)} · ${c.rebuyChips.toLocaleString('es-CL')} fichas hasta el nivel ${c.rebuyUntilLevel}`);
    parts.push(`Add on ${money(c.addonCost, cur)} · ${c.addonChips.toLocaleString('es-CL')} fichas`);
  } else if (c.luckyLoserAllowed) {
    parts.push(`Lucky loser ${money(c.luckyLoserCost, cur)}${c.luckyLoserUntilLevel ? ` hasta el nivel ${c.luckyLoserUntilLevel}` : ''}`);
  }
  parts.push(`${rounds} niveles${breaks ? ` + ${breaks} descanso${breaks > 1 ? 's' : ''}` : ''}, parte en ${c.levels[0].sb}/${c.levels[0].bb} (${c.levels[0].minutes} min)`);
  return `<div class="format-box"><b>Formato cargado: ${formatOf(t).label}</b><ul>${parts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
}

// ---------- Login ----------
export function loginView() {
  const newTokenUrl = 'https://github.com/settings/personal-access-tokens/new';
  return {
    html: `<div class="panel narrow"><h2>Ingreso administrador</h2>
      <p class="small">El administrador ingresa con un <b>token de GitHub</b> con permiso para escribir en el repositorio <b>${esc(CONFIG.owner)}/${esc(CONFIG.repo)}</b>. Se guarda solo en este navegador.</p>
      <form data-login><label class="fld"><span>Token de GitHub</span><input type="password" name="pw" autocomplete="off" required autofocus placeholder="github_pat_…"></label>
      <button class="btn">Ingresar</button></form>
      <details class="mt small"><summary>¿Cómo creo el token?</summary><ol>
        <li>Abre <a href="${newTokenUrl}" target="_blank" rel="noopener">GitHub → Settings → Fine-grained tokens → Generate new token</a>.</li>
        <li>Nombre: <i>Club de poker</i>. Expiración: la que prefieras (por ejemplo, 1 año).</li>
        <li>En <b>Repository access</b> elige <i>Only select repositories</i> → <b>${esc(CONFIG.repo)}</b>.</li>
        <li>En <b>Permissions → Repository permissions</b> busca <b>Contents</b> y elige <i>Read and write</i>.</li>
        <li>Presiona <b>Generate token</b>, cópialo y pégalo aquí.</li>
      </ol></details></div>`,
    bind(root) {
      root.querySelector('[data-login]').onsubmit = async (e) => {
        e.preventDefault();
        try {
          await login(e.target.pw.value);
          toast('Bienvenido');
          location.hash = '#/admin/temporada';
        } catch (err) {
          toast(err.status === 401 ? 'Token inválido' : err.message, 'error');
        }
      };
    },
  };
}

// ---------- Jugadores ----------
export function playersView() {
  const ps = [...S.db.players].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'club' ? -1 : 1));
  return {
    html: `<div class="row between"><h2>Jugadores</h2><button class="btn" data-add>+ Nuevo jugador</button></div>
    <div class="panel"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Nombre</th><th>Nickname</th><th>Correo</th><th>Tipo</th><th></th></tr></thead>
      <tbody>${
        ps
          .map(
            (p) => `<tr class="${p.active === false ? 'dim' : ''}"><td>${esc(p.name)}</td><td>${esc(p.nickname || '')}</td><td>${esc(p.email || '')}</td>
          <td><span class="tag ${p.type === 'invitado' ? 'guest' : 'club'}">${p.type === 'invitado' ? 'Invitado' : 'Club'}</span></td>
          <td class="right"><button class="btn sm ghost" data-edit="${p.id}">Editar</button></td></tr>`
          )
          .join('') || '<tr><td colspan="5" class="muted">Aún no hay jugadores. Agrega el primero.</td></tr>'
      }</tbody></table></div></div>`,
    bind(root) {
      root.querySelector('[data-add]').onclick = () => editPlayer(null);
      on(root, '[data-edit]', 'click', (b) => editPlayer(b.dataset.edit));
    },
  };
}

export async function editPlayer(id, defaults = {}) {
  const p = id ? playerById(id) : { name: '', nickname: '', email: '', type: 'club', active: true, ...defaults };
  const used = id && S.db.tournaments.some((t) => (t.entries || []).some((e) => e.playerId === id));
  return modal(
    `<h3>${id ? 'Editar' : 'Nuevo'} jugador</h3>
    <form data-pf>
      <label class="fld"><span>Nombre</span><input name="name" required value="${esc(p.name)}"></label>
      <label class="fld"><span>Nickname</span><input name="nickname" value="${esc(p.nickname || '')}" placeholder="Como aparece en ranking y resúmenes"></label>
      <label class="fld"><span>Correo</span><input name="email" type="email" value="${esc(p.email || '')}"></label>
      <label class="fld"><span>Tipo</span><select name="type"><option value="club" ${p.type !== 'invitado' ? 'selected' : ''}>Parte del club</option><option value="invitado" ${p.type === 'invitado' ? 'selected' : ''}>Invitado</option></select></label>
      <label class="fld inline"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}> <span>Activo</span></label>
      <div class="row between mt">${id && !used ? '<button type="button" class="btn danger ghost" data-del>Eliminar</button>' : '<span></span>'}<button class="btn">Guardar</button></div>
    </form>`,
    {
      onMount: (m, close) => {
        m.querySelector('[data-pf]').onsubmit = async (e) => {
          e.preventDefault();
          const f = e.target;
          const data = { name: f.name.value.trim(), nickname: f.nickname.value.trim(), email: f.email.value.trim(), type: f.type.value, active: f.active.checked };
          const newId = id || uid('p');
          await mutate((db) => {
            if (id) Object.assign(db.players.find((x) => x.id === id), data);
            else db.players.push({ id: newId, ...data });
          }).catch(() => {});
          close(newId);
        };
        const del = m.querySelector('[data-del]');
        if (del)
          del.onclick = async () => {
            if (!(await confirmDlg(`¿Eliminar a ${p.name}?`, 'Eliminar'))) return;
            await mutate((db) => {
              db.players = db.players.filter((x) => x.id !== id);
            }).catch(() => {});
            close(null);
          };
      },
    }
  );
}

// ---------- Temporada y calendario ----------
export function seasonAdminView(q) {
  const season = seasonFromQuery(q);
  if (!season) return { html: '<p>No hay temporadas</p>' };
  const c = season.config;
  const ts = seasonTournaments(S.db, season.id);
  const isCurrent = S.db.settings.currentSeasonId === season.id;
  const rows = ts
    .map((t) => {
      const opts = t.dateOptions || [];
      return `<tr data-t="${t.id}" class="${t.type === 'gs' ? 'gs-row' : ''}">
        <td><input class="w-sm" data-tf="label" value="${esc(t.label)}"></td>
        <td class="dates">${opts
          .map(
            (d) =>
              `<span class="chip ${t.finalDate === d ? 'final' : ''}"><button class="link" data-final="${d}" title="Elegir como fecha final">${fmtDate(d, { day: '2-digit', month: '2-digit', year: '2-digit' })}</button><button class="x" data-rmdate="${d}" title="Quitar">×</button></span>`
          )
          .join('')}<input type="date" data-adddate class="w-date" title="Agregar opción de fecha"></td>
        <td><input class="w-sm" data-tf="venue" value="${esc(t.venue || '')}" placeholder="Sede"></td>
        <td>${formatSelect(t, t.status === 'running' || t.status === 'finished' ? 'disabled' : '')}</td>
        <td><button class="btn sm ghost" data-dealers>${(t.dealerIds || []).map(pname).join(', ') || 'Asignar'}</button>${t.trainee ? `<br><small class="muted">Trainee: ${esc(t.trainee)}</small>` : ''}</td>
        <td><span class="status ${t.status}">${STATUS[t.status]}</span></td>
        <td><a class="btn sm" href="#/admin/fecha/${t.id}">Abrir</a></td>
      </tr>`;
    })
    .join('');

  return {
    html: `
    <div class="row between wrap"><h2>Temporada y calendario</h2><div class="row">${seasonPicker(season.id, '#/admin/temporada')}<button class="btn ghost" data-newseason>+ Nueva temporada</button></div></div>
    <div class="panel">
      <div class="row between wrap"><h3>${esc(season.name)} ${isCurrent ? '<span class="tag club">Temporada actual</span>' : '<button class="btn sm ghost" data-current>Marcar como actual</button>'}</h3></div>
      <div class="form-grid">
        <label class="fld"><span>Nombre</span><input data-f="name" data-type="str" value="${esc(season.name)}"></label>
        <label class="fld"><span>Cantidad de fechas</span><input type="number" min="1" max="60" data-count value="${ts.length}"></label>
      </div>
    </div>
    <div class="panel"><h3>Calendario de fechas</h3>
      <p class="muted small">Agrega opciones de fecha con el selector y luego haz clic sobre una opción para dejarla como fecha final (queda destacada).</p>
      <div class="table-wrap"><table class="tbl cal-edit"><thead><tr><th>Fecha</th><th>Opciones / Día final</th><th>Sede</th><th>Formato</th><th>Dealers</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <div class="panel"><h3>Valores y fichas de la temporada</h3>
      <p class="muted small">Cada fecha copia estos valores al prepararla; después se pueden ajustar solo para esa fecha.</p>
      <div class="form-grid">
        ${field('Moneda', 'config.currency', c.currency, { type: 'str', input: 'text' })}
        ${field('Fee por torneo (por jugador)', 'config.fee', c.fee)}
        ${field('Jugadores por mesa', 'config.perTable', c.perTable)}
        ${field('% premios por lugar', 'config.prizePercents', c.prizePercents, { type: 'list', input: 'text', hint: 'Ej: 50, 30, 20' })}
        ${field('Redondear premios a', 'config.roundTo', c.roundTo, { hint: '0 = sin redondeo' })}
      </div>
      <h4>Freezeout</h4>
      <div class="form-grid">
        ${field('Buy-in', 'config.freezeout.buyIn', c.freezeout.buyIn)}
        ${field('Fichas iniciales', 'config.freezeout.startChips', c.freezeout.startChips)}
        ${field('Valor lucky loser', 'config.luckyLoserCost', c.luckyLoserCost)}
        ${field('Lucky loser hasta el nivel', 'config.freezeout.luckyLoserUntilLevel', c.freezeout.luckyLoserUntilLevel, { hint: '0 = sin límite' })}
      </div>
      <h4>Rebuy</h4>
      <div class="form-grid">
        ${field('Buy-in', 'config.rebuy.buyIn', c.rebuy.buyIn)}
        ${field('Fichas iniciales', 'config.rebuy.startChips', c.rebuy.startChips)}
        ${field('Valor recompra', 'config.rebuy.rebuyCost', c.rebuy.rebuyCost)}
        ${field('Fichas por recompra', 'config.rebuy.rebuyChips', c.rebuy.rebuyChips)}
        ${field('Valor add on', 'config.rebuy.addonCost', c.rebuy.addonCost)}
        ${field('Fichas add on', 'config.rebuy.addonChips', c.rebuy.addonChips)}
        ${field('Recompra hasta el nivel', 'config.rebuy.rebuyUntilLevel', c.rebuy.rebuyUntilLevel)}
        ${field('Máx. recompras por jugador', 'config.rebuy.rebuyMaxPerPlayer', c.rebuy.rebuyMaxPerPlayer, { hint: '0 = sin límite' })}
        ${field('Máx. recompras en total', 'config.rebuy.rebuyMaxTotal', c.rebuy.rebuyMaxTotal, { hint: '0 = sin límite' })}
      </div>
      <h4>Grand Slam (rebuy)</h4>
      <p class="muted small">Solo lo que cambia respecto a una fecha rebuy normal. En 0 = igual que la normal.</p>
      <div class="form-grid">
        ${field('Buy-in', 'config.rebuyGs.buyIn', (c.rebuyGs || {}).buyIn)}
        ${field('Fichas iniciales', 'config.rebuyGs.startChips', (c.rebuyGs || {}).startChips)}
        ${field('Valor recompra', 'config.rebuyGs.rebuyCost', (c.rebuyGs || {}).rebuyCost)}
        ${field('Fichas por recompra', 'config.rebuyGs.rebuyChips', (c.rebuyGs || {}).rebuyChips)}
        ${field('Valor add on', 'config.rebuyGs.addonCost', (c.rebuyGs || {}).addonCost)}
        ${field('Fichas add on', 'config.rebuyGs.addonChips', (c.rebuyGs || {}).addonChips)}
      </div>
      <h4>Estructuras de ciegas</h4>
      <p class="muted small">${LEVELS_HELP}. Si la estructura de Grand Slam está vacía, se usa la normal de esa modalidad.</p>
      <div class="structs">${STRUCTURE_KEYS.map(
        (k) => `<label class="fld"><span>${k.label}</span><textarea data-struct="${k.key}" rows="10" class="mono" placeholder="${k.key.endsWith('-gs') ? 'Vacío: usa la estructura normal' : ''}">${esc(levelsToText((c.structures || {})[k.key] || (k.key === 'rebuy-normal' || k.key === 'freezeout-normal' ? c.levels : [])))}</textarea></label>`
      ).join('')}</div>
    </div>`,
    bind(root) {
      bindFields(root, (db) => db.seasons.find((s) => s.id === season.id));
      on(root, '[data-struct]', 'change', (el) =>
        mutate((db) => {
          const cf = db.seasons.find((s) => s.id === season.id).config;
          cf.structures = cf.structures || {};
          const lv = textToLevels(el.value);
          if (lv.length) cf.structures[el.dataset.struct] = lv;
          else delete cf.structures[el.dataset.struct];
        }).catch(() => {}));
      const cur = root.querySelector('[data-current]');
      if (cur) cur.onclick = () => mutate((db) => (db.settings.currentSeasonId = season.id)).catch(() => {});
      root.querySelector('[data-newseason]').onclick = () => newSeason();
      root.querySelector('[data-count]').onchange = async (e) => {
        const n = Math.max(1, Number(e.target.value) || 1);
        const extra = ts.slice(n);
        if (extra.some((t) => t.status !== 'planned')) {
          toast('No se pueden quitar fechas que ya se prepararon o jugaron.', 'error');
          return refresh();
        }
        if (extra.length && !(await confirmDlg(`Se eliminarán ${extra.length} fecha(s) sin jugar. ¿Continuar?`))) return refresh();
        mutate((db) => {
          const ids = new Set(extra.map((t) => t.id));
          db.tournaments = db.tournaments.filter((t) => !ids.has(t.id));
          for (let i = ts.length + 1; i <= n; i++) db.tournaments.push(newTournament(season.id, i));
          db.seasons.find((s) => s.id === season.id).tournamentsCount = n;
        }).catch(() => {});
      };
      root.querySelectorAll('tr[data-t]').forEach((tr) => {
        const tid = tr.dataset.t;
        const upd = (fn, silent = true) => mutate((db) => fn(db.tournaments.find((t) => t.id === tid)), { silent }).catch(() => {});
        tr.querySelectorAll('[data-tf]').forEach((el) => (el.onchange = () => upd((t) => (t[el.dataset.tf] = el.value))));
        tr.querySelector('[data-format]').onchange = (e) => mutate((db) => applyFormat(db.tournaments.find((t) => t.id === tid), db, e.target.value)).catch(() => {});
        tr.querySelector('[data-adddate]').onchange = (e) => {
          const d = e.target.value;
          if (d) upd((t) => {
            t.dateOptions = [...new Set([...(t.dateOptions || []), d])].sort();
            if (t.dateOptions.length === 1 && !t.finalDate) t.finalDate = d;
          });
        };
        tr.querySelectorAll('[data-final]').forEach((b) => (b.onclick = () => upd((t) => (t.finalDate = t.finalDate === b.dataset.final ? null : b.dataset.final))));
        tr.querySelectorAll('[data-rmdate]').forEach(
          (b) =>
            (b.onclick = () =>
              upd((t) => {
                t.dateOptions = t.dateOptions.filter((d) => d !== b.dataset.rmdate);
                if (t.finalDate === b.dataset.rmdate) t.finalDate = null;
              }))
        );
        tr.querySelector('[data-dealers]').onclick = () => editDealers(tid);
      });
    },
  };
}

async function newSeason() {
  const prev = currentSeason();
  const name = await modal(
    `<h3>Nueva temporada</h3><form data-ns><label class="fld"><span>Nombre</span><input name="name" required value="Temporada ${S.db.seasons.length + 1}"></label>
    <label class="fld"><span>Cantidad de fechas</span><input name="n" type="number" min="1" value="${prev ? prev.tournamentsCount || 12 : 12}"></label>
    <p class="muted small">Se copian los valores, fichas y ciegas de la temporada actual.</p><button class="btn">Crear</button></form>`,
    {
      onMount: (m, close) =>
        (m.querySelector('[data-ns]').onsubmit = (e) => {
          e.preventDefault();
          close({ name: e.target.name.value, n: Number(e.target.n.value) || 12 });
        }),
    }
  );
  if (!name) return;
  const id = uid('s');
  await mutate((db) => {
    db.seasons.push({ id, name: name.name, tournamentsCount: name.n, config: prev ? structuredClone(prev.config) : defaultSeasonConfig() });
    for (let i = 1; i <= name.n; i++) db.tournaments.push(newTournament(id, i));
    db.settings.currentSeasonId = id;
  }).catch(() => {});
  location.hash = `#/admin/temporada?s=${id}`;
}

async function editDealers(tid) {
  const t = S.db.tournaments.find((x) => x.id === tid);
  const ps = S.db.players.filter((p) => p.active !== false);
  const res = await modal(
    `<h3>Dealers — ${esc(t.label)}</h3><form data-df><div class="checks">${ps
      .map((p) => `<label><input type="checkbox" name="d" value="${p.id}" ${(t.dealerIds || []).includes(p.id) ? 'checked' : ''}> ${esc(p.nickname || p.name)}</label>`)
      .join('')}</div>
      <label class="fld"><span>Trainee (opcional)</span><input name="trainee" value="${esc(t.trainee || '')}"></label><button class="btn">Guardar</button></form>`,
    {
      onMount: (m, close) =>
        (m.querySelector('[data-df]').onsubmit = (e) => {
          e.preventDefault();
          close({ ids: [...e.target.querySelectorAll('[name=d]:checked')].map((x) => x.value), trainee: e.target.trainee.value });
        }),
    }
  );
  if (!res) return;
  mutate((db) => {
    const x = db.tournaments.find((y) => y.id === tid);
    x.dealerIds = res.ids;
    x.trainee = res.trainee;
  }).catch(() => {});
}

// ---------- Tablas de puntaje (edición) ----------
export function pointsAdminView() {
  const pt = S.db.settings.pointTables;
  const editor = (key) => {
    const tb = pt[key];
    const maxRows = Math.max(1, ...tb.columns.map((c) => c.points.length));
    let rows = '';
    for (let i = 0; i < maxRows; i++) {
      rows += `<tr><th>${i + 1}°</th>${tb.columns.map((c, ci) => `<td><input type="number" class="cell" data-pt="${key}" data-col="${ci}" data-row="${i}" value="${c.points[i] ?? ''}"></td>`).join('')}</tr>`;
    }
    return `<div class="panel"><div class="row between"><h3>${esc(tb.name)}</h3><div class="row"><button class="btn sm ghost" data-addcol="${key}">+ Columna</button><button class="btn sm ghost" data-addrow="${key}">+ Lugar</button></div></div>
      <div class="table-wrap"><table class="tbl points edit"><thead>
      <tr><th>Etiqueta</th>${tb.columns.map((c, ci) => `<th><input class="cell lbl" data-colf="label" data-pt="${key}" data-col="${ci}" value="${esc(c.label)}"></th>`).join('')}</tr>
      <tr><th>Jugadores desde</th>${tb.columns.map((c, ci) => `<th><input type="number" class="cell" data-colf="min" data-pt="${key}" data-col="${ci}" value="${c.min}"></th>`).join('')}</tr>
      <tr><th>hasta</th>${tb.columns.map((c, ci) => `<th><input type="number" class="cell" data-colf="max" data-pt="${key}" data-col="${ci}" value="${c.max}"></th>`).join('')}</tr>
      </thead><tbody>${rows}<tr><th></th>${tb.columns.map((c, ci) => `<td><button class="btn sm ghost danger" data-rmcol="${key}" data-col="${ci}">Quitar</button></td>`).join('')}</tr></tbody></table></div></div>`;
  };
  return {
    html: `<h2>Editar tablas de puntaje</h2><p class="muted">Cada columna aplica según la cantidad de jugadores de la fecha. Grand Slam usa su propia tabla. Deja la celda vacía si ese lugar no suma puntos.</p>${editor('normal')}${editor('gs')}
      <div class="panel"><h3>Vista previa</h3>${pointsTableHtml(pt.normal)}${pointsTableHtml(pt.gs)}</div>`,
    bind(root) {
      const upd = (fn) => mutate((db) => fn(db.settings.pointTables), { silent: true }).catch(() => {});
      on(root, 'input[data-row]', 'change', (el) =>
        upd((pt) => {
          const col = pt[el.dataset.pt].columns[el.dataset.col];
          const i = Number(el.dataset.row);
          while (col.points.length <= i) col.points.push(0);
          col.points[i] = el.value === '' ? 0 : Number(el.value);
          while (col.points.length && !col.points[col.points.length - 1]) col.points.pop();
        })
      );
      on(root, 'input[data-colf]', 'change', (el) =>
        upd((pt) => {
          const col = pt[el.dataset.pt].columns[el.dataset.col];
          col[el.dataset.colf] = el.dataset.colf === 'label' ? el.value : Number(el.value);
        })
      );
      on(root, '[data-addcol]', 'click', (b) => upd((pt) => pt[b.dataset.addcol].columns.push({ label: 'Nueva', min: 0, max: 0, points: [] })));
      on(root, '[data-addrow]', 'click', (b) =>
        upd((pt) => {
          const cols = pt[b.dataset.addrow].columns;
          const max = Math.max(0, ...cols.map((c) => c.points.length));
          cols[0].points.length = max + 1;
          cols[0].points = Array.from(cols[0].points, (v) => v ?? 0);
        })
      );
      on(root, '[data-rmcol]', 'click', (b) => upd((pt) => pt[b.dataset.rmcol].columns.splice(Number(b.dataset.col), 1)));
    },
  };
}

// ---------- Administración de una fecha ----------
const tabState = {};

export function tournamentAdminView(id) {
  const t = S.db.tournaments.find((x) => x.id === id);
  if (!t) return { html: '<p>Fecha no encontrada</p>' };
  const season = S.db.seasons.find((s) => s.id === t.seasonId);
  if (t.imported)
    return { html: `<h2>${esc(t.label)} <small class="muted">${esc(season ? season.name : '')}</small></h2>${importedTournament(t)}` };
  const available = {
    planned: ['config'],
    setup: ['config', 'mesas'],
    running: ['vivo', 'config', 'resumen'],
    finished: ['resultados', 'resumen', 'vivo'],
  }[t.status];
  let tab = tabState[id];
  if (!available.includes(tab)) tab = available[0];
  const labels = { config: 'Inscripción y valores', mesas: 'Mesas', vivo: t.status === 'finished' ? 'Registro' : 'En vivo', resultados: 'Resultados', resumen: 'Resumen' };
  const head = `<div class="row between wrap"><div><h2>${esc(t.label)} <small class="muted">${esc(season ? season.name : '')}</small></h2>
    <p>${t.finalDate ? fmtDate(t.finalDate) : 'Sin fecha final'} ${t.venue ? '· ' + esc(t.venue) : ''} ${badges(t)} <span class="status ${t.status}">${STATUS[t.status]}</span></p></div>
    <div class="row"><a class="btn ghost sm" href="#/torneo/${t.id}">Vista jugador</a></div></div>
    <div class="tabs">${available.map((k) => `<button class="${k === tab ? 'on' : ''}" data-atab="${k}">${labels[k]}</button>`).join('')}</div>`;
  const body = { config: setupTab, mesas: tablesTab, vivo: liveTab, resultados: resultsTab, resumen: summaryTab }[tab](t, season);
  return {
    html: head + body.html,
    tick: body.tick,
    bind(root) {
      on(root, '[data-atab]', 'click', (b) => {
        tabState[id] = b.dataset.atab;
        refresh();
      });
      body.bind && body.bind(root);
    },
  };
}

const upT = (id, fn, silent = true) => mutate((db) => fn(db.tournaments.find((x) => x.id === id), db), { silent }).catch(() => {});

// --- Inscripción y valores
function setupTab(t, season) {
  if (t.status === 'planned') {
    return {
      html: `<div class="panel"><p>Esta fecha está programada. Elige el formato y presiona <b>Preparar fecha</b>: se cargan los montos, las fichas y la estructura de ciegas de ese formato (definidos en Temporada) y podrás inscribir jugadores.</p>
      <div class="row"><label class="fld inline"><span>Formato</span>${formatSelect(t)}</label></div>
      <button class="btn" data-prepare>Preparar fecha</button></div>`,
      bind(root) {
        root.querySelector('[data-prepare]').onclick = () =>
          upT(t.id, (x, db) => {
            applyFormat(x, db, root.querySelector('[data-format]').value);
            x.config = { ...buildConfig(db.seasons.find((s) => s.id === x.seasonId), x.modality, x.type), luckyLoserAllowed: true };
            x.prizePercents = [...x.config.prizePercents];
            x.status = 'setup';
            tabState[x.id] = 'config';
          }, false);
      },
    };
  }
  const c = t.config;
  const locked = t.status !== 'setup';
  const entryIds = new Set((t.entries || []).map((e) => e.playerId));
  const ps = S.db.players.filter((p) => p.active !== false || entryIds.has(p.id)).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'club' ? -1 : 1));
  const tot = totals(t, c);
  const pz = prizes(tot.pool, t.prizePercents || c.prizePercents, c.roundTo);
  return {
    html: `
    ${
      locked
        ? ''
        : `<div class="panel"><div class="row between wrap"><h3>Jugadores de la fecha <span class="pill">${entryIds.size}</span></h3>
      <div class="row"><button class="btn sm ghost" data-all>Todos los del club</button><button class="btn sm ghost" data-none>Ninguno</button><button class="btn sm ghost" data-guest>+ Invitado nuevo</button></div></div>
      <div class="checks big">${ps
        .map((p) => `<label class="${entryIds.has(p.id) ? 'on' : ''}"><input type="checkbox" data-entry="${p.id}" ${entryIds.has(p.id) ? 'checked' : ''}> ${esc(p.nickname || p.name)}${p.type === 'invitado' ? ' <span class="tag guest">inv</span>' : ''}</label>`)
        .join('')}</div></div>`
    }
    <div class="panel"><h3>Formato y valores de esta fecha</h3>
      ${formatSummary(t)}
      <div class="form-grid">
        <label class="fld"><span>Formato</span>${formatSelect(t, locked ? 'disabled' : '')}</label>
        ${field('Jugadores por mesa', 'config.perTable', c.perTable)}
        ${field('Buy-in', 'config.buyIn', c.buyIn)}
        ${field('Fichas iniciales', 'config.startChips', c.startChips)}
        ${field('Fee por jugador', 'config.fee', c.fee)}
        ${
          t.modality === 'rebuy'
            ? `${field('Valor recompra', 'config.rebuyCost', c.rebuyCost)}${field('Fichas por recompra', 'config.rebuyChips', c.rebuyChips)}${field('Valor add on', 'config.addonCost', c.addonCost)}${field('Fichas add on', 'config.addonChips', c.addonChips)}${field('Recompra hasta el nivel', 'config.rebuyUntilLevel', c.rebuyUntilLevel)}${field('Máx. recompras por jugador', 'config.rebuyMaxPerPlayer', c.rebuyMaxPerPlayer, { hint: '0 = sin límite' })}${field('Máx. recompras en total', 'config.rebuyMaxTotal', c.rebuyMaxTotal, { hint: '0 = sin límite' })}`
            : `${field('Permitir lucky loser', 'config.luckyLoserAllowed', c.luckyLoserAllowed, { input: 'checkbox' })}${field('Valor lucky loser', 'config.luckyLoserCost', c.luckyLoserCost)}${field('Lucky loser hasta el nivel', 'config.luckyLoserUntilLevel', c.luckyLoserUntilLevel, { hint: '0 = sin límite' })}`
        }
        ${field('% premios por lugar', 'prizePercents', t.prizePercents || c.prizePercents, { type: 'list', input: 'text', hint: 'Ej: 50, 30, 20' })}
        ${field('Redondear premios a', 'config.roundTo', c.roundTo)}
      </div>
      <h4>Estructura de ciegas de esta fecha</h4><p class="muted small">${LEVELS_HELP}</p>
      <textarea data-levels rows="6" class="mono">${esc(levelsToText(c.levels))}</textarea>
    </div>
    <div class="panel"><h3>Proyección</h3>
      <div class="stats-row"><div><b>${tot.n}</b><span>jugadores</span></div><div><b>${money(tot.pool, c.currency)}</b><span>pozo de premios</span></div><div><b>${money(tot.fees, c.currency)}</b><span>fees</span></div><div><b>${tot.chips.toLocaleString('es-CL')}</b><span>fichas</span></div><div><b>${Math.ceil(tot.n / (c.perTable || 9)) || 0}</b><span>mesas</span></div></div>
      <ol class="prizes">${pz.map((p, i) => `<li>${money(p, c.currency)} <small class="muted">(${(t.prizePercents || c.prizePercents)[i]}%)</small></li>`).join('')}</ol>
      ${locked ? '' : `<button class="btn" data-totables ${tot.n < 2 ? 'disabled' : ''}>Siguiente: armar mesas →</button>`}
    </div>`,
    bind(root) {
      bindFields(root, (db) => db.tournaments.find((x) => x.id === t.id));
      root.querySelector('[data-levels]').onchange = (e) => upT(t.id, (x) => (x.config.levels = textToLevels(e.target.value)));
      const fmt = root.querySelector('[data-format]');
      if (fmt && !locked)
        fmt.onchange = () => {
          upT(t.id, (x, db) => applyFormat(x, db, fmt.value), false);
        };
      if (locked) return;
      on(root, '[data-entry]', 'change', (el) =>
        upT(t.id, (x) => {
          x.tables = [];
          if (el.checked) x.entries.push({ playerId: el.dataset.entry, rebuys: 0, addon: false, luckyLoser: false });
          else x.entries = x.entries.filter((e) => e.playerId !== el.dataset.entry);
        })
      );
      root.querySelector('[data-all]').onclick = () =>
        upT(t.id, (x, db) => {
          const have = new Set(x.entries.map((e) => e.playerId));
          db.players.filter((p) => p.type !== 'invitado' && p.active !== false && !have.has(p.id)).forEach((p) => x.entries.push({ playerId: p.id, rebuys: 0, addon: false, luckyLoser: false }));
          x.tables = [];
        });
      root.querySelector('[data-none]').onclick = () => upT(t.id, (x) => ((x.entries = []), (x.tables = [])));
      root.querySelector('[data-guest]').onclick = async () => {
        const pid = await editPlayer(null, { type: 'invitado' });
        if (pid) upT(t.id, (x) => x.entries.push({ playerId: pid, rebuys: 0, addon: false, luckyLoser: false }));
      };
      const nx = root.querySelector('[data-totables]');
      if (nx)
        nx.onclick = () => {
          tabState[t.id] = 'mesas';
          refresh();
        };
    },
  };
}

// --- Mesas
function tablesTab(t) {
  const c = t.config;
  const n = (t.entries || []).length;
  const nTables = Math.max(1, Math.ceil(n / (c.perTable || 9)));
  const dealers = t.tableDealers || [];
  const allPlayers = S.db.players.filter((p) => p.active !== false).map((p) => p.id);
  const dealerSel = (i) => {
    const d = dealers[i];
    const val = d ? (d.playerId ? d.playerId : '__ext') : '';
    return `<div class="dealer-row"><span>Mesa ${i + 1}</span><select data-dealer="${i}"><option value="">Sin crupier (rotativo)</option>${allPlayers
      .map((id) => `<option value="${id}" ${val === id ? 'selected' : ''}>${esc(pname(id))}${(t.entries || []).some((e) => e.playerId === id) ? ' (juega)' : ''}${(t.dealerIds || []).includes(id) ? ' ★' : ''}</option>`)
      .join('')}<option value="__ext" ${val === '__ext' ? 'selected' : ''}>Otra persona…</option></select>${val === '__ext' ? `<input data-dealername="${i}" value="${esc(d.name || '')}" placeholder="Nombre">` : ''}</div>`;
  };
  return {
    html: `
    <div class="panel"><h3>Crupieres</h3><p class="muted small">${n} jugadores · ${nTables} mesa(s) de hasta ${c.perTable}. Si el crupier también juega, se sienta en la mesa que reparte. ★ = dealer asignado en el calendario.</p>
      ${Array.from({ length: nTables }, (_, i) => dealerSel(i)).join('')}
      <div class="row mt"><button class="btn" data-build>${t.tables && t.tables.length ? 'Volver a sortear mesas' : 'Sortear mesas'}</button></div>
    </div>
    ${
      t.tables && t.tables.length
        ? `<div class="panel"><h3>Mesas sorteadas</h3><div class="tables">${t.tables
            .map(
              (tb) => `<div class="felt"><h4>Mesa ${tb.number}${tb.dealer ? ` <small>Dealer: ${esc(tb.dealer.playerId ? pname(tb.dealer.playerId) : tb.dealer.name)}</small>` : ''}</h4>
            <ol>${tb.seats.map((p) => `<li>${esc(pname(p))}${isTableDealer(tb, p) ? ' <span class="pill dealer">Dealer</span>' : ''} ${moveSelect(t, p, tb.id)}</li>`).join('')}</ol></div>`
            )
            .join('')}</div>
            <div class="row mt"><button class="btn big" data-start>Iniciar torneo ▶</button></div></div>`
        : ''
    }`,
    bind(root) {
      on(root, '[data-dealer]', 'change', (el) =>
        upT(t.id, (x) => {
          x.tableDealers = x.tableDealers || [];
          const i = Number(el.dataset.dealer);
          x.tableDealers[i] = el.value === '' ? null : el.value === '__ext' ? { name: '' } : { playerId: el.value };
          if (x.tables && x.tables[i]) {
            x.tables[i].dealer = x.tableDealers[i];
            x.tables = dealersToSeatOne(x.tables);
          }
        })
      );
      on(root, '[data-dealername]', 'change', (el) =>
        upT(t.id, (x) => {
          const i = Number(el.dataset.dealername);
          x.tableDealers[i] = { name: el.value };
          if (x.tables && x.tables[i]) x.tables[i].dealer = x.tableDealers[i];
        })
      );
      root.querySelector('[data-build]').onclick = () =>
        upT(t.id, (x) => {
          const ids = x.entries.map((e) => e.playerId);
          x.tables = buildTables(ids, x.config.perTable, (x.tableDealers || []).slice(0, Math.ceil(ids.length / x.config.perTable)));
        }, false);
      bindMoveSelects(root, t);
      const st = root.querySelector('[data-start]');
      if (st)
        st.onclick = async () => {
          if (!(await confirmDlg(`¿Iniciar ${t.label} con ${n} jugadores?`, 'Iniciar'))) return;
          upT(t.id, (x) => {
            x.status = 'running';
            x.startedAt = Date.now();
            x.initialTables = x.tables.length;
            x.clock = { level: 0, running: false, remaining: x.config.levels[0].minutes * 60000 };
            tabState[x.id] = 'vivo';
          }, false);
        };
    },
  };
}

function moveSelect(t, pid, fromId) {
  if ((t.tables || []).length < 2) return '';
  if (isTableDealer(t.tables.find((tb) => tb.id === fromId), pid)) return '<span class="muted small" title="El dealer no se mueve de su mesa">🔒</span>';
  return `<select class="mv" data-move="${pid}" data-from="${fromId}" title="Mover a otra mesa"><option value="">⇄</option>${t.tables
    .filter((tb) => tb.id !== fromId)
    .map((tb) => `<option value="${tb.id}">Mesa ${tb.number}</option>`)
    .join('')}</select>`;
}
function bindMoveSelects(root, t) {
  on(root, '[data-move]', 'change', (el) => {
    if (!el.value) return;
    upT(t.id, (x) => {
      x.tables = applyMoves(x.tables, [{ playerId: el.dataset.move, from: el.dataset.from, to: el.value }]);
    }, false);
  });
}

// --- En vivo
let beepCtx;
function beep() {
  try {
    beepCtx = beepCtx || new AudioContext();
    [0, 0.25, 0.5].forEach((d) => {
      const o = beepCtx.createOscillator();
      const g = beepCtx.createGain();
      o.connect(g);
      g.connect(beepCtx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.2;
      o.start(beepCtx.currentTime + d);
      o.stop(beepCtx.currentTime + d + 0.15);
    });
  } catch {}
}

function liveTab(t) {
  const c = t.config;
  const st = entryState(t);
  const alive = st.filter((e) => !e.eliminated);
  const aliveIds = alive.map((e) => e.playerId);
  const byId = Object.fromEntries(st.map((e) => [e.playerId, e]));
  const tot = totals(t, c);
  const pz = prizes(tot.pool, t.prizePercents || c.prizePercents, c.roundTo);
  const cs = clockState(t);
  const rebuyOpen = rebuyOpenAt(c, t.modality, cs.level);
  const running = t.status === 'running';
  const finalDue = running && needsFinalTable(t, aliveIds.length);
  const bal = running && !finalDue ? balanceSuggestions(t.tables, aliveIds, c.perTable) : { moves: [] };
  // crupier sugerido para la mesa final: el de la mesa 1 si sigue jugando, si no otro dealer en juego, si no el de la mesa 1
  const dealersNow = (t.tables || []).map((tb) => tb.dealer).filter(Boolean);
  const suggested = dealersNow.find((d) => d.playerId && aliveIds.includes(d.playerId)) || dealersNow[0] || null;
  const finalDealerVal = suggested ? (suggested.playerId || '__ext:' + (suggested.name || '')) : '';
  const n = st.length;
  const evs = busts(t);
  let outIdx = 0;

  const playerRow = (pid, tbId) => {
    const e = byId[pid];
    if (!e || e.eliminated) return '';
    const tb = t.tables.find((x) => x.id === tbId);
    const seat = tb.seats.indexOf(pid) + 1;
    return `<li class="prow">
      <span class="pn"><span class="seat">${seat}</span>${esc(pname(pid))}${isTableDealer(tb, pid) ? ' <span class="pill dealer">Dealer</span>' : ''}${e.rebuys ? ` <span class="pill">R${e.rebuys}</span>` : ''}${e.addon ? ' <span class="pill add">A</span>' : ''}${e.luckyLoser ? ' <span class="pill ll">LL</span>' : ''}</span>
      ${
        running
          ? `<span class="pa">
        ${t.modality === 'rebuy' ? `<button class="btn xs ${rebuyOpen ? '' : 'ghost'}" data-rebuy="${pid}" title="Recompra">+R</button>${e.rebuys ? `<button class="btn xs ghost" data-unrebuy="${pid}" title="Quitar recompra">−R</button>` : ''}<button class="btn xs ${e.addon ? 'on' : 'ghost'}" data-addon="${pid}" title="Add on">A</button>` : ''}
        <button class="btn xs danger" data-bust="${pid}">Eliminar</button>${moveSelect(t, pid, tbId)}</span>`
          : ''
      }
    </li>`;
  };

  const html = `
  <div class="grid2">
    <div class="panel center">${clockHtml(t)}
      ${
        running
          ? `<div class="row center mt"><button class="btn sm ghost" data-clk="prev">◀ Nivel</button><button class="btn" data-clk="toggle">${cs.running ? '❚❚ Pausa' : '▶ Iniciar reloj'}</button><button class="btn sm ghost" data-clk="next">Nivel ▶</button></div>
      <div class="row center"><button class="btn xs ghost" data-clk="reset">Reiniciar nivel</button><button class="btn xs ghost" data-clk="min">−1 min</button><button class="btn xs ghost" data-clk="plus">+1 min</button></div>`
          : ''
      }
    </div>
    <div class="panel">
      <div class="stats-row">
        <div><b>${tot.alive}</b><span>de ${tot.n} vivos</span></div>
        <div><b>${money(tot.pool, c.currency)}</b><span>pozo</span></div>
        <div><b>${money(tot.fees, c.currency)}</b><span>fees</span></div>
        <div><b>${tot.avgStack.toLocaleString('es-CL')}</b><span>stack prom.</span></div>
        ${t.modality === 'rebuy' ? `<div><b>${tot.rebuys}</b><span>recompras</span></div><div><b>${tot.addons}</b><span>add on</span></div>` : `<div><b>${tot.lucky}</b><span>lucky loser</span></div>`}
      </div>
      <ol class="prizes">${pz.map((p) => `<li>${money(p, c.currency)}</li>`).join('')}</ol>
      ${
        running
          ? `<div class="row wrap"><button class="btn sm ghost" data-jackpot>🎰 Registrar jackpot</button><button class="btn sm ghost" data-late>+ Inscribir jugador</button><button class="btn sm ghost" data-bonus>+ Punto extra</button>
        ${alive.length === 1 ? '<button class="btn big gold" data-finish>🏆 Finalizar torneo</button>' : ''}</div>`
          : ''
      }
      ${
        (t.jackpots || []).length
          ? `<div class="mt">${t.jackpots.map((j, i) => `<div class="jackpot">🎰 <b>${esc(pname(j.playerId))}</b> ${esc(j.hand || '')} ${cardsHtml(j.cards, true)} ${money(j.amount, c.currency)} <button class="btn xs ghost" data-editjp="${i}">Editar</button></div>`).join('')}</div>`
          : ''
      }
      ${(t.bonus || []).length ? `<div class="mt small">${t.bonus.map((b, i) => `<div>+${b.points} pto(s) a <b>${esc(pname(b.playerId))}</b> ${esc(b.reason || '')} <button class="link" data-rmbonus="${i}">quitar</button></div>`).join('')}</div>` : ''}
    </div>
  </div>
  ${
    finalDue
      ? `<div class="panel warn final-panel"><h3>🏆 ¡Mesa final! Quedan ${aliveIds.length} jugadores</h3>
      <p>Se sortean de nuevo todos los puestos entre los finalistas. Si el dealer de la mesa final está jugando, queda en el puesto 1.</p>
      <div class="row wrap"><label class="fld inline"><span>Dealer de la mesa final</span><select data-finaldealer>
        <option value="">Sin crupier (rotativo)</option>
        ${aliveIds.map((id) => `<option value="${id}" ${finalDealerVal === id ? 'selected' : ''}>${esc(pname(id))}${dealersNow.some((d) => d.playerId === id) ? ' ★' : ''}</option>`).join('')}
        ${dealersNow.filter((d) => !d.playerId || !aliveIds.includes(d.playerId)).map((d) => { const v = d.playerId || '__ext:' + (d.name || ''); return `<option value="${esc(v)}" ${finalDealerVal === v ? 'selected' : ''}>${esc(d.playerId ? pname(d.playerId) : d.name)} (no juega) ★</option>`; }).join('')}
      </select></label>
      <button class="btn gold" data-drawfinal>🎲 Sortear mesa final</button></div>
      <p class="muted small">★ = dealer de alguna mesa actual.</p></div>`
      : ''
  }
  ${
    bal.moves.length
      ? `<div class="panel warn"><h3>⚖️ Balancear mesas</h3>${bal.breakTable ? `<p>Se puede romper la <b>Mesa ${t.tables.find((x) => x.id === bal.breakTable).number}</b>:</p>` : ''}
      <ul>${bal.moves.map((m) => `<li>Mover a <b>${esc(pname(m.playerId))}</b> de Mesa ${t.tables.find((x) => x.id === m.from).number} → Mesa ${t.tables.find((x) => x.id === m.to).number}</li>`).join('')}</ul>
      <button class="btn" data-balance>Aplicar movimientos</button> <span class="muted small">o muévelos a mano con ⇄</span></div>`
      : ''
  }
  ${
    running && alive.length > 1
      ? `<div class="panel"><h3>Mesas</h3><div class="tables">${(t.tables || [])
          .map((tb) => {
            const ps = tb.seats.filter((p) => aliveIds.includes(p));
            return `<div class="felt ${tb.final ? 'final' : ''}"><h4>${tableName(tb)} <span class="pill">${ps.length}</span>${tb.dealer ? ` <small>Dealer: ${esc(tb.dealer.playerId ? pname(tb.dealer.playerId) : tb.dealer.name)}</small>` : ''}</h4><ul>${ps.map((p) => playerRow(p, tb.id)).join('')}</ul></div>`;
          })
          .join('')}</div></div>`
      : ''
  }
  <div class="panel"><h3>Registro de la fecha</h3>${
    evs.length
      ? `<ol class="busts log">${evs
          .map((e) => {
            const pos = e.outcome === 'out' ? n - outIdx++ : null;
            const label = e.outcome === 'out' ? `<b>${pos}°</b>` : e.outcome === 'rebuy' ? '<span class="pill">Recompra</span>' : '<span class="pill ll">Lucky loser</span>';
            return `<li>${label} ${esc(pname(e.playerId))} ${e.byPlayerId ? `<span class="muted">por</span> ${esc(pname(e.byPlayerId))}` : ''} ${e.playerCards && e.playerCards.length ? cardsHtml(e.playerCards, true) : ''} ${e.byCards && e.byCards.length ? 'vs ' + cardsHtml(e.byCards, true) : ''} ${e.board && e.board.length ? '· ' + cardsHtml(e.board, true) : ''} ${e.image ? '📷' : ''}
            <button class="btn xs ghost" data-editev="${e.id}">Editar</button>${running ? `<button class="btn xs ghost danger" data-delev="${e.id}">Deshacer</button>` : ''}</li>`;
          })
          .reverse()
          .join('')}</ol>`
      : '<p class="muted">Sin eliminaciones registradas.</p>'
  }</div>`;

  return {
    html,
    tick(root) {
      const el = root.querySelector('[data-time]');
      if (!el) return;
      const now = clockState(S.db.tournaments.find((x) => x.id === t.id));
      el.textContent = fmt(now.remaining);
      if (running && now.running && now.remaining <= 0 && !S.saving) {
        beep();
        clockAction(t.id, 'next');
      }
    },
    bind(root) {
      on(root, '[data-clk]', 'click', (b) => clockAction(t.id, b.dataset.clk));
      on(root, '[data-rebuy]', 'click', async (b) => {
        if (!(await rebuyAllowed(t, b.dataset.rebuy, rebuyOpen))) return;
        upT(t.id, (x) => {
          const e = x.entries.find((y) => y.playerId === b.dataset.rebuy);
          e.rebuys = (e.rebuys || 0) + 1;
        });
        toast(`Recompra para ${pname(b.dataset.rebuy)}`);
      });
      on(root, '[data-unrebuy]', 'click', (b) =>
        upT(t.id, (x) => {
          const e = x.entries.find((y) => y.playerId === b.dataset.unrebuy);
          e.rebuys = Math.max(0, (e.rebuys || 0) - 1);
          const rb = [...x.events].reverse().find((ev) => ev.type === 'bust' && ev.outcome === 'rebuy' && ev.playerId === b.dataset.unrebuy);
          if (rb) x.events = x.events.filter((ev) => ev !== rb);
        })
      );
      on(root, '[data-addon]', 'click', (b) =>
        upT(t.id, (x) => {
          const e = x.entries.find((y) => y.playerId === b.dataset.addon);
          e.addon = !e.addon;
        })
      );
      on(root, '[data-bust]', 'click', (b) => bustDialog(t.id, b.dataset.bust));
      on(root, '[data-editev]', 'click', (b) => bustDialog(t.id, null, b.dataset.editev));
      on(root, '[data-delev]', 'click', async (b) => {
        const ev = t.events.find((e) => e.id === b.dataset.delev);
        if (!(await confirmDlg(`¿Deshacer el registro de ${pname(ev.playerId)}?`, 'Deshacer'))) return;
        upT(t.id, (x) => {
          x.events = x.events.filter((e) => e.id !== ev.id);
          const en = x.entries.find((e) => e.playerId === ev.playerId);
          if (ev.outcome === 'rebuy') en.rebuys = Math.max(0, (en.rebuys || 0) - 1);
          if (ev.outcome === 'luckyloser') en.luckyLoser = false;
        }, false);
      });
      const fd = root.querySelector('[data-drawfinal]');
      if (fd)
        fd.onclick = async () => {
          const v = root.querySelector('[data-finaldealer]').value;
          const dealer = !v ? null : v.startsWith('__ext:') ? { name: v.slice(6) } : { playerId: v };
          if (!(await confirmDlg(`¿Sortear la mesa final entre los ${aliveIds.length} jugadores?`, 'Sortear'))) return;
          upT(t.id, (x) => {
            const alive = alivePlayers(x).map((e) => e.playerId);
            x.tables = drawFinalTable(alive, dealer);
            x.finalTableDrawn = true;
          }, false);
        };
      const balB = root.querySelector('[data-balance]');
      if (balB) balB.onclick = () => upT(t.id, (x) => (x.tables = applyMoves(x.tables, bal.moves, bal.breakTable)), false);
      bindMoveSelects(root, t);
      const jp = root.querySelector('[data-jackpot]');
      if (jp) jp.onclick = () => jackpotDialog(t.id);
      on(root, '[data-editjp]', 'click', (b) => jackpotDialog(t.id, Number(b.dataset.editjp)));
      const late = root.querySelector('[data-late]');
      if (late) late.onclick = () => lateEntry(t.id);
      const bon = root.querySelector('[data-bonus]');
      if (bon) bon.onclick = () => bonusDialog(t.id);
      on(root, '[data-rmbonus]', 'click', (b) => upT(t.id, (x) => x.bonus.splice(Number(b.dataset.rmbonus), 1)));
      const fin = root.querySelector('[data-finish]');
      if (fin) fin.onclick = () => finishDialog(t.id);
    },
  };
}

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function clockAction(id, act) {
  return upT(id, (x) => {
    const c = x.clock || { level: 0, running: false };
    const lv = (i) => x.config.levels[i] || x.config.levels[x.config.levels.length - 1];
    const rem = c.running && c.endsAt ? Math.max(0, c.endsAt - Date.now()) : c.remaining ?? lv(c.level).minutes * 60000;
    let level = c.level;
    let remaining = rem;
    let running = c.running;
    const last = x.config.levels.length - 1;
    if (act === 'toggle') running = !running;
    if (act === 'next') {
      if (level < last) {
        level++;
        remaining = lv(level).minutes * 60000;
      } else {
        running = false;
        remaining = 0;
      }
    }
    if (act === 'prev' && level > 0) {
      level--;
      remaining = lv(level).minutes * 60000;
    }
    if (act === 'reset') remaining = lv(level).minutes * 60000;
    if (act === 'plus') remaining += 60000;
    if (act === 'min') remaining = Math.max(0, remaining - 60000);
    x.clock = { level, running, remaining, endsAt: running ? Date.now() + remaining : null };
  });
}

// Revisa periodo y límites de recompra; pide confirmación si se pasa de alguno
async function rebuyAllowed(t, pid, open) {
  const c = t.config;
  const e = t.entries.find((y) => y.playerId === pid);
  const total = t.entries.reduce((s, y) => s + (y.rebuys || 0), 0);
  const issues = [];
  if (!open) issues.push('el periodo de recompra terminó');
  if (c.rebuyMaxPerPlayer && (e.rebuys || 0) >= c.rebuyMaxPerPlayer) issues.push(`${pname(pid)} ya tiene ${e.rebuys} recompras (máximo ${c.rebuyMaxPerPlayer})`);
  if (c.rebuyMaxTotal && total >= c.rebuyMaxTotal) issues.push(`ya van ${total} recompras en total (máximo ${c.rebuyMaxTotal})`);
  if (!issues.length) return true;
  return confirmDlg(`Ojo: ${issues.join(' y ')}. ¿Registrar la recompra igual?`, 'Registrar igual');
}

// Diálogo de eliminación (nuevo o edición)
async function bustDialog(tid, playerId, editId = null) {
  const t = S.db.tournaments.find((x) => x.id === tid);
  const c = t.config;
  const ev = editId ? structuredClone(t.events.find((e) => e.id === editId)) : { id: uid('e'), type: 'bust', playerId, byPlayerId: '', playerCards: [], byCards: [], board: [], street: '', allInPlayerId: playerId, notes: '', image: null };
  const st = entryState(t);
  const entry = st.find((e) => e.playerId === ev.playerId);
  const others = st.filter((e) => e.playerId !== ev.playerId && (!e.eliminated || e.playerId === ev.byPlayerId)).map((e) => e.playerId);
  const cs = clockState(t);
  const rebuyOpen = rebuyOpenAt(c, t.modality, cs.level);
  const llOpen = luckyLoserOpenAt(c, t.modality, cs.level);
  const canLL = t.modality === 'freezeout' && c.luckyLoserAllowed && !entry.luckyLoser;
  if (!editId) ev.outcome = rebuyOpen ? 'rebuy' : 'out';
  const lastBoard = [...busts(t)].reverse().find((e) => e.board && e.board.length);

  const outcomeHtml = editId
    ? ''
    : `<div class="fld"><span>¿Qué pasa con ${esc(pname(ev.playerId))}?</span><div class="seg">
      ${t.modality === 'rebuy' ? `<label><input type="radio" name="outcome" value="rebuy" ${ev.outcome === 'rebuy' ? 'checked' : ''}> Recompra (sigue jugando)${rebuyOpen ? '' : ' <small class="muted">— periodo cerrado</small>'}</label>` : ''}
      ${canLL ? `<label><input type="radio" name="outcome" value="luckyloser"> Entra como lucky loser (${money(c.luckyLoserCost, c.currency)})${llOpen ? '' : ` <small class="muted">— solo se permite hasta el nivel ${c.luckyLoserUntilLevel}</small>`}</label>` : ''}
      <label><input type="radio" name="outcome" value="out" ${ev.outcome === 'out' ? 'checked' : ''}> Eliminado definitivo (lugar ${st.filter((e) => !e.eliminated).length})</label>
    </div></div>`;

  await modal(
    `<h3>${editId ? 'Editar registro' : 'Eliminación'} — ${esc(pname(ev.playerId))}</h3>
    ${outcomeHtml}
    <div class="form-grid">
      <label class="fld"><span>Eliminado por</span><select name="by">${playerOptions(others, ev.byPlayerId, '— Sin registrar —')}</select></label>
      <label class="fld"><span>¿En qué instancia fue el all in?</span><select name="street"><option value="">—</option>${STREETS.map((s) => `<option value="${s.id}" ${ev.street === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      <label class="fld"><span>¿Quién fue all in?</span><select name="allin"></select></label>
    </div>
    <div class="cards-edit">
      <div><span class="lbl">Cartas de ${esc(pname(ev.playerId))}</span><button type="button" class="cardbox" data-pick="playerCards"></button></div>
      <div><span class="lbl">Cartas del que elimina</span><button type="button" class="cardbox" data-pick="byCards"></button></div>
      <div class="wide"><span class="lbl">Cartas en la mesa (board)</span><button type="button" class="cardbox" data-pick="board"></button>${lastBoard && !editId ? '<button type="button" class="link small" data-sameboard>usar el board de la mano anterior</button>' : ''}</div>
    </div>
    <label class="fld"><span>Comentario para el resumen (opcional)</span><textarea name="notes" rows="2" placeholder="Ej: a estas alturas Joan era el hitman absoluto de esa mesa">${esc(ev.notes || '')}</textarea></label>
    <div class="fld"><span>Foto de la mano</span><div data-imgprev></div><button type="button" class="btn sm ghost" data-img>📷 Subir foto</button></div>
    <div class="row end mt"><button class="btn ghost" data-cancel>Cancelar</button><button class="btn" data-save>Guardar</button></div>`,
    {
      wide: true,
      onMount: (m, close) => {
        const used = () => [...ev.playerCards, ...ev.byCards, ...ev.board];
        const drawCards = () =>
          m.querySelectorAll('[data-pick]').forEach((b) => {
            b.innerHTML = ev[b.dataset.pick].length ? cardsHtml(ev[b.dataset.pick]) : '<span class="muted">Elegir cartas</span>';
          });
        const drawAllin = () => {
          const by = m.querySelector('[name=by]').value;
          const sel = m.querySelector('[name=allin]');
          const ids = [ev.playerId, by].filter(Boolean);
          sel.innerHTML = ids.map((id) => `<option value="${id}" ${ev.allInPlayerId === id ? 'selected' : ''}>${esc(pname(id))}</option>`).join('');
        };
        const drawImg = () => (m.querySelector('[data-imgprev]').innerHTML = ev.image ? imgHtml(ev.image, 'small') : '');
        drawCards();
        drawAllin();
        drawImg();
        m.querySelector('[name=by]').onchange = drawAllin;
        m.querySelectorAll('[data-pick]').forEach(
          (b) =>
            (b.onclick = async () => {
              const k = b.dataset.pick;
              const res = await pickCards({ title: b.previousElementSibling.textContent, max: k === 'board' ? 5 : 2, selected: ev[k], disabled: used() });
              if (res) {
                ev[k] = res;
                drawCards();
              }
            })
        );
        const sb = m.querySelector('[data-sameboard]');
        if (sb)
          sb.onclick = () => {
            ev.board = [...lastBoard.board];
            ev.street = ev.street || lastBoard.street;
            m.querySelector('[name=street]').value = ev.street || '';
            drawCards();
          };
        m.querySelector('[data-img]').onclick = async () => {
          const img = await pickImage();
          if (img) {
            ev.image = img;
            drawImg();
          }
        };
        m.querySelector('[data-cancel]').onclick = () => close(null);
        m.querySelector('[data-save]').onclick = async () => {
          ev.byPlayerId = m.querySelector('[name=by]').value || null;
          ev.street = m.querySelector('[name=street]').value;
          ev.allInPlayerId = m.querySelector('[name=allin]').value || ev.playerId;
          ev.notes = m.querySelector('[name=notes]').value;
          if (!editId) {
            const o = m.querySelector('[name=outcome]:checked');
            ev.outcome = o ? o.value : 'out';
            if (ev.outcome === 'rebuy' && !(await rebuyAllowed(t, ev.playerId, rebuyOpen))) return;
            if (ev.outcome === 'luckyloser' && !llOpen && !(await confirmDlg(`El lucky loser se permite solo hasta el nivel ${c.luckyLoserUntilLevel}. ¿Registrarlo igual?`, 'Registrar igual'))) return;
            ev.level = clockState(t).round;
            ev.ts = Date.now();
          }
          close(true);
          await upT(
            tid,
            (x) => {
              if (editId) {
                const i = x.events.findIndex((e) => e.id === editId);
                x.events[i] = ev;
                return;
              }
              x.events.push(ev);
              const en = x.entries.find((e) => e.playerId === ev.playerId);
              if (ev.outcome === 'rebuy') en.rebuys = (en.rebuys || 0) + 1;
              if (ev.outcome === 'luckyloser') en.luckyLoser = true;
            },
            false
          );
          if (!editId && ev.outcome === 'out') {
            const nt = S.db.tournaments.find((x) => x.id === tid);
            const alive = alivePlayers(nt);
            if (alive.length === 1) toast(`¡Queda solo ${pname(alive[0].playerId)}! Ya puedes finalizar el torneo.`);
            else {
              if (needsFinalTable(nt, alive.length)) toast(`¡Mesa final! Quedan ${alive.length}: sortea los puestos.`, 'warn');
              else if (balanceSuggestions(nt.tables, alive.map((e) => e.playerId), nt.config.perTable).moves.length) toast('Hay que balancear mesas: revisa la sugerencia.', 'warn');
            }
          }
        };
      },
    }
  );
}

async function jackpotDialog(tid, idx = null) {
  const t = S.db.tournaments.find((x) => x.id === tid);
  const j = idx != null ? structuredClone(t.jackpots[idx]) : { playerId: '', loserId: '', hand: '', cards: [], amount: 0, image: null };
  const ids = t.entries.map((e) => e.playerId);
  await modal(
    `<h3>🎰 Jackpot</h3>
    <div class="form-grid">
      <label class="fld"><span>Jugador del jackpot</span><select name="p">${playerOptions(ids, j.playerId, '— Elegir —')}</select></label>
      <label class="fld"><span>Contra (opcional)</span><select name="l">${playerOptions(ids, j.loserId)}</select></label>
      <label class="fld"><span>Mano</span><input name="hand" value="${esc(j.hand)}" placeholder="Ej: póker de 3"></label>
      <label class="fld"><span>Monto</span><input name="amount" type="number" value="${j.amount || ''}"></label>
    </div>
    <div class="fld"><span>Cartas de la mano</span><button type="button" class="cardbox" data-pick></button></div>
    <div class="fld"><span>Foto de la mano</span><div data-imgprev></div><button type="button" class="btn sm ghost" data-img>📷 Subir foto</button></div>
    <div class="row between mt">${idx != null ? '<button class="btn ghost danger" data-del>Eliminar</button>' : '<span></span>'}<button class="btn" data-save>Guardar</button></div>`,
    {
      onMount: (m, close) => {
        const draw = () => {
          m.querySelector('[data-pick]').innerHTML = j.cards.length ? cardsHtml(j.cards) : '<span class="muted">Elegir cartas</span>';
          m.querySelector('[data-imgprev]').innerHTML = j.image ? imgHtml(j.image, 'small') : '';
        };
        draw();
        m.querySelector('[data-pick]').onclick = async () => {
          const r = await pickCards({ title: 'Cartas del jackpot', max: 7, selected: j.cards });
          if (r) (j.cards = r), draw();
        };
        m.querySelector('[data-img]').onclick = async () => {
          const img = await pickImage();
          if (img) (j.image = img), draw();
        };
        const del = m.querySelector('[data-del]');
        if (del)
          del.onclick = () => {
            close(true);
            upT(tid, (x) => x.jackpots.splice(idx, 1), false);
          };
        m.querySelector('[data-save]').onclick = () => {
          j.playerId = m.querySelector('[name=p]').value;
          j.loserId = m.querySelector('[name=l]').value;
          j.hand = m.querySelector('[name=hand]').value;
          j.amount = Number(m.querySelector('[name=amount]').value) || 0;
          if (!j.playerId) return toast('Elige el jugador del jackpot', 'error');
          close(true);
          upT(tid, (x) => {
            x.jackpots = x.jackpots || [];
            if (idx != null) x.jackpots[idx] = j;
            else x.jackpots.push(j);
          }, false);
        };
      },
    }
  );
}

async function lateEntry(tid) {
  const t = S.db.tournaments.find((x) => x.id === tid);
  const inT = new Set(t.entries.map((e) => e.playerId));
  const ids = S.db.players.filter((p) => !inT.has(p.id) && p.active !== false).map((p) => p.id);
  const pid = await modal(
    `<h3>Inscribir jugador</h3><label class="fld"><span>Jugador</span><select name="p">${playerOptions(ids, '', '— Elegir —')}</select></label>
    <div class="row between"><button class="btn ghost" data-new>+ Invitado nuevo</button><button class="btn" data-ok>Inscribir</button></div>`,
    {
      onMount: (m, close) => {
        m.querySelector('[data-ok]').onclick = () => close(m.querySelector('[name=p]').value || null);
        m.querySelector('[data-new]').onclick = async () => close(await editPlayer(null, { type: 'invitado' }));
      },
    }
  );
  if (!pid) return;
  upT(tid, (x) => {
    x.entries.push({ playerId: pid, rebuys: 0, addon: false, luckyLoser: false });
    const alive = new Set(alivePlayers(x).map((e) => e.playerId));
    const target = [...x.tables].sort((a, b) => a.seats.filter((p) => alive.has(p)).length - b.seats.filter((p) => alive.has(p)).length)[0];
    if (target) target.seats.push(pid);
  }, false);
}

async function bonusDialog(tid) {
  const t = S.db.tournaments.find((x) => x.id === tid);
  const res = await modal(
    `<h3>Punto extra para el ranking</h3><form data-bf>
    <label class="fld"><span>Jugador</span><select name="p" required>${playerOptions(t.entries.map((e) => e.playerId), '', '— Elegir —')}</select></label>
    <label class="fld"><span>Puntos</span><input name="pts" type="number" value="1"></label>
    <label class="fld"><span>Motivo</span><input name="reason" placeholder="Ej: eliminó al primero de la mesa final"></label>
    <button class="btn">Agregar</button></form>`,
    {
      onMount: (m, close) =>
        (m.querySelector('[data-bf]').onsubmit = (e) => {
          e.preventDefault();
          if (!e.target.p.value) return;
          close({ playerId: e.target.p.value, points: Number(e.target.pts.value) || 0, reason: e.target.reason.value });
        }),
    }
  );
  if (res) upT(tid, (x) => (x.bonus = [...(x.bonus || []), res]), false);
}

async function finishDialog(tid) {
  const t = S.db.tournaments.find((x) => x.id === tid);
  const winner = alivePlayers(t)[0];
  const data = { image: t.winnerImage || null, cards: t.winnerCards || [] };
  await modal(
    `<h3>🏆 Finalizar ${esc(t.label)}</h3>
    <p>Ganador: <b>${esc(pname(winner.playerId))}</b></p>
    <div class="fld"><span>Mano ganadora (opcional)</span><button type="button" class="cardbox" data-pick></button></div>
    <div class="fld"><span>Foto del ganador con la mano final</span><div data-imgprev></div><button type="button" class="btn sm ghost" data-img>📷 Subir foto</button></div>
    <p class="muted small">¿Hubo jackpot? Regístralo antes de finalizar con el botón 🎰 (también puedes hacerlo después).</p>
    <div class="row end mt"><button class="btn ghost" data-cancel>Cancelar</button><button class="btn gold" data-ok>Finalizar torneo</button></div>`,
    {
      onMount: (m, close) => {
        const draw = () => {
          m.querySelector('[data-pick]').innerHTML = data.cards.length ? cardsHtml(data.cards) : '<span class="muted">Elegir cartas</span>';
          m.querySelector('[data-imgprev]').innerHTML = data.image ? imgHtml(data.image, 'small') : '';
        };
        draw();
        m.querySelector('[data-pick]').onclick = async () => {
          const r = await pickCards({ title: 'Mano ganadora', max: 2, selected: data.cards });
          if (r) (data.cards = r), draw();
        };
        m.querySelector('[data-img]').onclick = async () => {
          const img = await pickImage();
          if (img) (data.image = img), draw();
        };
        m.querySelector('[data-cancel]').onclick = () => close(null);
        m.querySelector('[data-ok]').onclick = () => {
          close(true);
          upT(tid, (x) => {
            x.status = 'finished';
            x.finishedAt = Date.now();
            x.winnerImage = data.image;
            x.winnerCards = data.cards;
            if (x.clock) x.clock.running = false;
            if (x.finalDate == null) x.finalDate = new Date().toISOString().slice(0, 10);
            tabState[x.id] = 'resultados';
          }, false);
        };
      },
    }
  );
}

// --- Resultados (finalizado)
function resultsTab(t) {
  return {
    html: `<div class="panel">${resultsTable(t)}</div>
    <div class="panel"><div class="row wrap"><button class="btn ghost" data-jackpot>🎰 Agregar jackpot</button><button class="btn ghost" data-bonus>+ Punto extra</button><button class="btn ghost" data-winimg>📷 Foto del ganador</button><button class="btn ghost danger" data-reopen>Reabrir torneo</button></div>
    ${(t.jackpots || []).map((j, i) => `<div class="jackpot">🎰 <b>${esc(pname(j.playerId))}</b> ${esc(j.hand || '')} ${cardsHtml(j.cards, true)} ${money(j.amount, t.config.currency)} <button class="btn xs ghost" data-editjp="${i}">Editar</button></div>`).join('')}
    ${(t.bonus || []).map((b, i) => `<div class="small">+${b.points} a <b>${esc(pname(b.playerId))}</b> ${esc(b.reason || '')} <button class="link" data-rmbonus="${i}">quitar</button></div>`).join('')}
    ${t.winnerImage ? imgHtml(t.winnerImage, 'small') : ''}</div>`,
    bind(root) {
      root.querySelector('[data-jackpot]').onclick = () => jackpotDialog(t.id);
      on(root, '[data-editjp]', 'click', (b) => jackpotDialog(t.id, Number(b.dataset.editjp)));
      root.querySelector('[data-bonus]').onclick = () => bonusDialog(t.id);
      on(root, '[data-rmbonus]', 'click', (b) => upT(t.id, (x) => x.bonus.splice(Number(b.dataset.rmbonus), 1)));
      root.querySelector('[data-winimg]').onclick = async () => {
        const img = await pickImage();
        if (img) upT(t.id, (x) => (x.winnerImage = img), false);
      };
      root.querySelector('[data-reopen]').onclick = async () => {
        if (!(await confirmDlg('¿Reabrir el torneo? Volverá a estado "En juego" para corregir eliminaciones.', 'Reabrir'))) return;
        upT(t.id, (x) => {
          x.status = 'running';
          tabState[x.id] = 'vivo';
        }, false);
      };
    },
  };
}

// --- Editor del resumen lúdico
function summaryTab(t) {
  const blocks = buildSummary(S.db, t);
  const ov = (t.summary && t.summary.overrides) || {};
  return {
    html: `<div class="panel"><div class="row between wrap"><h3>Resumen lúdico</h3><div class="row"><button class="btn sm" data-word>⬇ Descargar Word</button><a class="btn sm ghost" href="#/torneo/${t.id}">Ver como jugador</a></div></div>
    <p class="muted small">El texto se genera automáticamente con las eliminaciones registradas. Puedes editar cada párrafo; usa "Texto automático" para volver a la versión generada.</p></div>
    ${blocks
      .map((b) => {
        const key = b.kind === 'title' ? 'title' : b.key;
        return `<div class="panel sum-edit"><div class="row between"><b>${{ title: 'Título', intro: 'Introducción', jackpot: 'Jackpot', info: 'Periodo de recompra', bust: `${b.position}° lugar`, winner: 'Ganador', closing: 'Cierre / ranking' }[b.kind] || ''}</b>
        ${ov[key] ? `<button class="link small" data-reset="${key}">Texto automático</button>` : ''}</div>
        <textarea rows="${b.kind === 'title' ? 1 : 3}" data-ov="${key}">${esc(b.text)}</textarea>
        ${b.kind === 'bust' ? `<div class="row">${imgHtml(b.image, 'thumb')}<button class="btn xs ghost" data-evimg="${b.key}">📷 ${b.image ? 'Cambiar' : 'Subir'} foto</button></div>` : ''}
        ${b.kind === 'winner' ? `<div class="row">${imgHtml(b.image, 'thumb')}<button class="btn xs ghost" data-winimg>📷 ${b.image ? 'Cambiar' : 'Subir'} foto</button></div>` : ''}
        </div>`;
      })
      .join('')}`,
    bind(root) {
      root.querySelector('[data-word]').onclick = () => downloadWord(S.db.tournaments.find((x) => x.id === t.id)).catch((e) => toast(e.message, 'error'));
      on(root, '[data-ov]', 'change', (el) =>
        upT(t.id, (x) => {
          x.summary = x.summary || { overrides: {} };
          x.summary.overrides[el.dataset.ov] = el.value;
        })
      );
      on(root, '[data-reset]', 'click', (b) => upT(t.id, (x) => delete x.summary.overrides[b.dataset.reset]));
      on(root, '[data-evimg]', 'click', async (b) => {
        const img = await pickImage();
        if (img) upT(t.id, (x) => (x.events.find((e) => e.id === b.dataset.evimg).image = img), false);
      });
      const wi = root.querySelector('[data-winimg]');
      if (wi)
        wi.onclick = async () => {
          const img = await pickImage();
          if (img) upT(t.id, (x) => (x.winnerImage = img), false);
        };
    },
  };
}

// ---------- Ajustes ----------
export function settingsView() {
  return {
    html: `<h2>Ajustes del club</h2>
    <div class="panel"><div class="form-grid">
      <label class="fld"><span>Nombre del club</span><input data-f="clubName" data-type="str" value="${esc(S.db.settings.clubName)}"></label></div></div>
    <div class="panel"><h3>Publicación</h3>
      <p class="small">Los cambios se guardan primero en <b>este navegador</b> (base de datos local). Con <b>Publicar</b> se suben al repositorio
      <a href="https://github.com/${esc(CONFIG.owner)}/${esc(CONFIG.repo)}" target="_blank" rel="noopener">${esc(CONFIG.owner)}/${esc(CONFIG.repo)}</a> y los jugadores los ven en 1–2 minutos.
      Mientras hay un torneo en juego se publica solo cada ${CONFIG.autoPublishMinutes} minutos.</p>
      <p class="small muted">Versión local: v${S.db.version || 0}${S.dirty ? ' + cambios sin publicar' : ' (publicada)'}. Los correos de los jugadores no se publican: quedan solo en este navegador y en el respaldo.</p>
      <button class="btn" data-pub ${S.publishing ? 'disabled' : ''}>⬆ Publicar ahora</button>
    </div>
    <div class="panel"><h3>Respaldo</h3>
      <p class="small">Descarga un archivo con todos los datos (incluye correos). Sirve para guardar una copia o para administrar desde otro computador o celular.</p>
      <div class="row wrap"><button class="btn ghost" data-backup>⬇ Descargar respaldo</button><button class="btn ghost" data-restore>⬆ Cargar respaldo</button></div>
    </div>`,
    bind(root) {
      bindFields(root, (db) => db.settings);
      root.querySelector('[data-pub]').onclick = () => publish();
      root.querySelector('[data-backup]').onclick = () => {
        const blob = new Blob([JSON.stringify(S.db, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mpc-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      };
      root.querySelector('[data-restore]').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = async () => {
          try {
            const data = JSON.parse(await input.files[0].text());
            if (!Array.isArray(data.players) || !Array.isArray(data.tournaments)) throw new Error('El archivo no es un respaldo válido');
            if (!(await confirmDlg('¿Reemplazar los datos de este navegador con el respaldo? Luego presiona Publicar para subirlos.', 'Reemplazar'))) return;
            await mutate((db) => {
              Object.keys(db).forEach((k) => delete db[k]);
              Object.assign(db, data, { version: Math.max(data.version || 0, S.db.version || 0) });
            }, { silent: false });
          } catch (e) {
            toast(e.message, 'error');
          }
        };
        input.click();
      };
    },
  };
}

export { results, defaultLevels, outEvents, tableOf };
