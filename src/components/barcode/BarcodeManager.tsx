'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useERP } from '../../context/ERPContext';
import { BarcodeView } from './BarcodeView';
import { Product, BarcodeRecord } from '../../types';
import {
  QrCode,
  Printer,
  Barcode as BarcodeIcon,
  Tag,
  Search,
  CheckCircle2,
  Copy,
  Layers,
  Sparkles,
  Download,
  ChevronDown,
  Check,
  Filter,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Boxes,
  RefreshCw,
  IndianRupee,
  Package,
  X,
  ExternalLink,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import {
  printHtmlDocument,
  buildProductLabelsHtml,
  buildBulkLabelsHtml,
  buildBarcodeRecordsLabelsHtml
} from '../../lib/printUtils';
import { exportBarcodesToPdf } from '../../lib/exportUtils';

interface ProductSearchComboboxProps {
  selectedProductId: string;
  onSelect: (product: Product) => void;
  branchId?: string;
}

const ProductSearchCombobox: React.FC<ProductSearchComboboxProps> = ({
  selectedProductId,
  onSelect,
  branchId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProd, setSelectedProd] = useState<Product | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const queryParam = searchTerm.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : '';
        const branchParam = branchId && branchId !== '*' ? `&branchId=${branchId}` : '';
        const res = await fetch(`/api/products?limit=8${queryParam}${branchParam}`).then(r => r.json());
        if (res.success && Array.isArray(res.products)) {
          setResults(res.products.slice(0, 8));
        } else {
          setResults([]);
        }
      } catch (err) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, branchId]);

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0 text-left">
          <Tag className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="truncate">
            {selectedProd
              ? `${selectedProd.sku} — ${selectedProd.name} (₹${Number(selectedProd.price).toFixed(2)})`
              : 'Search & select product SKU...'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type product name, SKU, or category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-mono"
            />
            {isLoading && <span className="text-[10px] font-mono text-rose-500 animate-pulse shrink-0">Searching...</span>}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5">
            {results.length > 0 ? (
              results.map(p => {
                const isSelected = p.id === selectedProductId;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProd(p);
                      onSelect(p);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{p.sku}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-500">{p.category}</span>
                      </div>
                      <p className="truncate font-semibold mt-0.5">{p.name}</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="font-bold">₹{Number(p.price).toFixed(2)}</span>
                      <p className="text-[10px] text-slate-400">{p.stock} in stock</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                <p>No matching products found for "{searchTerm}"</p>
                <span className="text-[10px] text-slate-500 mt-1 block font-mono">Try searching by SKU or product title</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const BarcodeManager: React.FC = () => {
  const {
    products,
    barcodes,
    addBarcodeRecord,
    quickNotification,
    settings,
    currentBranch,
    inwardNotes,
    batches
  } = useERP();

  // 1. Two Primary Views: 'batch_grn' | 'single_sku'
  const [activeView, setActiveView] = useState<'batch_grn' | 'single_sku'>('batch_grn');

  // Single SKU Generator State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);
  const [stickerType, setStickerType] = useState<'standard' | 'shelf' | 'jewel'>('standard');
  const [printCount, setPrintCount] = useState(24);
  const [customSerial, setCustomSerial] = useState('ISK-2026-8849');
  const [isPrinting, setIsPrinting] = useState(false);

  // Batch & GRN Bulk Manager State
  const [selectedGrnFilter, setSelectedGrnFilter] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedBarcodeIds, setSelectedBarcodeIds] = useState<string[]>([]);
  const [repeatByQuantity, setRepeatByQuantity] = useState<boolean>(true);
  const [customPrintQuantities, setCustomPrintQuantities] = useState<Record<string, number>>({});
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  // Requirement 3: Check sessionStorage for active_grn_filter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeGrn = sessionStorage.getItem('active_grn_filter');
      if (activeGrn) {
        setSelectedGrnFilter(activeGrn);
        setActiveView('batch_grn');
        // Auto-select all barcodes that correspond to this GRN
        const matchingIds = barcodes
          .filter(b => b.grnNumber === activeGrn)
          .map(b => b.id);

        if (matchingIds.length > 0) {
          setSelectedBarcodeIds(matchingIds);
        }

        quickNotification(
          'GRN Barcodes Auto-Loaded',
          `Viewing batch barcodes generated for ${activeGrn}. Ready for print or PDF export.`,
          'info'
        );
      }
    }
  }, [barcodes.length]);

  // When products change or selected product changes in Single SKU
  const selectedProd = selectedProduct || products[0] || {
    id: 'prod-fallback',
    sku: 'SKU-001',
    name: 'Devotional Book Item',
    price: 350,
    cost: 200,
    stock: 100,
    minStock: 10,
    warehouseZone: 'Main Warehouse',
    batchNo: 'ISK-2026-001',
    barcode: '8901234002039',
    category: 'Books & Scriptures',
    status: 'in_stock',
    lastUpdated: new Date().toISOString()
  };

  useEffect(() => {
    if (selectedProd && selectedProd.batchNo) {
      setCustomSerial(selectedProd.batchNo);
    }
  }, [selectedProd?.id]);

  // Combine and consolidate all printable barcode items (from barcodes records and inward items fallback)
  const allPrintableBarcodes: BarcodeRecord[] = useMemo(() => {
    // If barcodes array has entries, use them as primary
    if (barcodes && barcodes.length > 0) {
      return barcodes;
    }
    // Fallback: build barcode records dynamically from inwardNotes and products
    const derived: BarcodeRecord[] = [];
    inwardNotes.forEach(note => {
      note.items.forEach((item, idx) => {
        const prod = products.find(p => p.sku === item.sku);
        derived.push({
          id: `derived-bar-${note.id}-${idx}`,
          sku: item.sku,
          productName: item.name,
          barcodeValue: prod?.barcode || `890${Math.abs(item.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 1000).toString().slice(0, 10)}`,
          format: 'code128',
          template: 'retail_tag_1x2',
          generatedAt: note.timestamp || new Date().toISOString(),
          batchNo: item.batchNo || `BAT-${note.grnNumber}`,
          grnNumber: note.grnNumber,
          purchaseCost: item.unitCost,
          sellingPrice: item.sellingPrice || (prod?.price || item.unitCost * 1.5),
          printCount: item.quantity,
          branchId: note.branchId,
          branchName: note.branchName
        });
      });
    });
    return derived;
  }, [barcodes, inwardNotes, products]);

  // Filtered barcodes for Batch & GRN Bulk Manager table
  const filteredBarcodes = useMemo(() => {
    return allPrintableBarcodes.filter(b => {
      const matchesGrn = selectedGrnFilter === 'all' || b.grnNumber === selectedGrnFilter;
      const matchesBatch = selectedBatchFilter === 'all' || b.batchNo === selectedBatchFilter;
      const matchesSearch =
        searchFilter.trim() === '' ||
        b.sku.toLowerCase().includes(searchFilter.toLowerCase()) ||
        b.productName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        b.barcodeValue.includes(searchFilter) ||
        (b.grnNumber && b.grnNumber.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (b.batchNo && b.batchNo.toLowerCase().includes(searchFilter.toLowerCase()));

      return matchesGrn && matchesBatch && matchesSearch;
    });
  }, [allPrintableBarcodes, selectedGrnFilter, selectedBatchFilter, searchFilter]);

  // Helper to get effective print quantity for a barcode record
  const getBarcodePrintQty = (b: BarcodeRecord): number => {
    if (customPrintQuantities[b.id] !== undefined) {
      return customPrintQuantities[b.id];
    }
    // If repeatByQuantity is enabled, default to the inward printCount/quantity
    return repeatByQuantity ? (b.printCount || 1) : 1;
  };

  const setBarcodePrintQty = (bId: string, qty: number) => {
    setCustomPrintQuantities(prev => ({
      ...prev,
      [bId]: Math.max(1, qty)
    }));
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedBarcodeIds.length === filteredBarcodes.length) {
      setSelectedBarcodeIds([]);
    } else {
      setSelectedBarcodeIds(filteredBarcodes.map(b => b.id));
    }
  };

  const toggleBarcodeSelection = (id: string) => {
    if (selectedBarcodeIds.includes(id)) {
      setSelectedBarcodeIds(selectedBarcodeIds.filter(i => i !== id));
    } else {
      setSelectedBarcodeIds([...selectedBarcodeIds, id]);
    }
  };

  // Total labels in selected set
  const totalSelectedLabelsCount = useMemo(() => {
    return filteredBarcodes
      .filter(b => selectedBarcodeIds.includes(b.id))
      .reduce((sum, b) => sum + getBarcodePrintQty(b), 0);
  }, [filteredBarcodes, selectedBarcodeIds, customPrintQuantities, repeatByQuantity]);

  // Handle Bulk Printing from Batch & GRN Manager
  const handleBulkPrintFromTable = () => {
    const itemsToPrint = filteredBarcodes.filter(b => selectedBarcodeIds.includes(b.id));
    if (itemsToPrint.length === 0) {
      quickNotification('Selection Required', 'Please select at least one barcode item to print.', 'alert');
      return;
    }

    setIsPrinting(true);
    const quantitiesMap: Record<string, number> = {};
    itemsToPrint.forEach(b => {
      quantitiesMap[b.id] = getBarcodePrintQty(b);
    });

    const html = buildBarcodeRecordsLabelsHtml(
      itemsToPrint.map(b => ({
        id: b.id,
        sku: b.sku,
        productName: b.productName,
        barcodeValue: b.barcodeValue,
        batchNo: b.batchNo,
        grnNumber: b.grnNumber,
        sellingPrice: b.sellingPrice,
        purchaseCost: b.purchaseCost
      })),
      quantitiesMap,
      settings?.orgName || 'ISKCON FOUNDATION',
      stickerType
    );

    printHtmlDocument(html, `Bulk_Barcodes_${itemsToPrint.length}_Items`);
    quickNotification(
      'Thermal Print Dispatched',
      `Sent ${totalSelectedLabelsCount} barcode labels for ${itemsToPrint.length} batches to printer.`,
      'success'
    );

    setTimeout(() => setIsPrinting(false), 800);
  };

  // Handle Bulk PDF Export from Batch & GRN Manager
  const handleBulkExportPdf = () => {
    const itemsToExport = filteredBarcodes.filter(b => selectedBarcodeIds.includes(b.id));
    if (itemsToExport.length === 0) {
      quickNotification('Selection Required', 'Please select at least one barcode item for PDF export.', 'alert');
      return;
    }

    const exportData = itemsToExport.map(b => ({
      sku: b.sku,
      productName: b.productName,
      barcodeValue: b.barcodeValue,
      batchNo: b.batchNo,
      grnNumber: b.grnNumber,
      purchaseCost: b.purchaseCost,
      sellingPrice: b.sellingPrice,
      quantity: getBarcodePrintQty(b)
    }));

    exportBarcodesToPdf(exportData, {
      title: 'GRN Batch Barcodes Export',
      orgName: settings?.orgName || 'ISKCON FOUNDATION',
      repeatByQuantity: true,
      layout: stickerType,
      filename: `Barcodes_${selectedGrnFilter !== 'all' ? selectedGrnFilter : 'Bulk'}_${new Date().toISOString().slice(0, 10)}.pdf`
    });

    quickNotification(
      'PDF Export Downloaded',
      `Exported ${totalSelectedLabelsCount} printable stickers to PDF file.`,
      'success'
    );
  };

  // Single Item Print from Table
  const handleSingleItemPrint = (b: BarcodeRecord) => {
    const qty = getBarcodePrintQty(b);
    const html = buildBarcodeRecordsLabelsHtml(
      [{
        id: b.id,
        sku: b.sku,
        productName: b.productName,
        barcodeValue: b.barcodeValue,
        batchNo: b.batchNo,
        grnNumber: b.grnNumber,
        sellingPrice: b.sellingPrice,
        purchaseCost: b.purchaseCost
      }],
      { [b.id]: qty },
      settings?.orgName || 'ISKCON FOUNDATION',
      stickerType
    );

    printHtmlDocument(html, `Barcode_${b.sku}_x${qty}`);
    quickNotification('Print Dispatched', `Printed ${qty} labels for SKU ${b.sku}.`, 'success');
  };

  // Single Item PDF Export from Table
  const handleSingleItemPdf = (b: BarcodeRecord) => {
    const qty = getBarcodePrintQty(b);
    exportBarcodesToPdf(
      [{
        sku: b.sku,
        productName: b.productName,
        barcodeValue: b.barcodeValue,
        batchNo: b.batchNo,
        grnNumber: b.grnNumber,
        purchaseCost: b.purchaseCost,
        sellingPrice: b.sellingPrice,
        quantity: qty
      }],
      {
        orgName: settings?.orgName || 'ISKCON FOUNDATION',
        repeatByQuantity: true,
        layout: stickerType,
        filename: `Barcode_${b.sku}_${b.batchNo}.pdf`
      }
    );
    quickNotification('PDF Downloaded', `Exported barcode for SKU ${b.sku} to PDF.`, 'success');
  };

  // Single SKU Generator Print Handler
  const handleSingleSkuPrint = () => {
    setIsPrinting(true);
    addBarcodeRecord({
      sku: selectedProd?.sku || 'SKU-001',
      barcodeValue: selectedProd?.barcode || '8901234002039',
      productName: selectedProd?.name || 'Devotional Book Item',
      format: 'code128',
      template: (stickerType === 'standard' ? 'retail_tag_1x2' : stickerType === 'shelf' ? 'shelf_label_2x3' : 'jewelry_hangtag'),
      generatedAt: new Date().toISOString(),
      batchNo: customSerial,
      sellingPrice: selectedProd?.price,
      purchaseCost: selectedProd?.cost,
      printCount: printCount
    });

    quickNotification('Stickers Dispatched', `Sent ${printCount} barcode tags (${stickerType.toUpperCase()}) to thermal printer.`, 'success');

    const html = buildProductLabelsHtml(
      selectedProd,
      printCount,
      settings?.orgName || 'ISKCON FOUNDATION',
      customSerial
    );
    printHtmlDocument(html, `Barcode_Labels_${selectedProd.sku}`);

    setTimeout(() => setIsPrinting(false), 800);
  };

  // Single SKU Generator PDF Export Handler
  const handleSingleSkuPdf = () => {
    exportBarcodesToPdf(
      [{
        sku: selectedProd?.sku || 'SKU-001',
        productName: selectedProd?.name || 'Devotional Item',
        barcodeValue: selectedProd?.barcode || '8901234002039',
        batchNo: customSerial,
        purchaseCost: selectedProd?.cost,
        sellingPrice: selectedProd?.price,
        quantity: printCount
      }],
      {
        orgName: settings?.orgName || 'ISKCON FOUNDATION',
        repeatByQuantity: true,
        layout: stickerType,
        filename: `Barcode_${selectedProd.sku}_x${printCount}.pdf`
      }
    );
    quickNotification('PDF Exported', `Generated PDF with ${printCount} sticker labels for SKU ${selectedProd.sku}.`, 'success');
  };

  // Copy barcode to clipboard
  const copyBarcodeToClipboard = (val: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(val);
      setCopiedBarcode(val);
      setTimeout(() => setCopiedBarcode(null), 2000);
      quickNotification('Barcode Copied', `Copied barcode "${val}" to clipboard.`, 'info');
    }
  };

  // Clear GRN filter from sessionStorage and local state
  const handleClearGrnFilter = () => {
    setSelectedGrnFilter('all');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('active_grn_filter');
    }
  };

  // Distinct batches and GRNs for dropdowns
  const distinctGrnNumbers = useMemo(() => {
    const set = new Set<string>();
    inwardNotes.forEach(n => { if (n.grnNumber) set.add(n.grnNumber); });
    allPrintableBarcodes.forEach(b => { if (b.grnNumber) set.add(b.grnNumber); });
    return Array.from(set);
  }, [inwardNotes, allPrintableBarcodes]);

  const distinctBatchNumbers = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => { if (b.batchNo) set.add(b.batchNo); });
    allPrintableBarcodes.forEach(b => { if (b.batchNo) set.add(b.batchNo); });
    return Array.from(set);
  }, [batches, allPrintableBarcodes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Barcode & Label Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono text-[11px] font-bold border border-rose-500/20">
                EAN-13 & CODE-128
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
              MATERIAL INWARD INTEGRATION • BATCH-LEVEL PRICE TRACKING • THERMAL & PDF EXPORT
            </p>
          </div>
        </div>

        {/* Primary View Switch Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs shrink-0">
          <button
            onClick={() => setActiveView('batch_grn')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeView === 'batch_grn'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Batch & GRN Bulk Manager</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 text-[10px]">
              {allPrintableBarcodes.length}
            </span>
          </button>
          <button
            onClick={() => setActiveView('single_sku')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeView === 'single_sku'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Single SKU Generator</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Generated Barcodes</span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {allPrintableBarcodes.length} <span className="text-xs text-slate-400 font-normal">records</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <BarcodeIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inward GRN Batches</span>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {distinctGrnNumbers.length} <span className="text-xs text-slate-400 font-normal">shipments</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Inventory Batches</span>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              {distinctBatchNumbers.length} <span className="text-xs text-slate-400 font-normal">batches</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Workspace</span>
            <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 truncate max-w-[150px]">
              {currentBranch?.name || 'Mayapur HQ Central'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* VIEW 1: BATCH & GRN BULK MANAGER (`batch_grn`) */}
      {activeView === 'batch_grn' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Active GRN Filter Notice Banner (Seamless GRN Integration) */}
          {selectedGrnFilter !== 'all' && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    Filtered by Material Inward Note: <strong className="underline">{selectedGrnFilter}</strong>
                  </span>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                    Showing all barcodes generated during this specific GRN shipment. Select items below to batch-print or export to PDF.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    const idsInThisGrn = filteredBarcodes.map(b => b.id);
                    setSelectedBarcodeIds(idsInThisGrn);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Select All ({filteredBarcodes.length})
                </button>
                <button
                  onClick={handleClearGrnFilter}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold text-xs hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Filter</span>
                </button>
              </div>
            </div>
          )}

          {/* Filtering and Bulk Actions Toolbar */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 font-mono text-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-rose-500" />
                  <span>Shipment & Batch Barcode Registry</span>
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Filter by GRN Number, Batch, or SKU to bulk-print or export shipment barcode labels.
                </p>
              </div>

              {/* Quantity Multiplication & Layout Settings */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeatByQuantity}
                    onChange={e => setRepeatByQuantity(e.target.checked)}
                    className="accent-rose-500 w-4 h-4 rounded"
                  />
                  <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                    Repeat by Received Qty
                  </span>
                </label>

                {/* Template Dimension Selector */}
                <select
                  value={stickerType}
                  onChange={e => setStickerType(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="standard">1" x 2" Standard Retail Tag</option>
                  <option value="shelf">2" x 4" Shelf Talker Tag</option>
                  <option value="jewel">0.5" x 1.5" Mini / Jewel Tag</option>
                </select>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search SKU, item name, barcode..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <select
                  value={selectedGrnFilter}
                  onChange={e => setSelectedGrnFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="all">Filter by GRN ({distinctGrnNumbers.length} Shipments)</option>
                  {distinctGrnNumbers.map(grn => (
                    <option key={grn} value={grn}>
                      {grn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedBatchFilter}
                  onChange={e => setSelectedBatchFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="all">Filter by Batch ({distinctBatchNumbers.length} Batches)</option>
                  {distinctBatchNumbers.map(bat => (
                    <option key={bat} value={bat}>
                      {bat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkPrintFromTable}
                  disabled={selectedBarcodeIds.length === 0 || isPrinting}
                  className="flex-1 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print ({totalSelectedLabelsCount})</span>
                </button>
                <button
                  onClick={handleBulkExportPdf}
                  disabled={selectedBarcodeIds.length === 0}
                  className="flex-1 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF ({selectedBarcodeIds.length})</span>
                </button>
              </div>
            </div>

            {/* Selection Status Bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {selectedBarcodeIds.length} of {filteredBarcodes.length} items selected
                </span>
                {selectedBarcodeIds.length > 0 && (
                  <span className="text-rose-600 font-bold">
                    ({totalSelectedLabelsCount} total label stickers to be printed)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
                >
                  {selectedBarcodeIds.length === filteredBarcodes.length ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>
            </div>
          </div>

          {/* Barcode Registry Data Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs font-mono text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedBarcodeIds.length > 0 && selectedBarcodeIds.length === filteredBarcodes.length}
                        onChange={toggleSelectAll}
                        className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Barcode (Live Scan)</th>
                    <th className="p-3">SKU & Item Name</th>
                    <th className="p-3">GRN Origin</th>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Selling Price</th>
                    <th className="p-3 text-center">Print Qty</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredBarcodes.length > 0 ? (
                    filteredBarcodes.map(b => {
                      const isChecked = selectedBarcodeIds.includes(b.id);
                      const currentQty = getBarcodePrintQty(b);
                      const cost = b.purchaseCost || 0;
                      const price = b.sellingPrice || 0;
                      const marginPct = cost > 0 ? (((price - cost) / cost) * 100).toFixed(0) : '0';

                      return (
                        <tr
                          key={b.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            isChecked ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleBarcodeSelection(b.id)}
                              className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
                            />
                          </td>

                          {/* Visual Barcode & String */}
                          <td className="p-3">
                            <div className="flex flex-col items-start gap-1">
                              <div className="bg-white p-1 rounded border border-slate-200 shadow-2xs">
                                <BarcodeView
                                  value={b.barcodeValue}
                                  width={1.1}
                                  height={26}
                                  fontSize={9}
                                  displayValue={false}
                                />
                              </div>
                              <button
                                onClick={() => copyBarcodeToClipboard(b.barcodeValue)}
                                className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-rose-600 transition-colors cursor-pointer group"
                                title="Click to copy barcode"
                              >
                                <span>{b.barcodeValue}</span>
                                {copiedBarcode === b.barcodeValue ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* SKU & Product Name */}
                          <td className="p-3">
                            <div className="font-bold text-rose-600 dark:text-rose-400">{b.sku}</div>
                            <div className="text-slate-900 dark:text-white font-sans font-semibold text-xs truncate max-w-[220px]">
                              {b.productName}
                            </div>
                            {b.branchName && (
                              <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[180px]">
                                {b.branchName}
                              </span>
                            )}
                          </td>

                          {/* GRN Origin Badge */}
                          <td className="p-3">
                            {b.grnNumber ? (
                              <button
                                onClick={() => setSelectedGrnFilter(b.grnNumber!)}
                                className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[11px] border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
                                title="Filter by this GRN"
                              >
                                {b.grnNumber}
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Master Default</span>
                            )}
                          </td>

                          {/* Batch Number */}
                          <td className="p-3">
                            <button
                              onClick={() => setSelectedBatchFilter(b.batchNo)}
                              className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold text-[11px] border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
                              title="Filter by this batch"
                            >
                              {b.batchNo}
                            </button>
                          </td>

                          {/* Unit Purchase Cost */}
                          <td className="p-3 text-right">
                            <span className="text-slate-600 dark:text-slate-300">
                              ₹{Number(cost).toFixed(2)}
                            </span>
                          </td>

                          {/* Selling Price & Margin */}
                          <td className="p-3 text-right">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{Number(price).toFixed(2)}
                            </div>
                            {cost > 0 && (
                              <span className="text-[9px] text-slate-400 block">
                                +{marginPct}% margin
                              </span>
                            )}
                          </td>

                          {/* Quantity & Multiplier */}
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 gap-1 border border-slate-200 dark:border-slate-700">
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                value={currentQty}
                                onChange={e => setBarcodePrintQty(b.id, parseInt(e.target.value) || 1)}
                                className="w-12 bg-transparent text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400">pcs</span>
                            </div>
                            {b.printCount && b.printCount !== currentQty && (
                              <button
                                onClick={() => setBarcodePrintQty(b.id, b.printCount)}
                                className="text-[9px] text-rose-500 hover:underline block mt-0.5"
                                title="Reset to inward quantity received"
                              >
                                reset ({b.printCount})
                              </button>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSingleItemPrint(b)}
                                className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                title={`Print ${currentQty} stickers for ${b.sku}`}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleSingleItemPdf(b)}
                                className="p-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-600 dark:text-amber-400 rounded-lg transition-colors cursor-pointer"
                                title={`Download PDF for ${b.sku}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const prod = products.find(p => p.sku === b.sku);
                                  if (prod) setSelectedProduct(prod);
                                  setCustomSerial(b.batchNo);
                                  setPrintCount(currentQty);
                                  setActiveView('single_sku');
                                }}
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                                title="Open in Single SKU Generator"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 text-xs">
                        No batch barcodes found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SINGLE SKU GENERATOR (`single_sku`) */}
      {activeView === 'single_sku' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200 font-mono">
          {/* Left Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-rose-500" />
                  <span>On-Demand Single SKU Generator</span>
                </h2>
                <span className="text-[11px] text-slate-400">Custom count & label format</span>
              </div>

              {/* Product SKU Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase">1. Product Catalog Target</label>
                <ProductSearchCombobox
                  selectedProductId={selectedProd.id}
                  onSelect={p => setSelectedProduct(p)}
                  branchId={currentBranch?.id}
                />
              </div>

              {/* Barcode & Batch Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Assigned Barcode Value</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedProd?.barcode || '8901234002039'}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 border border-transparent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Batch Number / Serial</label>
                  <input
                    type="text"
                    value={customSerial}
                    onChange={e => setCustomSerial(e.target.value)}
                    placeholder="e.g. BAT-2026-001"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Label Layout Formats */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-xs text-slate-400 uppercase">2. Sticker Dimensions & Format</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'standard', name: '1" x 2" Standard Tag', desc: 'Books, Apparel & Retail items' },
                    { id: 'shelf', name: '2" x 4" Shelf Label', desc: 'Aisle headers & Shelf display' },
                    { id: 'jewel', name: '0.5" x 1.5" Mini Tag', desc: 'Japa Mala, Beads & Small Deities' }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setStickerType(type.id as any)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        stickerType === type.id
                          ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs font-bold">{type.name}</span>
                      <span className="text-[10px] text-slate-400 mt-1">{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity to Print */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">3. Quantity to Print</label>
                  <span className="font-bold text-rose-500 text-sm">{printCount} stickers</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="200"
                  step="1"
                  value={printCount}
                  onChange={e => setPrintCount(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <button onClick={() => setPrintCount(4)} className="hover:text-rose-500 cursor-pointer">4 (1 row)</button>
                  <button onClick={() => setPrintCount(12)} className="hover:text-rose-500 cursor-pointer">12</button>
                  <button onClick={() => setPrintCount(24)} className="hover:text-rose-500 cursor-pointer">24 (1 sheet)</button>
                  <button onClick={() => setPrintCount(50)} className="hover:text-rose-500 cursor-pointer">50</button>
                  <button onClick={() => setPrintCount(100)} className="hover:text-rose-500 cursor-pointer">100 (bulk)</button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSingleSkuPrint}
                  disabled={isPrinting}
                  className="flex-1 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print {printCount} Labels to Thermal</span>
                </button>
                <button
                  onClick={handleSingleSkuPdf}
                  className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF Sheet</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Live Sticker Preview (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Sticker Live Preview</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                  {stickerType} layout
                </span>
              </div>

              {/* Live Preview Card */}
              <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-xl flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-800">
                <div
                  className={`bg-white text-black p-4 rounded-lg border-2 border-black shadow-lg transition-all ${
                    stickerType === 'shelf'
                      ? 'w-[280px] min-h-[220px]'
                      : stickerType === 'jewel'
                      ? 'w-[200px] min-h-[110px] text-[10px]'
                      : 'w-[240px] min-h-[140px]'
                  } flex flex-col justify-between`}
                >
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[11px] font-bold">
                    <span>{settings?.orgName || 'ISKCON FOUNDATION'}</span>
                    <span className="text-emerald-700 font-extrabold">₹{Number(selectedProd.price).toFixed(2)}</span>
                  </div>

                  <div className="py-1">
                    <p className={`font-sans font-bold text-black ${stickerType === 'jewel' ? 'text-[10px]' : 'text-xs'} line-clamp-2`}>
                      {selectedProd.name}
                    </p>
                  </div>

                  <div className="py-2 flex justify-center">
                    <BarcodeView
                      value={selectedProd.barcode || '8901234002039'}
                      width={stickerType === 'jewel' ? 1.0 : stickerType === 'shelf' ? 1.6 : 1.3}
                      height={stickerType === 'jewel' ? 24 : stickerType === 'shelf' ? 42 : 34}
                      fontSize={stickerType === 'jewel' ? 8 : 10}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-[9px] text-slate-600">
                    <span>SKU: {selectedProd.sku}</span>
                    <span>BAT: {customSerial}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Target Printer:</span>
                  <strong className="text-slate-800 dark:text-slate-200">Thermal Roll / 2x4 A4 Sheets</strong>
                </div>
                <div className="flex justify-between">
                  <span>Product Category:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{selectedProd.category}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Current Stock:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{selectedProd.stock} units</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
