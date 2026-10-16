import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import { MaterialInwardNote } from '@/types';

export interface EventExportData {
  event: {
    id: string;
    name: string;
    code?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    stallLocation?: string;
    stallManager?: string;
    targetSales?: number;
    discountPercent?: number;
    status: string;
  };
  allocations: {
    sku: string;
    productName: string;
    category: string;
    allocatedQty: number;
    soldQty: number;
    damagedQty: number;
    returnedQty: number;
    price: number;
  }[];
  transactions: {
    orderNumber: string;
    timestamp: string;
    cashierName: string;
    paymentMethod: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    items: { sku: string; name: string; quantity: number; price: number; total: number }[];
  }[];
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    cashCollection: number;
    upiCollection: number;
    avgTicketValue: number;
    totalAllocated: number;
    totalSold: number;
    totalDamaged: number;
    totalRemaining: number;
  };
}

/**
 * Export complete event reconciliation & financial data to Excel (.xlsx)
 */
export function exportEventToExcel(data: EventExportData) {
  const wb = XLSX.utils.book_new();

  // 1. Inventory Reconciliation Sheet
  const reconData: (string | number)[][] = [
    ['ISKCON RETAIL ERP - EVENT INVENTORY RECONCILIATION REPORT'],
    [`Event: ${data.event.name} (${data.event.code || data.event.id})`],
    [`Location: ${data.event.stallLocation || 'Main Stall'} | Manager: ${data.event.stallManager || 'Unassigned'}`],
    [`Period: ${data.event.startDate} to ${data.event.endDate} | Status: ${(data?.event?.status || 'upcoming').toUpperCase()}`],
    [],
    ['SKU', 'Product Name', 'Category', 'Unit Price (₹)', 'Allocated Qty', 'Sold Qty', 'Damaged Qty', 'Unsold/Returned Qty', 'Gross Revenue (₹)'],
    ...data.allocations.map(a => [
      a.sku,
      a.productName,
      a.category,
      a.price,
      a.allocatedQty,
      a.soldQty,
      a.damagedQty,
      Math.max(0, a.allocatedQty - a.soldQty - a.damagedQty),
      a.soldQty * a.price
    ]),
    [],
    [
      'TOTALS',
      '',
      '',
      '',
      data.summary.totalAllocated,
      data.summary.totalSold,
      data.summary.totalDamaged,
      data.summary.totalRemaining,
      data.summary.totalRevenue
    ]
  ];
  const wsRecon = XLSX.utils.aoa_to_sheet(reconData);
  wsRecon['!cols'] = [
    { wch: 18 },
    { wch: 45 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsRecon, 'Inventory Reconciliation');

  // 2. Financial Summary Sheet
  const finData: (string | number)[][] = [
    ['ISKCON RETAIL ERP - STALL FINANCIAL RECONCILIATION SUMMARY'],
    [`Event: ${data.event.name}`],
    [],
    ['Financial Metric', 'Value'],
    ['Total Event Gross Revenue', `₹ ${data.summary.totalRevenue.toLocaleString('en-IN')}`],
    ['Total Completed Orders', data.summary.totalTransactions],
    ['Average Ticket Value', `₹ ${data.summary.avgTicketValue.toFixed(2)}`],
    ['UPI Payments Collection', `₹ ${data.summary.upiCollection.toLocaleString('en-IN')}`],
    ['Cash Payments Collection', `₹ ${data.summary.cashCollection.toLocaleString('en-IN')}`],
    ['Target Revenue Goal', `₹ ${(data.event.targetSales || 0).toLocaleString('en-IN')}`],
    ['Achievement Rate', data.event.targetSales ? `${((data.summary.totalRevenue / data.event.targetSales) * 100).toFixed(1)}%` : 'N/A'],
    ['Total Stock Allocated (Units)', data.summary.totalAllocated],
    ['Total Stock Sold (Units)', data.summary.totalSold],
    ['Total Shrinkage / Damaged (Units)', data.summary.totalDamaged],
    ['Remaining / Returned (Units)', data.summary.totalRemaining]
  ];
  const wsFin = XLSX.utils.aoa_to_sheet(finData);
  wsFin['!cols'] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsFin, 'Financial Summary');

  // 3. Transactions Sheet
  if (data.transactions.length > 0) {
    const txData: (string | number)[][] = [
      ['Order Number', 'Date & Time', 'Cashier', 'Payment Mode', 'Items Count', 'Subtotal (₹)', 'Discount (₹)', 'Tax/GST (₹)', 'Net Total (₹)'],
      ...data.transactions.map(t => [
        t.orderNumber,
        new Date(t.timestamp).toLocaleString('en-IN'),
        t.cashierName,
        t.paymentMethod.toUpperCase(),
        t.items?.length || 1,
        t.subtotal,
        t.discountAmount,
        t.taxAmount,
        t.total
      ])
    ];
    const wsTx = XLSX.utils.aoa_to_sheet(txData);
    wsTx['!cols'] = [
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions Ledger');
  }

  const cleanFilename = `${(data.event.name || 'Event').replace(/[^a-zA-Z0-9_-]/g, '_')}_Reconciliation.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}

/**
 * Export styled printable PDF document of event reconciliation report
 */
export function exportEventToPdf(data: EventExportData) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const darkSlate = [15, 23, 42]; // #0F172A
  const lightGrey = [241, 245, 249];

  // Top Header Banner
  doc.setFillColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ISKCON RETAIL ERP — STALL EVENT WORKSPACE', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(245, 158, 11);
  doc.text('INVENTORY RECONCILIATION & FINANCIAL SETTLEMENT AUDIT REPORT', 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 220, 18);

  // Event Meta Box
  doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.roundedRect(14, 28, 269, 20, 2, 2, 'F');

  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.event.name} [${data.event.code || data.event.id}]`, 18, 35);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Stall Spot: ${data.event.stallLocation || 'Main Stall'}  |  Manager: ${data.event.stallManager || 'Unassigned'}  |  Dates: ${data.event.startDate} to ${data.event.endDate}  |  Status: ${(data?.event?.status || 'upcoming').toUpperCase()}`,
    18,
    43
  );

  // KPI Summary Boxes (4 columns)
  const boxWidth = 63.5;
  const kpis = [
    { label: 'TOTAL EVENT REVENUE', value: `₹ ${data.summary.totalRevenue.toLocaleString('en-IN')}`, color: [16, 185, 129] },
    { label: 'UPI COLLECTIONS', value: `₹ ${data.summary.upiCollection.toLocaleString('en-IN')}`, color: [99, 102, 241] },
    { label: 'CASH COLLECTIONS', value: `₹ ${data.summary.cashCollection.toLocaleString('en-IN')}`, color: [217, 119, 6] },
    { label: 'ITEMS SOLD / ALLOCATED', value: `${data.summary.totalSold} / ${data.summary.totalAllocated} Units`, color: [139, 92, 246] }
  ];

  kpis.forEach((kpi, idx) => {
    const startX = 14 + idx * (boxWidth + 5);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(startX, 52, boxWidth, 16, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, startX + 4, 58);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, startX + 4, 64);
  });

  // Table Data
  const tableRows = data.allocations.map(a => [
    a.sku,
    a.productName,
    a.category,
    `₹ ${a.price.toLocaleString('en-IN')}`,
    a.allocatedQty.toString(),
    a.soldQty.toString(),
    a.damagedQty.toString(),
    Math.max(0, a.allocatedQty - a.soldQty - a.damagedQty).toString(),
    `₹ ${(a.soldQty * a.price).toLocaleString('en-IN')}`
  ]);

  // Totals Row
  tableRows.push([
    'TOTALS',
    '',
    '',
    '',
    data.summary.totalAllocated.toString(),
    data.summary.totalSold.toString(),
    data.summary.totalDamaged.toString(),
    data.summary.totalRemaining.toString(),
    `₹ ${data.summary.totalRevenue.toLocaleString('en-IN')}`
  ]);

  autoTable(doc, {
    startY: 72,
    head: [['SKU', 'Product Name', 'Category', 'Unit Price', 'Allocated', 'Sold', 'Damaged', 'Unsold/Return', 'Gross Revenue']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 30 },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 180;
  if (finalY < 190) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Prepared By (Stall Cashier): ____________________', 14, finalY);
    doc.text('Verified By (Event Coordinator): ____________________', 110, finalY);
    doc.text('Audited By (Accounts Dept): ____________________', 200, finalY);
  }

  const cleanFilename = `${(data.event.name || 'Event').replace(/[^a-zA-Z0-9_-]/g, '_')}_Reconciliation.pdf`;
  doc.save(cleanFilename);
}

/**
 * Export CSV format with UTF-8 BOM
 */
export function exportEventToCsv(data: EventExportData) {
  const rows = [
    ['Product Name', 'SKU', 'Category', 'Allocated Qty', 'Sold Qty', 'Damaged Qty', 'Returned/Remaining Qty', 'Unit Price', 'Gross Revenue'],
    ...data.allocations.map(a => [
      `"${a.productName.replace(/"/g, '""')}"`,
      a.sku,
      `"${a.category.replace(/"/g, '""')}"`,
      a.allocatedQty,
      a.soldQty,
      a.damagedQty,
      Math.max(0, a.allocatedQty - a.soldQty - a.damagedQty),
      a.price,
      a.soldQty * a.price
    ]),
    [],
    [
      'TOTALS',
      '',
      '',
      data.summary.totalAllocated,
      data.summary.totalSold,
      data.summary.totalDamaged,
      data.summary.totalRemaining,
      '',
      data.summary.totalRevenue
    ]
  ];

  const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${(data.event.name || 'Event').replace(/[^a-zA-Z0-9_-]/g, '_')}_Reconciliation.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface BIAnalyticsExportData {
  dateRangeLabel: string;
  startDate: string;
  endDate: string;
  summary: {
    totalSalesRevenue: number;
    totalSalesBills: number;
    booksRevenue: number;
    giftsRevenue: number;
    totalQuantitySold: number;
    avgTicketValue: number;
    totalInboundCost: number;
    totalInboundNotes: number;
    totalQuantityInbound: number;
    gstCollected: number;
  };
  orders: {
    orderNumber: string;
    timestamp: string;
    customerName: string;
    paymentMethod: string;
    salesTag: string;
    itemsCount: number;
    total: number;
  }[];
  inwardNotes: {
    grnNumber: string;
    invoiceDate: string;
    vendorName: string;
    warehouse: string;
    itemsCount: number;
    totalValue: number;
  }[];
}

