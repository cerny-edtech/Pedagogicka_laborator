import React, { useRef, useState } from 'react';
import { Download, Printer, X, FileText, Loader2, AlertTriangle, Code } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Language } from '../../types';
import { getT } from '../../i18n/translations';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  documentContentHtml: string;
  filenamePrefix: string;
  language?: Language;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  documentContentHtml,
  filenamePrefix,
  language = 'cs',
}) => {
  const captureRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  if (!isOpen) return null;

  const t = getT(language);
  const locale = language === 'pl' ? 'pl-PL' : language === 'en' ? 'en-US' : 'cs-CZ';
  const now = new Date();
  const dateString = now.toLocaleDateString(locale);
  const fileDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const escapeHtml = (val: string) =>
    String(val || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeAppTitle = escapeHtml(t.appTitle);

  const fullPrintableHtml = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} - ${dateString}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Roboto, Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
      margin: 0;
      padding: 20px;
    }
    .doc-header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }
    .doc-header h1 {
      margin: 0;
      font-size: 20px;
      color: #0369a1;
    }
    .doc-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .doc-meta {
      font-size: 11px;
      color: #64748b;
      text-align: right;
      white-space: nowrap;
    }
    h2 {
      font-size: 16px;
      color: #1e293b;
      margin-top: 22px;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    h3 {
      font-size: 14px;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 6px;
    }
    p { font-size: 12.5px; color: #334155; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      background: #e0f2fe;
      color: #0369a1;
    }
    .card-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      background: #f8fafc;
      break-inside: avoid;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <h1>${safeTitle}</h1>
      <div class="doc-subtitle">${safeSubtitle}</div>
    </div>
    <div class="doc-meta">
      <strong>${safeAppTitle}</strong><br />
      ${dateString}
    </div>
  </div>
  ${documentContentHtml}
</body>
</html>`;

  const handleDownloadPdf = async () => {
    const el = captureRef.current;
    if (!el || isGenerating) return;
    setIsGenerating(true);
    setPdfError(null);

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Captured canvas is empty');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      // Convert mm height budget into source canvas pixel height for crisp pagination
      const pxPerMm = canvas.width / usableWidth;
      const pageHeightPx = Math.max(100, Math.floor(usableHeight * pxPerMm));

      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - offsetY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;

        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            offsetY,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
          );
        }

        const sliceImg = pageCanvas.toDataURL('image/jpeg', 0.95);
        const renderHeightMm = sliceHeightPx / pxPerMm;

        if (pageIndex > 0) {
          pdf.addPage();
        }
        pdf.addImage(sliceImg, 'JPEG', margin, margin, usableWidth, renderHeightMm);

        offsetY += sliceHeightPx;
        pageIndex += 1;
      }

      pdf.save(`${filenamePrefix}_${fileDate}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setPdfError(t.pdfModal.errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintNow = () => {
    setPdfError(null);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.srcdoc = fullPrintableHtml;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('afterprint', cleanup);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    iframe.onload = () => {
      const frameWin = iframe.contentWindow;
      const fallbackTimer = setTimeout(cleanup, 60000);
      const cleanupWithTimer = () => {
        clearTimeout(fallbackTimer);
        cleanup();
      };
      if (frameWin) {
        frameWin.onafterprint = cleanupWithTimer;
      }
      window.addEventListener('afterprint', cleanupWithTimer, { once: true });

      try {
        frameWin?.focus();
        frameWin?.print();
      } catch (e) {
        console.error('Print frame error:', e);
        window.print();
      }
    };

    document.body.appendChild(iframe);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([fullPrintableHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${fileDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Top Modal Controls */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white leading-tight">{t.pdfModal.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium transition shadow-xs cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isGenerating ? t.pdfModal.generatingPdf : t.pdfModal.downloadPdf}
            </button>
            <button
              onClick={handlePrintNow}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-medium transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t.pdfModal.printNow}
            </button>
            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition cursor-pointer"
              title="HTML"
            >
              <Code className="w-3.5 h-3.5" />
              {t.pdfModal.downloadHtml}
            </button>
            <button
              onClick={onClose}
              aria-label={t.pdfModal.close}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}

        {/* Scrollable A4 Preview & Direct PDF Capture Target */}
        <div className="p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950/60 flex-1">
          <div
            ref={captureRef}
            className="bg-white text-slate-900 rounded-xl shadow-md border border-slate-200 max-w-3xl mx-auto"
            style={{ padding: '28px 32px', backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            <div
              style={{
                borderBottom: '2px solid #0284c7',
                paddingBottom: '12px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: '16px',
              }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0369a1' }}>{title}</h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>{subtitle}</p>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <strong style={{ color: '#334155' }}>{t.appTitle}</strong>
                <br />
                {dateString}
              </div>
            </div>

            <div
              className="pdf-document-body"
              style={{ fontSize: '13px', lineHeight: 1.5, color: '#1e293b' }}
              dangerouslySetInnerHTML={{ __html: documentContentHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
