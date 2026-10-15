'use client';

import JsBarcode from 'jsbarcode';
import { Product } from '@/types';

/**
 * Generates an SVG string representation of a barcode for reliable printing
 */
export function generateBarcodeSvgString(
  value: string,
  width: number = 1.5,
  height: number = 40,
  fontSize: number = 11
): string {
  if (typeof document === 'undefined') return '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const barcodeVal = String(value).trim() || '1234567890123';
  
  let detectedFormat = 'auto';
  if (/^\d{13}$/.test(barcodeVal)) {
    detectedFormat = 'EAN13';
  } else if (/^\d{8}$/.test(barcodeVal)) {
    detectedFormat = 'EAN8';
  } else if (/^\d{12}$/.test(barcodeVal)) {
    detectedFormat = 'UPC';
  } else {
    detectedFormat = 'CODE128';
  }

  try {
    JsBarcode(svg, barcodeVal, {
      format: detectedFormat as any,
      width,
      height,
      displayValue: true,
      fontSize,
      font: 'monospace',
      textMargin: 2,
      lineColor: '#000000',
      background: '#ffffff',
      valid: (valid) => {
        if (!valid) {
          try {
            JsBarcode(svg, barcodeVal, {
              format: 'CODE128',
              width,
              height,
              displayValue: true,
              fontSize,
              font: 'monospace',
              textMargin: 2,
              lineColor: '#000000',
              background: '#ffffff',
            });
          } catch (e) {
            console.warn('Barcode fallback error in SVG generator:', e);
          }
        }
      }
    });
    return svg.outerHTML;
  } catch (err) {
    console.warn('Error rendering barcode in SVG generator:', err);
    return `<div style="font-family: monospace; font-size: 14px; font-weight: bold; padding: 8px; border: 1px dashed #000; text-align: center;">${barcodeVal}</div>`;
  }
}

/**
 * Universal print trigger that works reliably in iframes, cloud sandboxes, and modern browsers.
 * Uses an invisible <iframe> to isolate print styles without disrupting the parent application DOM.
 */
export function printHtmlDocument(htmlContent: string, title: string = 'Print Document') {
  if (typeof window === 'undefined') return;

  // Clean up any previously existing print iframes
  const existingFrame = document.getElementById('aura-print-iframe');
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'aura-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    // Fallback: standard window.print if iframe creation is blocked
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: auto;
            margin: 4mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 4mm;
          }
          .grid-labels {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            max-width: 800px;
            margin: 0 auto;
          }
          .grid-shelf {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .grid-jewel {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .label-card {
            border: 1.5px solid #000000;
            border-radius: 6px;
            padding: 10px;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            break-inside: avoid;
            min-height: 140px;
          }
          .shelf-card {
            min-height: 220px;
            border-width: 2px;
            padding: 14px;
          }
          .jewel-card {
            min-height: 85px;
            padding: 6px;
            font-size: 8px;
          }
          .label-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            font-weight: 700;
            font-family: monospace;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .label-title {
            font-size: 12px;
            font-weight: 700;
            color: #000000;
            margin-bottom: 6px;
            line-height: 1.25;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .label-barcode-container {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 4px 0;
          }
          .label-barcode-container svg {
            max-width: 100%;
            height: auto;
            display: block;
          }
          .label-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            font-family: monospace;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
            margin-top: 6px;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  // Give the browser iframe a moment to layout and parse fonts/SVGs, then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Iframe print error, falling back to window.print():', e);
      window.print();
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 2000);
    }
  }, 250);
}

/**
 * Builds HTML for a single product with specified sticker count
 */
