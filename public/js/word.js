// Genera el resumen en Word directamente en el navegador.
import { S, imgSrc, toast } from './core.js';
import { buildSummary } from './logic.js';

let loading;
function loadDocx() {
  if (window.docx) return Promise.resolve(window.docx);
  loading =
    loading ||
    new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/docx.iife.js';
      sc.onload = () => res(window.docx);
      sc.onerror = () => rej(new Error('No se pudo cargar el generador de Word'));
      document.head.appendChild(sc);
    });
  return loading;
}

async function imageBytes(img) {
  try {
    const r = await fetch(imgSrc(img));
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function downloadWord(t) {
  toast('Generando Word…');
  const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = await loadDocx();
  const children = [];
  for (const b of buildSummary(S.db, t)) {
    const strong = b.kind === 'title' || b.kind === 'winner';
    children.push(
      new Paragraph({
        alignment: b.kind === 'title' ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
        spacing: { after: 160 },
        children: [new TextRun({ text: b.text, bold: strong, italics: strong, size: b.kind === 'title' ? 32 : 24 })],
      })
    );
    if (b.image && b.image.url) {
      const data = await imageBytes(b.image);
      if (data) {
        const w = b.image.w || 800;
        const h = b.image.h || 600;
        const sc = Math.min(380 / w, 420 / h, 1);
        const png = (b.image.url || '').endsWith('.png');
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new ImageRun({ type: png ? 'png' : 'jpg', data, transformation: { width: Math.round(w * sc), height: Math.round(h * sc) } })],
          })
        );
      }
    }
  }
  const doc = new Document({
    creator: S.db.settings.clubName || 'Club de Poker',
    title: t.label,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Resumen_${(t.label || 'Fecha').replace(/[^\w]+/g, '_')}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
