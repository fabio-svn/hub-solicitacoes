import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { renderFromTemplate } from './template-renderer';
import { ArtTemplate, LayerLink } from '../types/art-template';

function resolveLink(link: LayerLink, data: Record<string, string>): string {
  if (link.type === 'static')      return link.url;
  if (link.type === 'placeholder') return data[link.placeholder] || '';
  if (link.type === 'template') {
    return link.template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
  }
  return '';
}

export async function renderTemplateToPdf(
  template: ArtTemplate,
  data: Record<string, string>
): Promise<Buffer> {
  const pngBuffer = await renderFromTemplate(template, data);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([template.canvas.width, template.canvas.height]);

  const embeddedPng = await pdf.embedPng(pngBuffer);
  page.drawImage(embeddedPng, {
    x: 0,
    y: 0,
    width: template.canvas.width,
    height: template.canvas.height,
  });

  const pageHeight = template.canvas.height;

  for (const layer of template.layers ?? []) {
    if (!layer.link) continue;
    const resolvedUrl = resolveLink(layer.link, data);
    if (!resolvedUrl) continue;

    const w = (layer as any).w ?? 0;
    const h = (layer as any).h ?? 0;
    if (w <= 0 || h <= 0) continue;

    const annotation = pdf.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [
        layer.x,
        pageHeight - layer.y - h,
        layer.x + w,
        pageHeight - layer.y,
      ],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(resolvedUrl),
      },
    });

    let annots = page.node.get(PDFName.of('Annots'));
    if (!annots) {
      annots = pdf.context.obj([]);
      page.node.set(PDFName.of('Annots'), annots);
    }
    (annots as any).push(annotation);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