export function buildProductLabelsHtml(
  product: Product,
  count: number,
  orgName: string = 'ISKCON FOUNDATION',
  batchNo?: string
): string {
  const barcodeSvg = generateBarcodeSvgString(product.barcode || '8901234002039', 1.4, 38, 10);
  const formattedPrice = Number(product.price).toFixed(2);
  const batch = batchNo || product.batchNo || 'ISK-2026';

  const cardsHtml = Array.from({ length: count })
    .map(
      () => `
      <div class="label-card">
        <div class="label-header">
          <span>${orgName}</span>
          <span>₹${formattedPrice}</span>
        </div>
        <div class="label-title">${product.name}</div>
        <div class="label-barcode-container">
          ${barcodeSvg}
        </div>
        <div class="label-footer">
          <span>SKU: ${product.sku}</span>
          <span>BATCH: ${batch}</span>
        </div>
      </div>
    `
    )
    .join('');

  return `<div class="grid-labels">${cardsHtml}</div>`;
}

/**
 * Builds HTML for bulk printing multiple products (e.g. 12 stickers per product)
 */
export function buildBulkLabelsHtml(
  products: Product[],
  labelsPerProduct: number = 12,
  orgName: string = 'ISKCON FOUNDATION'
): string {
  return products
    .map((p, index) => {
      const isLast = index === products.length - 1;
      return `
      <div class="${isLast ? '' : 'page-break'}">
        ${buildProductLabelsHtml(p, labelsPerProduct, orgName, p.batchNo)}
      </div>
    `;
    })
    .join('');
}

export interface PrintableBarcodeItem {
  id?: string;
  sku: string;
  productName: string;
  barcodeValue: string;
  batchNo?: string;
  grnNumber?: string;
  sellingPrice?: number;
  purchaseCost?: number;
}

/**
 * Builds HTML for bulk printing a list of Barcode Records with item counts and template styles
 */
export function buildBarcodeRecordsLabelsHtml(
  records: PrintableBarcodeItem[],
  quantities: Record<string, number> | number = 1,
  orgName: string = 'ISKCON FOUNDATION',
  templateStyle: 'standard' | 'shelf' | 'jewel' = 'standard'
): string {
  const cardsHtml = records
    .map(record => {
      const recordKey = record.id || record.barcodeValue || record.sku;
      const count = typeof quantities === 'number' ? quantities : (quantities[recordKey] ?? 1);
      const barcodeSvg = generateBarcodeSvgString(
        record.barcodeValue || '8901234002039',
        templateStyle === 'jewel' ? 1.0 : templateStyle === 'shelf' ? 1.8 : 1.4,
        templateStyle === 'jewel' ? 24 : templateStyle === 'shelf' ? 44 : 36,
        templateStyle === 'jewel' ? 8 : templateStyle === 'shelf' ? 12 : 10
      );
      const formattedPrice = record.sellingPrice ? Number(record.sellingPrice).toFixed(2) : '0.00';
      const batch = record.batchNo || 'N/A';
      const grn = record.grnNumber ? `GRN: ${record.grnNumber}` : '';

      return Array.from({ length: count })
        .map(
          () => `
          <div class="label-card ${templateStyle === 'shelf' ? 'shelf-card' : templateStyle === 'jewel' ? 'jewel-card' : ''}">
            <div class="label-header">
              <span>${orgName}</span>
              <span style="color: #059669; font-weight: bold;">₹${formattedPrice}</span>
            </div>
            <div class="label-title" style="${templateStyle === 'jewel' ? 'font-size: 9px; line-height: 1.1;' : ''}">${record.productName}</div>
            <div class="label-barcode-container">
              ${barcodeSvg}
            </div>
            <div class="label-footer" style="${templateStyle === 'jewel' ? 'font-size: 7px;' : ''}">
              <span>SKU: ${record.sku}</span>
              <span>BAT: ${batch}</span>
              ${grn ? `<span>${grn}</span>` : ''}
            </div>
          </div>
        `
        )
        .join('');
    })
    .join('');

  return `<div class="grid-labels ${templateStyle === 'jewel' ? 'grid-jewel' : templateStyle === 'shelf' ? 'grid-shelf' : ''}">${cardsHtml}</div>`;
}

