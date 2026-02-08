import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

export type ExportFormat = 'jpeg' | 'pdf';

interface ExportOptions {
  element: HTMLElement;
  workplaceName: string;
  dateLabel: string;
  format: ExportFormat;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function exportCalendar({ element, workplaceName, dateLabel, format }: ExportOptions): Promise<void> {
  const filename = `calendar_${sanitizeFilename(workplaceName)}_${sanitizeFilename(dateLabel)}`;

  // Add exporting class for CSS overrides (expand scrollers, hide nav, force light mode)
  element.classList.add('calendar-exporting');

  // Give the browser a frame to apply CSS changes
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const dataUrl = await toJpeg(element, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });

    if (format === 'jpeg') {
      downloadDataUrl(dataUrl, `${filename}.jpeg`);
    } else {
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for PDF'));
      });

      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      // Use landscape or portrait based on aspect ratio, fit image to page
      const orientation = imgWidth > imgHeight ? 'l' : 'p';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [imgWidth, imgHeight] });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${filename}.pdf`);
    }
  } finally {
    element.classList.remove('calendar-exporting');
  }
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
