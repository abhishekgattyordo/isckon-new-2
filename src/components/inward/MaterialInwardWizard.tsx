'use client';

import React, { useState, useMemo } from 'react';
import { useERP } from '@/context/ERPContext';
import { InwardItem, MaterialInwardNote, Supplier, SupplierPaymentTerms } from '@/types';
import { BarcodeView } from '../barcode/BarcodeView';
import { DynamicShipmentItemsTable } from './DynamicShipmentItemsTable';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Calendar,
  Warehouse,
  QrCode,
  Printer,
  Barcode as BarcodeIcon,
  Check,
  IndianRupee,
  Search,
  Filter,
  Eye,
  AlertCircle,
  X,
  Package,
  Layers,
  Download,
  Copy
} from 'lucide-react';
import { printHtmlDocument, buildProductLabelsHtml } from '../../lib/printUtils';
import { exportBarcodesToPdf } from '../../lib/exportUtils';

export const MaterialInwardWizard: React.FC = () => {
  const { products, zones, inwardNotes, addInwardNote, user, setActiveModule, quickNotification, currentBranch, settings, suppliers, addSupplier } = useERP();
  
  // List-First Page View State
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Selected GRN for viewing details
  const [viewingGrn, setViewingGrn] = useState<MaterialInwardNote | null>(null);

  // Wizard Creation States
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [vendorName, setVendorName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedZone, setSelectedZone] = useState(zones[0]?.name || 'Zone A — Main Retail Floor');
  const [grnNotes, setGrnNotes] = useState('');

  // Supplier Dropdown & Inline "+ Add Supplier" Modal States
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: '',
    category: 'Books & Vedic Literature',
    contactPerson: '',
    phone: '',
    email: '',
    paymentTerms: 'Net 30' as SupplierPaymentTerms,
    gstin: ''
  });

  // Dynamic Items
  const [items, setItems] = useState<InwardItem[]>([]);
  const [autoPrintLabels, setAutoPrintLabels] = useState(true);
  const [generatedGrnNumber, setGeneratedGrnNumber] = useState('');

  // Filtered GRNs list for List view
  const filteredGrns = useMemo(() => {
    return inwardNotes.filter(n => {
      const matchesSearch =
        n.grnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.warehouse.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesZone = zoneFilter === 'all' || n.warehouse === zoneFilter;
      const matchesStatus = statusFilter === 'all' || n.status === statusFilter;

      return matchesSearch && matchesZone && matchesStatus;
    });
  }, [inwardNotes, searchQuery, zoneFilter, statusFilter]);

  const totalPages = Math.ceil(filteredGrns.length / rowsPerPage) || 1;
  const paginatedGrns = filteredGrns.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const totalGrnValue = items.reduce((acc, i) => acc + i.total, 0);
  const totalUnits = items.reduce((acc, i) => acc + Number(i.quantity), 0);

  // Overall stats for top bento cards
  const totalGrnsCount = inwardNotes.length;
  const totalInwardValuation = inwardNotes.reduce((sum, n) => sum + Number(n.totalValue || 0), 0);
  const totalUnitsStocked = inwardNotes.reduce((sum, n) => sum + (n.items?.reduce((s, i) => s + Number(i.quantity), 0) || 0), 0);
  const uniqueVendorsCount = new Set(inwardNotes.map(n => n.vendorName)).size;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCompleteGrn = async () => {
    if (isSubmitting) return;
    if (!vendorName.trim()) {
      quickNotification('Validation Error', 'Vendor Name is mandatory.', 'alert');
      return;
    }
    if (!poNumber.trim()) {
      quickNotification('Validation Error', 'PO Number is mandatory.', 'alert');
      return;
    }
    if (items.length === 0 || items.some(i => !i.sku || Number(i.quantity) <= 0)) {
      quickNotification('Validation Error', 'Please ensure all items have a valid product SKU and quantity greater than 0.', 'alert');
      return;
    }

    setIsSubmitting(true);
    try {
      const grnNo = `GRN-${currentBranch?.code || 'HQ'}-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      setGeneratedGrnNumber(grnNo);

      await addInwardNote({
        grnNumber: grnNo,
        poNumber: poNumber.trim(),
        vendorName: vendorName.trim(),
        invoiceDate: invoiceDate,
        warehouse: selectedZone,
        branchId: currentBranch?.id || 'branch-mayapur-hq',
        branchName: currentBranch?.name || 'Mayapur HQ Central',
        items: items,
        status: 'completed',
        totalValue: totalGrnValue,
        receivedBy: user?.name || 'Store Operator',
        timestamp: new Date().toISOString(),
        notes: grnNotes
      });

      if (autoPrintLabels) {
        quickNotification('Barcode Stickers Sent to Printer', `Dispatched ${totalUnits} serialized tags to terminal printer.`, 'info');
      }

      setStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner Header & ADD NEW GRN Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Material Inward Notes (GRN)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono text-[11px] font-bold">
                {totalGrnsCount} REGISTERED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
              GOODS RECEIVED NOTES • INWARD INVENTORY • BATCH BARCODE REGISTRY
            </p>
          </div>
        </div>

        {viewMode === 'list' ? (
          <button
            onClick={() => {
              setStep(1);
              setVendorName('');
              setPoNumber('');
              setGrnNotes('');
              setItems([]);
              setViewMode('create');
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D97706] hover:bg-[#b45309] text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer font-mono shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ ADD NEW GRN</span>
          </button>
        ) : (
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors font-mono cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>&larr; BACK TO GRN LIST</span>
          </button>
        )}
      </div>

      {/* VIEW MODE: LIST PAGE */}
      {viewMode === 'list' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 4 Bento KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Total GRNs</span>
                <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {totalGrnsCount} <span className="text-xs text-slate-400 font-normal">vouchers</span>
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Inward Valuation</span>
                <IndianRupee className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                  ₹{totalInwardValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Total Units Received</span>
                <Package className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {totalUnitsStocked} <span className="text-xs text-slate-400 font-normal">items stocked</span>
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Active Suppliers</span>
                <Building2 className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {uniqueVendorsCount} <span className="text-xs text-slate-400 font-normal">publishers & vendors</span>
                </span>
              </div>
            </div>
          </div>

          {/* Filters Bar matching screenshot */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
            {/* Search Input */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search GRN / PO / Vendor / SKU</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search GRN number, PO#, vendor..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                />
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range Filter</label>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              >
                <option value="all">All Dates Available</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </select>
            </div>

            {/* Warehouse Zone Filter */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Warehouse Zone</label>
              <select
                value={zoneFilter}
                onChange={e => setZoneFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              >
                <option value="all">All Zones ({zones.length})</option>
                {zones.map(z => (
                  <option key={z.id} value={z.name}>{z.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending_qc">Pending QC</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* GRN Table matching screenshot */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono h-12">
                    <th className="py-3 px-5">GRN NUMBER</th>
                    <th className="py-3 px-4">INVOICE DATE</th>
                    <th className="py-3 px-4">SUPPLIER / VENDOR</th>
                    <th className="py-3 px-4">PO & ZONE</th>
                    <th className="py-3 px-4">ITEMS RECEIVED</th>
                    <th className="py-3 px-4 text-right">TOTAL VALUATION</th>
                    <th className="py-3 px-5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {paginatedGrns.length > 0 ? (
                    paginatedGrns.map(note => {
                      const totalQty = note.items?.reduce((s, i) => s + Number(i.quantity), 0) || 0;
                      return (
                        <tr key={note.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors font-mono">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-700 dark:text-amber-400">{note.grnNumber}</span>
                              <button
                                title="Copy GRN Number"
                                onClick={() => {
                                  navigator.clipboard.writeText(note.grnNumber);
                                  quickNotification('Copied', `Copied ${note.grnNumber} to clipboard.`, 'info');
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold">
                              {note.status.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{note.invoiceDate}</div>
                            <div className="text-[10px] text-slate-400">{note.timestamp ? new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{note.vendorName}</div>
                            <div className="text-[10px] text-slate-500">Received by: {note.receivedBy || 'Store Staff'}</div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">PO: {note.poNumber}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{note.warehouse}</div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{note.items?.length || 0} SKUs</div>
                            <div className="text-[10px] text-slate-400">({totalQty} total pcs)</div>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                              ₹{Number(note.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>

                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setViewingGrn(note)}
                                title="View Details"
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (typeof window !== 'undefined') {
                                    sessionStorage.setItem('active_grn_filter', note.grnNumber);
                                  }
                                  setActiveModule('barcode');
                                }}
                                title="Manage & Print Barcodes for this GRN"
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              >
                                <BarcodeIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const html = buildProductLabelsHtml(
                                    { sku: note.items?.[0]?.sku || 'SKU', name: note.items?.[0]?.name || 'Item', price: note.items?.[0]?.sellingPrice || 100 } as any,
                                    note.items?.[0]?.quantity || 1,
                                    note.vendorName,
                                    note.grnNumber
                                  );
                                  printHtmlDocument(html, note.grnNumber);
                                }}
                                title="Quick Print Labels"
                                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-mono text-xs">
                        No Material Inward Notes (GRN) found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer matching screenshot */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <span>Showing {filteredGrns.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, filteredGrns.length)} of {filteredGrns.length} GRNs</span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  &larr;
                </button>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Floating Quick Inward GRN Button at Bottom Right matching screenshot */}
          <div className="fixed bottom-6 right-6 z-40">
            <button
              onClick={() => {
                setStep(1);
                setVendorName('');
                setPoNumber('');
                setGrnNotes('');
                setItems([]);
                setViewMode('create');
              }}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#D97706] hover:bg-[#b45309] text-white font-bold text-sm shadow-xl transition-all cursor-pointer font-mono"
            >
              <Plus className="w-5 h-5" />
              <span>Quick Inward GRN</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE: CREATE WIZARD */}
      {viewMode === 'create' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Bento Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Total PO Value</span>
                <IndianRupee className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                  ₹{totalGrnValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Carton Items</span>
                <BarcodeIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                  {totalUnits} <span className="text-xs text-slate-400 font-normal">units</span>
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">({items.length} SKUs)</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono">Destination Zone</span>
                <Warehouse className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </div>
              <div className="mt-3 truncate">
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white truncate block">
                  {selectedZone.split('—')[0]}
                </span>
                <span className="text-[10px] text-slate-400 font-mono truncate block">
                  {selectedZone.split('—')[1] || 'Retail Floor'}
                </span>
              </div>
            </div>
          </div>

          {/* Wizard Stepper */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-4 gap-2 text-center relative">
              {[
                { num: 1, title: 'Vendor PO Info' },
                { num: 2, title: 'Dynamic Items' },
                { num: 3, title: 'Batch Barcode QC' },
                { num: 4, title: 'Confirmation' }
              ].map(st => {
                const isDone = step > st.num;
                const isCurrent = step === st.num;
                return (
                  <div key={st.num} className="flex flex-col items-center gap-1.5 z-10">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono transition-all ${
                        isDone
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isCurrent
                          ? 'bg-[#D97706] text-white shadow-xs font-extrabold ring-2 ring-amber-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : st.num}
                    </div>
                    <span className={`text-[11px] font-bold font-mono uppercase tracking-wider truncate max-w-full ${
                      isCurrent ? 'text-[#D97706] dark:text-amber-400' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}>
                      {st.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 1: Vendor & Document Details */}
          {step === 1 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#D97706]" />
                  <span>Step 1: Supplier & Purchase Order Information (Mandatory)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Please provide origin vendor name and PO number before proceeding.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                {/* Searchable Supplier Dropdown Selector with + Add Supplier button */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Supplier / Vendor *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSupplierForm({
                          name: '',
                          category: 'Books & Vedic Literature',
                          contactPerson: '',
                          phone: '',
                          email: '',
                          paymentTerms: 'Net 30',
                          gstin: ''
                        });
                        setIsAddSupplierModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Supplier</span>
                    </button>
                  </div>

                  {/* Dropdown Toggle / Selector Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSupplierDropdownOpen(prev => !prev)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className={vendorName ? 'font-bold' : 'text-slate-400 font-normal'}>
                          {vendorName || 'Select registered supplier or vendor...'}
                        </span>
                      </div>
                      <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                    </button>

                    {/* Dropdown Menu */}
                    {isSupplierDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                        {/* Search inside dropdown */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Type to filter suppliers..."
                            value={supplierSearchQuery}
                            onChange={e => setSupplierSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                          />
                        </div>

                        {/* List of suppliers */}
                        <div className="max-h-52 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800">
                          {suppliers
                            .filter(s => {
                              const q = supplierSearchQuery.toLowerCase();
                              return (
                                !q ||
                                s.name.toLowerCase().includes(q) ||
                                s.code.toLowerCase().includes(q) ||
                                s.category.toLowerCase().includes(q)
                              );
                            })
                            .map(s => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setVendorName(s.name);
                                  setIsSupplierDropdownOpen(false);
                                  setSupplierSearchQuery('');
                                }}
                                className={`w-full text-left p-2 rounded-xl transition-colors flex items-center justify-between text-xs cursor-pointer ${
                                  vendorName.toLowerCase() === s.name.toLowerCase()
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                      {s.code}
                                    </span>
                                    <span className="font-bold truncate">{s.name}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {s.category} • {s.contactPerson} ({s.phone})
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-1">
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {s.paymentTerms}
                                  </span>
                                  {vendorName.toLowerCase() === s.name.toLowerCase() && (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>
                              </button>
                            ))}
                        </div>

                        {/* Inline quick action inside dropdown footer */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setIsSupplierDropdownOpen(false);
                              setIsAddSupplierModalOpen(true);
                            }}
                            className="w-full py-1.5 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Register New Supplier</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vendor Details Preview Badge if selected */}
                  {vendorName && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-[11px]">
                      {(() => {
                        const matched = suppliers.find(s => s.name.toLowerCase() === vendorName.toLowerCase());
                        if (matched) {
                          return (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                                {matched.code}
                              </span>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-600 dark:text-slate-400">{matched.category}</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">{matched.paymentTerms}</span>
                              {matched.gstin && (
                                <span className="font-mono text-slate-500 hidden sm:inline">({matched.gstin})</span>
                              )}
                            </div>
                          );
                        }
                        return <span className="text-slate-500 italic">Custom Vendor: {vendorName}</span>;
                      })()}
                      <button
                        type="button"
                        onClick={() => setVendorName('')}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        title="Clear vendor"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Purchase Order (PO) Number *</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    placeholder="Enter PO number (e.g. PO-88941)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-amber-600 dark:text-amber-400 font-semibold focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Invoice Date</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={e => setInvoiceDate(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Destination Warehouse Zone</label>
                  <div className="relative">
                    <Warehouse className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedZone}
                      onChange={e => setSelectedZone(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                    >
                      {zones.map(z => (
                        <option key={z.id} value={z.name}>
                          {z.code} • {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Inspection & Delivery Notes</label>
                  <textarea
                    rows={2}
                    value={grnNotes}
                    onChange={e => setGrnNotes(e.target.value)}
                    placeholder="Optional carrier notes or QC instructions..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    if (!vendorName.trim()) {
                      quickNotification('Validation Error', 'Supplier / Vendor Name is mandatory.', 'alert');
                      return;
                    }
                    if (!poNumber.trim()) {
                      quickNotification('Validation Error', 'Purchase Order (PO) Number is mandatory.', 'alert');
                      return;
                    }
                    setStep(2);
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs shadow-sm transition-all hover:opacity-90 font-mono cursor-pointer"
                >
                  <span>NEXT: ADD PRODUCT ROWS</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Dynamic Items Table */}
          {step === 2 && (
            <div className="space-y-6">
              <DynamicShipmentItemsTable
                availableProducts={products}
                initialRows={
                  items.length > 0
                    ? items.map(item => ({
                        id: item.id,
                        sku: item.sku,
                        description: item.name,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        sellingPrice: item.sellingPrice ?? '',
                        batchNo: item.batchNo,
                        taxRate: item.taxRate,
                        total: item.total
                      }))
                    : undefined
                }
                onChange={(newRows) => {
                  setItems(
                    newRows.map(r => ({
                      id: r.id,
                      sku: r.sku || '',
                      name: r.description || '',
                      quantity: typeof r.quantity === 'number' ? r.quantity : parseFloat(r.quantity) || 0,
                      unitCost: typeof r.unitCost === 'number' ? r.unitCost : parseFloat(r.unitCost) || 0,
                      sellingPrice: typeof r.sellingPrice === 'number' ? r.sellingPrice : parseFloat(r.sellingPrice) || 0,
                      batchNo: r.batchNo || `BAT-2026-${Math.floor(10 + Math.random() * 89)}`,
                      expiryDate: '2036-12-31',
                      taxRate: r.taxRate,
                      total: r.total
                    }))
                  );
                }}
              />

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK: VENDOR PO</span>
                </button>
                <button
                  onClick={() => {
                    if (items.length === 0 || items.some(i => !i.sku || Number(i.quantity) <= 0)) {
                      quickNotification('Validation Error', 'Please ensure all item rows have a valid Product SKU and quantity greater than 0.', 'alert');
                      return;
                    }
                    setStep(3);
                  }}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs shadow-sm transition-all hover:opacity-90 cursor-pointer"
                >
                  <span>NEXT: BARCODE & BATCH REVIEW</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Barcode & Batch QC Review */}
          {step === 3 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-amber-500" />
                  <span>Step 3: Barcode & Batch Label Preview</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Verify auto-generated serial barcodes and sticker print queues before final commitment.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((row) => {
                  const matchedProd = products.find(p => p.sku === row.sku);
                  const barcodeVal = matchedProd?.barcode || `8901234${Math.abs(row.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 999).toString().slice(0, 6)}`;
                  return (
                    <div key={row.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 font-mono">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
                            {row.sku}
                          </span>
                          <span className="text-[10px] text-slate-400">Qty: {row.quantity}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {row.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Batch: <strong className="text-slate-700 dark:text-slate-300">{row.batchNo}</strong>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shrink-0 shadow-xs">
                        <BarcodeView value={barcodeVal} width={1} height={32} fontSize={9} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between font-mono">
                <div className="flex items-center gap-3">
                  <Printer className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">Auto-Print Adhesive Sticker Labels (1x2 inch)</h4>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400/80">
                      When enabled, {totalUnits} individual barcode stickers will dispatch immediately to Terminal Printer upon GRN confirmation.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoPrintLabels}
                    onChange={e => setAutoPrintLabels(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK: DYNAMIC ITEMS</span>
                </button>
                <button
                  onClick={handleCompleteGrn}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'COMMITTING...' : 'CONFIRM & COMMIT GRN'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success Confirmation Screen */}
          {step === 4 && (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  MATERIAL INWARD NOTE PROCESSED
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono">
                  GRN NUMBER <strong className="text-black dark:text-white font-bold">{generatedGrnNumber}</strong> RECORDED.
                </p>
              </div>

              <div className="max-w-md mx-auto p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left space-y-3 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2 font-bold text-slate-800 dark:text-slate-200">
                  <span>Destination Zone:</span>
                  <span className="text-slate-900 dark:text-white">{selectedZone.split('—')[0]}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total Units Added:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{totalUnits} units</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total Financial Value:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{totalGrnValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Received By:</span>
                  <span>{user?.name || 'Store Operator'}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 pt-4 font-mono">
                {/* Requirement 3: Prominent Print Barcodes for this GRN */}
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('active_grn_filter', generatedGrnNumber);
                    }
                    setActiveModule('barcode');
                    quickNotification(
                      'Navigating to Barcode Manager',
                      `Auto-filtered labels for newly generated ${generatedGrnNumber}`,
                      'success'
                    );
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-600/30 transition-all cursor-pointer ring-2 ring-rose-400/40"
                >
                  <BarcodeIcon className="w-4 h-4" />
                  <span>Print Barcodes for this GRN &rarr;</span>
                </button>

                <button
                  onClick={() => {
                    const exportItems = items.map(item => {
                      const prod = products.find(p => p.sku === item.sku);
                      return {
                        sku: item.sku,
                        productName: item.name,
                        barcodeValue: prod?.barcode || `890${Math.abs(item.sku.split('').reduce((a,c)=>a+c.charCodeAt(0),0)*1000).toString().slice(0,10)}`,
                        batchNo: item.batchNo,
                        grnNumber: generatedGrnNumber,
                        purchaseCost: item.unitCost,
                        sellingPrice: item.sellingPrice || (item.unitCost * 1.5),
                        quantity: Number(item.quantity)
                      };
                    });
                    exportBarcodesToPdf(exportItems, {
                      orgName: settings?.orgName || 'ISKCON FOUNDATION',
                      repeatByQuantity: true,
                      filename: `Barcodes_${generatedGrnNumber}.pdf`
                    });
                    quickNotification('PDF Downloaded', `Exported all batch barcodes for ${generatedGrnNumber} to PDF.`, 'success');
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Barcodes PDF</span>
                </button>

                <button
                  onClick={() => {
                    const combinedHtml = items.map(item => {
                      const prod = products.find(p => p.sku === item.sku) || {
                        sku: item.sku,
                        name: item.name,
                        price: item.sellingPrice || 100,
                        barcode: '8901234002039'
                      };
                      return buildProductLabelsHtml(prod as any, item.quantity, settings?.orgName || 'ISKCON FOUNDATION', item.batchNo);
                    }).join('');

                    printHtmlDocument(combinedHtml, `GRN_${generatedGrnNumber}_Barcodes`);
                    quickNotification('Print Dispatched', 'Generated printable sticker sheet for this GRN session.', 'success');
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Voucher</span>
                </button>

                <button
                  onClick={() => {
                    setViewMode('list');
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  &larr; View GRN List
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GRN Detail Modal for viewing past GRN */}
      {viewingGrn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 font-mono">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">{viewingGrn.grnNumber}</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Supplier: {viewingGrn.vendorName}</h3>
              </div>
              <button
                onClick={() => setViewingGrn(null)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl">
              <div>PO Number: <strong className="text-slate-900 dark:text-white">{viewingGrn.poNumber}</strong></div>
              <div>Invoice Date: <strong className="text-slate-900 dark:text-white">{viewingGrn.invoiceDate}</strong></div>
              <div>Destination Zone: <strong className="text-slate-900 dark:text-white">{viewingGrn.warehouse}</strong></div>
              <div>Received By: <strong className="text-slate-900 dark:text-white">{viewingGrn.receivedBy}</strong></div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Received Line Items</h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="p-3">SKU & Item</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Cost</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viewingGrn.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{item.sku}</div>
                          <div className="text-slate-500 text-[11px]">{item.name}</div>
                        </td>
                        <td className="p-3 text-center font-bold">{item.quantity}</td>
                        <td className="p-3 text-right">₹{Number(item.unitCost).toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">₹{Number(item.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-sm font-bold">
                Total GRN Valuation: <span className="text-emerald-600">₹{Number(viewingGrn.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <button
                onClick={() => {
                  const html = buildProductLabelsHtml(
                    { sku: viewingGrn.items?.[0]?.sku || 'SKU', name: viewingGrn.items?.[0]?.name || 'Item', price: viewingGrn.items?.[0]?.sellingPrice || 100 } as any,
                    viewingGrn.items?.[0]?.quantity || 1,
                    viewingGrn.vendorName,
                    viewingGrn.grnNumber
                  );
                  printHtmlDocument(html, viewingGrn.grnNumber);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Labels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Quick Add Supplier Modal (Requirement 2: On-the-fly supplier creation without losing GRN progress) */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Quick Register Supplier
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add new vendor to directory and auto-bind to this GRN.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!quickSupplierForm.name.trim()) {
                  quickNotification('Validation Error', 'Supplier Company Name is required.', 'alert');
                  return;
                }
                if (!quickSupplierForm.contactPerson.trim()) {
                  quickNotification('Validation Error', 'Contact Person is required.', 'alert');
                  return;
                }
                if (!quickSupplierForm.phone.trim()) {
                  quickNotification('Validation Error', 'Phone Number is required.', 'alert');
                  return;
                }

                const created = addSupplier({
                  code: undefined,
                  name: quickSupplierForm.name.trim(),
                  category: quickSupplierForm.category,
                  contactPerson: quickSupplierForm.contactPerson.trim(),
                  phone: quickSupplierForm.phone.trim(),
                  email: quickSupplierForm.email.trim(),
                  paymentTerms: quickSupplierForm.paymentTerms,
                  gstin: quickSupplierForm.gstin.trim().toUpperCase(),
                  rating: 5,
                  status: 'active',
                  branchId: currentBranch?.id,
                  branchName: currentBranch?.name
                });

                setVendorName(created.name);
                setIsAddSupplierModalOpen(false);
                quickNotification('Supplier Registered', `"${created.name}" created and selected for this inward note.`, 'success');
              }}
              className="space-y-3.5 text-xs font-mono"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickSupplierForm.name}
                  onChange={e => setQuickSupplierForm({ ...quickSupplierForm, name: e.target.value })}
                  placeholder="e.g. Mayapur Handicraft Cooperative"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={quickSupplierForm.category}
                    onChange={e => setQuickSupplierForm({ ...quickSupplierForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  >
                    <option value="Books & Vedic Literature">Books & Vedic Literature</option>
                    <option value="Deity Jewelry & Deities">Deity Jewelry & Deities</option>
                    <option value="Japa Malas & Beads">Japa Malas & Beads</option>
                    <option value="Incense & Essential Oils">Incense & Essential Oils</option>
                    <option value="Devotional Apparel & Cloth">Devotional Apparel & Cloth</option>
                    <option value="A2 Ghee & Organic Products">A2 Ghee & Organic Products</option>
                    <option value="Puja Paraphernalia">Puja Paraphernalia</option>
                    <option value="General Supplies">General Supplies</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Terms *
                  </label>
                  <select
                    value={quickSupplierForm.paymentTerms}
                    onChange={e => setQuickSupplierForm({ ...quickSupplierForm, paymentTerms: e.target.value as SupplierPaymentTerms })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Advance">Advance</option>
                    <option value="COD">COD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickSupplierForm.contactPerson}
                    onChange={e => setQuickSupplierForm({ ...quickSupplierForm, contactPerson: e.target.value })}
                    placeholder="e.g. Mukunda Das"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={quickSupplierForm.phone}
                    onChange={e => setQuickSupplierForm({ ...quickSupplierForm, phone: e.target.value })}
                    placeholder="+91 98450 00000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={quickSupplierForm.email}
                    onChange={e => setQuickSupplierForm({ ...quickSupplierForm, email: e.target.value })}
                    placeholder="orders@vendor.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GSTIN Tax ID
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={quickSupplierForm.gstin}
                    onChange={e => setQuickSupplierForm({ ...quickSupplierForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="29AAAAA0000A1Z5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D97706] hover:bg-[#b45309] text-white font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Select Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
