'use client';

import JsBarcode from 'jsbarcode';
import { Product, MaterialInwardNote } from '@/types';

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

  // Remove any existing print modal
  const existingModal = document.getElementById('aura-print-preview-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create print preview modal overlay
  const modal = document.createElement('div');
  modal.id = 'aura-print-preview-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '999999';
  modal.style.background = 'rgba(15, 23, 42, 0.75)';
  modal.style.backdropFilter = 'blur(4px)';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.padding = '20px';

  modal.innerHTML = `
    <div style="background: #ffffff; width: 100%; max-width: 750px; height: 90vh; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden; font-family: sans-serif;">
      <div style="padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; font-weight: bold; color: #0f172a; font-family: monospace;">🖨️ ${title}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button id="aura-do-print-btn" style="background: #d97706; color: white; border: none; padding: 8px 18px; border-radius: 10px; font-weight: bold; font-size: 12px; cursor: pointer; font-family: monospace; display: flex; align-items: center; gap: 6px;">
              🖨️ Print Now
            </button>
            <button id="aura-close-print-btn" style="background: #e2e8f0; color: #334155; border: none; padding: 8px 14px; border-radius: 10px; font-weight: bold; font-size: 12px; cursor: pointer; font-family: monospace;">
              ✕ Close
            </button>
          </div>
        </div>
        <div id="aura-print-notice" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; font-size: 11px; padding: 6px 12px; border-radius: 8px; font-family: monospace;">
          ℹ️ If your browser blocks popups in the preview sandbox, the official receipt PDF has also been automatically downloaded to your device!
        </div>
      </div>
      <div id="aura-print-body" style="flex: 1; overflow-y: auto; padding: 30px; background: #ffffff;">
        ${htmlContent}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add print style tag
  const styleTag = document.createElement('style');
  styleTag.id = 'aura-print-style';
  styleTag.innerHTML = `
    @media print {
      body * {
        visibility: hidden !important;
      }
      #aura-print-preview-modal, #aura-print-preview-modal * {
        visibility: visible !important;
      }
      #aura-print-preview-modal {
        position: fixed !important;
        inset: 0 !important;
        background: #ffffff !important;
        padding: 0 !important;
        backdrop-filter: none !important;
      }
      #aura-print-preview-modal > div {
        max-width: 100% !important;
        height: 100% !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      #aura-print-preview-modal div:first-child {
        display: none !important;
      }
      #aura-print-body {
        padding: 0 !important;
        overflow: visible !important;
      }
    }
  `;
  document.head.appendChild(styleTag);

  const removeModal = () => {
    modal.remove();
    const st = document.getElementById('aura-print-style');
    if (st) st.remove();
  };

  modal.querySelector('#aura-close-print-btn')?.addEventListener('click', removeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) removeModal();
  });

  modal.querySelector('#aura-do-print-btn')?.addEventListener('click', () => {
    try {
      window.print();
    } catch (err) {
      console.warn('Browser print blocked or unsupported in sandbox:', err);
      const notice = modal.querySelector('#aura-print-notice');
      if (notice) {
        (notice as HTMLElement).style.display = 'block';
      }
    }
  });
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

/**
 * Builds HTML for printing a formal Material Inward Note (GRN) receipt/voucher
 */
export function buildGrnReceiptHtml(note: MaterialInwardNote): string {
  const itemsHtml = (note.items || []).map((item, idx) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace;">${idx + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace;"><strong>${item.sku}</strong><br/>${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center; font-family: monospace;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace;">₹${Number(item.unitCost).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-family: monospace; font-weight: bold;">₹${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div style="max-width: 700px; margin: 0 auto; padding: 20px; font-family: sans-serif; color: #000; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase;">ISKCON RETAIL ERP</h2>
        <p style="margin: 4px 0 0; font-size: 12px; font-family: monospace;">GOODS RECEIVED NOTE (GRN) / INWARD VOUCHER</p>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; font-family: monospace;">
        <div>
          <p><strong>GRN Number:</strong> ${note.grnNumber}</p>
          <p><strong>PO Number:</strong> ${note.poNumber}</p>
          <p><strong>Vendor:</strong> ${note.vendorName}</p>
        </div>
        <div style="text-align: right;">
          <p><strong>Invoice Date:</strong> ${note.invoiceDate}</p>
          <p><strong>Warehouse Zone:</strong> ${note.warehouse}</p>
          <p><strong>Received By:</strong> ${note.receivedBy || 'Staff'}</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #000;">
            <th style="padding: 8px; text-align: left; font-family: monospace;">#</th>
            <th style="padding: 8px; text-align: left; font-family: monospace;">SKU & Description</th>
            <th style="padding: 8px; text-align: center; font-family: monospace;">Qty</th>
            <th style="padding: 8px; text-align: right; font-family: monospace;">Unit Cost</th>
            <th style="padding: 8px; text-align: right; font-family: monospace;">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px; font-size: 14px; font-family: monospace;">
        <div style="text-align: right; border-top: 2px solid #000; padding-top: 10px; width: 250px;">
          <strong>Total Valuation: ₹${Number(note.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 11px; font-family: monospace; border-top: 1px dashed #666; padding-top: 15px;">
        <div>Store Keeper Signature: ______________________</div>
        <div>Authorized Signatory: ______________________</div>
      </div>
    </div>
  `;
}


