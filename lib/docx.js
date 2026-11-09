import fs from 'node:fs';
import path from 'node:path';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';
import { buildSummary } from '../public/js/logic.js';

function imageParagraph(img, uploadDir) {
  if (!img || !img.url || !img.url.startsWith('/uploads/')) return null;
  const file = path.join(uploadDir, path.basename(img.url));
  if (!fs.existsSync(file)) return null;
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = ext === 'png' ? 'png' : 'jpg';
  if (ext === 'webp') return null;
  const w = img.w || 800;
  const h = img.h || 600;
  const maxW = 380;
  const maxH = 420;
  const scale = Math.min(maxW / w, maxH / h, 1);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new ImageRun({
        type,
        data: fs.readFileSync(file),
        transformation: { width: Math.round(w * scale), height: Math.round(h * scale) },
      }),
    ],
  });
}

export async function summaryDocx(db, t, uploadDir) {
  const blocks = buildSummary(db, t);
  const children = [];
  for (const b of blocks) {
    const isTitle = b.kind === 'title' || b.kind === 'winner';
    children.push(
      new Paragraph({
        alignment: b.kind === 'title' ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
        spacing: { after: 160 },
        children: [new TextRun({ text: b.text, bold: isTitle, italics: isTitle, size: b.kind === 'title' ? 32 : 24 })],
      })
    );
    const ip = imageParagraph(b.image, uploadDir);
    if (ip) children.push(ip);
  }
  const doc = new Document({
    creator: (db.settings && db.settings.clubName) || 'Club de Poker',
    title: t.label || 'Resumen',
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