/**
 * Export BI Analytics to Excel (.xlsx) with date range metadata
 */
export function exportBIAnalyticsToExcel(data: BIAnalyticsExportData) {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Sheet
  const summaryRows: (string | number)[][] = [
    ['ISKCON RETAIL ERP — BUSINESS INTELLIGENCE & AUDIT REPORT'],
    [`Period: ${data.dateRangeLabel} (${data.startDate} to ${data.endDate})`],
    [`Export Date: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['Key Performance Metric', 'Value'],
    ['POS Gross Sales Revenue', `₹ ${data.summary.totalSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Literature / Books Revenue', `₹ ${data.summary.booksRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Devotional Gifts & Souvenirs Revenue', `₹ ${data.summary.giftsRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Total Finalized Sales Orders', data.summary.totalSalesBills],
    ['Total Items/Units Disbursed', data.summary.totalQuantitySold],
    ['Average Order Ticket Value', `₹ ${data.summary.avgTicketValue.toFixed(2)}`],
    ['GST 5% Tax Collection', `₹ ${data.summary.gstCollected.toFixed(2)}`],
    ['Material Inbound Cost Basis', `₹ ${data.summary.totalInboundCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ['Total GRN Shipment Batches', data.summary.totalInboundNotes],
    ['Total Inbound Units Stocked', data.summary.totalQuantityInbound]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 2. POS Sales Orders Sheet
  if (data.orders.length > 0) {
    const orderRows: (string | number)[][] = [
      ['Order Number', 'Date & Time', 'Customer Name', 'Payment Mode', 'Sales Tag / Discount', 'Items Count', 'Total Paid (₹)'],
      ...data.orders.map(o => [
        o.orderNumber,
        o.timestamp,
        o.customerName,
        o.paymentMethod.toUpperCase(),
        o.salesTag,
        o.itemsCount,
        o.total
      ]),
      [],
      ['TOTALS', '', '', '', '', data.summary.totalQuantitySold, data.summary.totalSalesRevenue]
    ];
    const wsOrders = XLSX.utils.aoa_to_sheet(orderRows);
    wsOrders['!cols'] = [
      { wch: 20 },
      { wch: 24 },
      { wch: 22 },
      { wch: 16 },
      { wch: 24 },
      { wch: 14 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsOrders, 'POS Sales Orders');
  }

  // 3. Material Inward Notes Sheet
  if (data.inwardNotes.length > 0) {
    const inwardRows: (string | number)[][] = [
      ['GRN Number', 'Invoice Date', 'Vendor / Supplier', 'Warehouse Zone', 'Items Received (pcs)', 'Valuation (₹)'],
      ...data.inwardNotes.map(n => [
        n.grnNumber,
        n.invoiceDate,
        n.vendorName,
        n.warehouse,
        n.itemsCount,
        n.totalValue
      ]),
      [],
      ['TOTALS', '', '', '', data.summary.totalQuantityInbound, data.summary.totalInboundCost]
    ];
    const wsInward = XLSX.utils.aoa_to_sheet(inwardRows);
    wsInward['!cols'] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 32 },
      { wch: 24 },
      { wch: 22 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsInward, 'Material Inward GRNs');
  }

  const cleanFilename = `ISKCON_BI_Analytics_${data.startDate}_to_${data.endDate}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}

/**
 * Export BI Analytics to styled PDF document
 */
export function exportBIAnalyticsToPdf(data: BIAnalyticsExportData) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const darkSlate = [15, 23, 42];

  // Header Banner
  doc.setFillColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ISKCON RETAIL ERP — BUSINESS INTELLIGENCE & AUDIT REPORT', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(245, 158, 11);
  doc.text(`DATE RANGE: ${data.dateRangeLabel.toUpperCase()} (${data.startDate} to ${data.endDate})`, 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 220, 18);

  // Summary Metrics Banner (4 boxes)
  const boxWidth = 63.5;
  const kpis = [
    { label: 'POS SALES REVENUE', value: `₹ ${data.summary.totalSalesRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: [16, 185, 129] },
    { label: 'ORDERS / UNITS SOLD', value: `${data.summary.totalSalesBills} bills / ${data.summary.totalQuantitySold} pcs`, color: [217, 119, 6] },
    { label: 'MATERIAL INWARD COST', value: `₹ ${data.summary.totalInboundCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: [99, 102, 241] },
    { label: 'GST (5%) TAX COLLECTED', value: `₹ ${data.summary.gstCollected.toFixed(2)}`, color: [139, 92, 246] }
  ];

  kpis.forEach((kpi, idx) => {
    const startX = 14 + idx * (boxWidth + 5);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(startX, 30, boxWidth, 16, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, startX + 4, 36);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, startX + 4, 42);
  });

  // Sales Orders Table
  const orderRows = data.orders.slice(0, 20).map(o => [
    o.orderNumber,
    o.timestamp,
    o.customerName,
    o.paymentMethod.toUpperCase(),
    o.salesTag,
    `${o.itemsCount} pcs`,
    `₹ ${o.total.toFixed(2)}`
  ]);

  if (data.orders.length > 20) {
    orderRows.push(['...', `+ ${data.orders.length - 20} more orders in range`, '', '', '', '', '']);
  }

  autoTable(doc, {
    startY: 50,
    head: [['Order #', 'Date & Time', 'Customer', 'Mode', 'Sales Tag', 'Items', 'Total Amount']],
    body: orderRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    }
  });

  const cleanFilename = `ISKCON_BI_Analytics_${data.startDate}_to_${data.endDate}.pdf`;
  doc.save(cleanFilename);
}

/**
 * Export BI Analytics to CSV format
 */
export function exportBIAnalyticsToCsv(data: BIAnalyticsExportData) {
  const rows: (string | number)[][] = [
    ['--- ISKCON RETAIL ERP - BUSINESS INTELLIGENCE REPORT ---'],
    [`Date Range: ${data.dateRangeLabel} (${data.startDate} to ${data.endDate})`],
    [`Export Timestamp: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['--- EXECUTIVE KPI SUMMARY ---'],
    ['Metric', 'Value'],
    ['Total Sales Revenue (INR)', data.summary.totalSalesRevenue.toFixed(2)],
    ['Books Revenue (INR)', data.summary.booksRevenue.toFixed(2)],
    ['Gifts Revenue (INR)', data.summary.giftsRevenue.toFixed(2)],
    ['Total Completed Orders', data.summary.totalSalesBills],
    ['Total Units Sold', data.summary.totalQuantitySold],
    ['Average Ticket Value (INR)', data.summary.avgTicketValue.toFixed(2)],
    ['GST 5% Tax (INR)', data.summary.gstCollected.toFixed(2)],
    ['Material Inward Valuation (INR)', data.summary.totalInboundCost.toFixed(2)],
    ['Total GRN Notes', data.summary.totalInboundNotes],
    ['Total Inbound Units Stocked', data.summary.totalQuantityInbound],
    [],
    ['--- POS SALES TRANSACTIONS ---'],
    ['Order Number', 'Date & Time', 'Customer Name', 'Payment Mode', 'Sales Tag', 'Items Count', 'Total Paid (INR)'],
    ...data.orders.map(o => [
      o.orderNumber,
      `"${o.timestamp}"`,
      `"${o.customerName.replace(/"/g, '""')}"`,
      o.paymentMethod.toUpperCase(),
      `"${o.salesTag}"`,
      o.itemsCount,
      o.total.toFixed(2)
    ]),
    [],
    ['--- MATERIAL INWARD SHIPMENTS (GRN) ---'],
    ['GRN Number', 'Invoice Date', 'Vendor / Supplier', 'Warehouse Zone', 'Items Received (pcs)', 'Valuation (INR)'],
    ...data.inwardNotes.map(n => [
      n.grnNumber,
      `"${n.invoiceDate}"`,
      `"${n.vendorName.replace(/"/g, '""')}"`,
      `"${n.warehouse}"`,
      n.itemsCount,
      n.totalValue.toFixed(2)
    ])
  ];

  const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ISKCON_BI_Analytics_${data.startDate}_to_${data.endDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface BarcodeExportItem {
  sku: string;
  productName: string;
  barcodeValue: string;
  batchNo?: string;
  grnNumber?: string;
  sellingPrice?: number;
  purchaseCost?: number;
  quantity?: number;
  branchName?: string;
  template?: 'retail_tag_1x2' | 'shelf_label_2x3' | 'jewelry_hangtag' | 'box_shipping_4x6' | string;
}

export interface BarcodePdfOptions {
  title?: string;
  orgName?: string;
  repeatByQuantity?: boolean;
  layout?: 'standard' | 'shelf' | 'jewel';
  filename?: string;
}

/**
 * Renders a barcode value onto an in-memory canvas and returns a high-resolution PNG data URL
 */
function getBarcodePngDataUrl(value: string, format = 'auto'): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const barcodeVal = String(value || '8901234002039').trim();

  let detectedFormat = format;
  if (format === 'auto') {
    if (/^\d{13}$/.test(barcodeVal)) {
      detectedFormat = 'EAN13';
    } else if (/^\d{8}$/.test(barcodeVal)) {
      detectedFormat = 'EAN8';
    } else if (/^\d{12}$/.test(barcodeVal)) {
      detectedFormat = 'UPC';
    } else {
      detectedFormat = 'CODE128';
    }
  }

  try {
    JsBarcode(canvas, barcodeVal, {
      format: detectedFormat as any,
      width: 2,
      height: 48,
      displayValue: true,
      fontSize: 12,
      font: 'monospace',
      margin: 4,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
  } catch {
    try {
      JsBarcode(canvas, barcodeVal, {
        format: 'CODE128',
        width: 2,
        height: 48,
        displayValue: true,
        fontSize: 12,
        font: 'monospace',
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }
}

/**
 * Export high-resolution printable barcode label sheets to PDF
 */
export function exportBarcodesToPdf(
  items: BarcodeExportItem[],
  options?: BarcodePdfOptions
) {
  if (!items || items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const orgName = options?.orgName || 'ISKCON FOUNDATION';
  const layout = options?.layout || 'standard';
  const repeatByQuantity = options?.repeatByQuantity ?? false;

  // Flatten items if repeating by quantity
  const flattened: BarcodeExportItem[] = [];
  items.forEach(item => {
    const count = repeatByQuantity && item.quantity && item.quantity > 0 ? Number(item.quantity) : 1;
    for (let i = 0; i < count; i++) {
      flattened.push(item);
    }
  });

  if (layout === 'shelf') {
    // 2 columns x 3 rows = 6 shelf tags per page
    const colWidth = 92;
    const rowHeight = 84;
    const marginX = 13;
    const marginY = 18;
    const spacingX = 8;
    const spacingY = 8;
    const itemsPerPage = 6;

    flattened.forEach((item, index) => {
      const pageIndex = index % itemsPerPage;
      if (index > 0 && pageIndex === 0) {
        doc.addPage();
      }

      const col = pageIndex % 2;
      const row = Math.floor(pageIndex / 2);
      const x = marginX + col * (colWidth + spacingX);
      const y = marginY + row * (rowHeight + spacingY);

      // Card outer border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, colWidth, rowHeight, 3, 3, 'S');

      // Top Header
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(x, y, colWidth, 9, 3, 3, 'F');
      doc.rect(x, y + 5, colWidth, 4, 'F'); // square bottom edges
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(orgName, x + 4, y + 6);
      if (item.grnNumber) {
        doc.setFontSize(6.5);
        doc.setTextColor(245, 158, 11);
        doc.text(item.grnNumber, x + colWidth - 4, y + 6, { align: 'right' });
      }

      // Product Title
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(item.productName, colWidth - 8);
      doc.text(titleLines.slice(0, 2), x + 4, y + 15);

      // Prominent Retail Price
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      const priceText = item.sellingPrice ? `₹${Number(item.sellingPrice).toFixed(2)}` : 'MRP INCL. TAX';
      doc.text(priceText, x + 4, y + 27);

      // Barcode Image
      const barcodeDataUrl = getBarcodePngDataUrl(item.barcodeValue);
      if (barcodeDataUrl) {
        doc.addImage(barcodeDataUrl, 'PNG', x + (colWidth - 72) / 2, y + 31, 72, 28);
      }

      // Metadata Footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.line(x + 4, y + rowHeight - 16, x + colWidth - 4, y + rowHeight - 16);
      doc.text(`SKU: ${item.sku}`, x + 4, y + rowHeight - 10);
      doc.text(`BATCH: ${item.batchNo || 'N/A'}`, x + 4, y + rowHeight - 5);
      if (item.purchaseCost) {
        doc.text(`COST: ₹${Number(item.purchaseCost).toFixed(2)}`, x + colWidth - 4, y + rowHeight - 10, { align: 'right' });
      }
      doc.text(item.barcodeValue, x + colWidth - 4, y + rowHeight - 5, { align: 'right' });
    });
  } else if (layout === 'jewel') {
    // 3 columns x 8 rows = 24 jewel/mini hangtags per page
    const colWidth = 58;
    const rowHeight = 31;
    const marginX = 12;
    const marginY = 14;
    const spacingX = 6;
    const spacingY = 5;
    const itemsPerPage = 24;

    flattened.forEach((item, index) => {
      const pageIndex = index % itemsPerPage;
      if (index > 0 && pageIndex === 0) {
        doc.addPage();
      }

      const col = pageIndex % 3;
      const row = Math.floor(pageIndex / 3);
      const x = marginX + col * (colWidth + spacingX);
      const y = marginY + row * (rowHeight + spacingY);

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, colWidth, rowHeight, 2, 2, 'S');

      // Top Mini Header
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(orgName.slice(0, 18), x + 3, y + 4.5);
      doc.setTextColor(16, 185, 129);
      doc.text(item.sellingPrice ? `₹${Number(item.sellingPrice).toFixed(0)}` : '', x + colWidth - 3, y + 4.5, { align: 'right' });

      // Title
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      const titleLines = doc.splitTextToSize(item.productName, colWidth - 6);
      doc.text(titleLines[0] || item.productName, x + 3, y + 8.5);

      // Barcode
      const barcodeDataUrl = getBarcodePngDataUrl(item.barcodeValue);
      if (barcodeDataUrl) {
        doc.addImage(barcodeDataUrl, 'PNG', x + (colWidth - 50) / 2, y + 10, 50, 14);
      }

      // Footer
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`SKU: ${item.sku.slice(0, 14)}`, x + 3, y + rowHeight - 2.5);
      doc.text(`BAT: ${item.batchNo ? item.batchNo.slice(-10) : 'N/A'}`, x + colWidth - 3, y + rowHeight - 2.5, { align: 'right' });
    });
  } else {
    // Standard 1" x 2" label: 2 columns x 5 rows = 10 labels per page
    const colWidth = 92;
    const rowHeight = 51;
    const marginX = 13;
    const marginY = 16;
    const spacingX = 8;
    const spacingY = 6;
    const itemsPerPage = 10;

    flattened.forEach((item, index) => {
      const pageIndex = index % itemsPerPage;
      if (index > 0 && pageIndex === 0) {
        doc.addPage();
      }

      const col = pageIndex % 2;
      const row = Math.floor(pageIndex / 2);
      const x = marginX + col * (colWidth + spacingX);
      const y = marginY + row * (rowHeight + spacingY);

      // Label border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, colWidth, rowHeight, 2.5, 2.5, 'S');

      // Top Header
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(orgName, x + 4, y + 6);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      const priceText = item.sellingPrice ? `₹${Number(item.sellingPrice).toFixed(2)}` : 'MRP';
      doc.text(priceText, x + colWidth - 4, y + 6, { align: 'right' });

      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(x + 4, y + 8, x + colWidth - 4, y + 8);

      // Product Title
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(item.productName, colWidth - 8);
      doc.text(titleLines.slice(0, 2), x + 4, y + 13);

      // Barcode
      const barcodeDataUrl = getBarcodePngDataUrl(item.barcodeValue);
      if (barcodeDataUrl) {
        doc.addImage(barcodeDataUrl, 'PNG', x + (colWidth - 70) / 2, y + 17, 70, 22);
      }

      // Bottom Metadata Row
      doc.setDrawColor(226, 232, 240);
      doc.line(x + 4, y + rowHeight - 8, x + colWidth - 4, y + rowHeight - 8);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`SKU: ${item.sku}`, x + 4, y + rowHeight - 3);

      const batchAndGrn = [
        item.batchNo ? `BAT: ${item.batchNo}` : null,
        item.grnNumber ? `GRN: ${item.grnNumber}` : null
      ].filter(Boolean).join(' • ');

      doc.text(batchAndGrn || item.barcodeValue, x + colWidth - 4, y + rowHeight - 3, { align: 'right' });
    });
  }

  const cleanFilename = (options?.filename || `Barcode_Labels_${new Date().toISOString().slice(0, 10)}.pdf`).replace(/[^a-zA-Z0-9_.-]/g, '_');
  doc.save(cleanFilename);
}

/**
 * Export Material Inward Note (GRN) as an official PDF voucher
 */
export function exportGrnToPdf(note: MaterialInwardNote) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const darkSlate = [15, 23, 42];

  // Header Banner
  doc.setFillColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ISKCON RETAIL ERP', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(245, 158, 11);
  doc.text('GOODS RECEIVED NOTE (GRN) / INWARD VOUCHER', 14, 18);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 140, 18);

  // Meta Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 32, 182, 30, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`GRN: ${note.grnNumber}`, 18, 40);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Supplier: ${note.vendorName}`, 18, 47);
  doc.text(`PO Number: ${note.poNumber}`, 18, 54);

  doc.text(`Invoice Date: ${note.invoiceDate}`, 115, 40);
  doc.text(`Warehouse Zone: ${note.warehouse}`, 115, 47);
  doc.text(`Received By: ${note.receivedBy || 'Staff'}`, 115, 54);

  // Table Data
  const tableRows = (note.items || []).map((item, idx) => [
    (idx + 1).toString(),
    item.sku,
    item.name,
    item.quantity.toString(),
    `₹ ${Number(item.unitCost).toFixed(2)}`,
    `₹ ${Number(item.total).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 68,
    head: [['#', 'SKU', 'Description', 'Qty', 'Unit Cost', 'Total Amount']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 70 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 150;

  // Total Summary Row
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(120, finalY + 6, 76, 12, 1, 1, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total Valuation: ₹ ${Number(note.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    124,
    finalY + 14
  );

  // Signatures
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.line(18, finalY + 45, 75, finalY + 45);
  doc.text('Store Executive Signature', 18, finalY + 50);

  doc.line(135, finalY + 45, 192, finalY + 45);
  doc.text('Authorized Receiver Signature', 135, finalY + 50);

  const cleanFilename = `${note.grnNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_Receipt.pdf`;
  doc.save(cleanFilename);
}


