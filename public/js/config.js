// Repositorio de GitHub donde se publican la web y los datos del club.
// Si la web corre en <usuario>.github.io/<repo>, se detecta solo.
const host = location.hostname;
const fromPages = host.endsWith('.github.io') ? { owner: host.split('.')[0], repo: location.pathname.split('/').filter(Boolean)[0] } : null;

export const CONFIG = {
  owner: (fromPages && fromPages.owner) || 'Keyciren',
  repo: (fromPages && fromPages.repo) || 'MPC',
  branch: 'main',
  // carpeta del repositorio que se publica como sitio web
  siteDir: 'public',
  // cada cuántos minutos se publica sola la información mientras hay un torneo en juego (0 = nunca)
  autoPublishMinutes: 6,
};
