'use client';

import React, { useState, useMemo } from 'react';
import { useERP } from '@/context/ERPContext';
import { Supplier, SupplierPaymentTerms, MaterialInwardNote } from '@/types';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Star,
  FileSpreadsheet,
  Edit,
  Trash2,
  Eye,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Calendar,
  Warehouse,
  ExternalLink,
  CreditCard,
  Briefcase,
  X,
  FileText,
  BadgeCheck,
  ShieldCheck,
  Package
} from 'lucide-react';

export const SupplierManagement: React.FC = () => {
  const {
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    inwardNotes,
    quickNotification,
    currentBranch,
    setActiveModule
  } = useERP();

  // Page view mode: 'list' vs 'form'
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentTermsFilter, setPaymentTermsFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Supplier Ledger Modal State
  const [selectedLedgerSupplier, setSelectedLedgerSupplier] = useState<Supplier | null>(null);

  // Delete Confirmation Modal State
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    category: 'Books & Vedic Literature',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan: '',
    paymentTerms: 'Net 30',
    rating: 5,
    status: 'active',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    notes: ''
  });

  // Calculate Inward Summaries per Supplier
  const supplierInwardStats = useMemo(() => {
    const stats: Record<string, { count: number; totalValue: number; notes: MaterialInwardNote[] }> = {};

    suppliers.forEach(sup => {
      stats[sup.id] = { count: 0, totalValue: 0, notes: [] };
    });

    inwardNotes.forEach(note => {
      const matched = suppliers.find(
        s => s.name.trim().toLowerCase() === note.vendorName.trim().toLowerCase() ||
             (s.code && note.vendorName.toLowerCase().includes(s.code.toLowerCase()))
      );

      if (matched) {
        if (!stats[matched.id]) {
          stats[matched.id] = { count: 0, totalValue: 0, notes: [] };
        }
        stats[matched.id].count += 1;
        stats[matched.id].totalValue += (note.totalValue || 0);
        stats[matched.id].notes.push(note);
      }
    });

    return stats;
  }, [suppliers, inwardNotes]);

  // Overall aggregate stats
  const overallStats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
    let totalInwardOrders = 0;
    let totalInwardValue = 0;

    Object.values(supplierInwardStats).forEach(s => {
      totalInwardOrders += s.count;
      totalInwardValue += s.totalValue;
    });

    return { totalSuppliers, activeSuppliers, totalInwardOrders, totalInwardValue };
  }, [suppliers, supplierInwardStats]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach(s => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [suppliers]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(sup => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sup.name.toLowerCase().includes(q) ||
        sup.code.toLowerCase().includes(q) ||
        sup.contactPerson.toLowerCase().includes(q) ||
        sup.phone.toLowerCase().includes(q) ||
        sup.email.toLowerCase().includes(q) ||
        (sup.gstin && sup.gstin.toLowerCase().includes(q));

      const matchesCat = categoryFilter === 'all' || sup.category === categoryFilter;
      const matchesTerms = paymentTermsFilter === 'all' || sup.paymentTerms === paymentTermsFilter;
      const matchesStatus = statusFilter === 'all' || sup.status === statusFilter;

      return matchesSearch && matchesCat && matchesTerms && matchesStatus;
    });
  }, [suppliers, searchQuery, categoryFilter, paymentTermsFilter, statusFilter]);

  // Form Actions
  const handleOpenCreateForm = () => {
    setEditingSupplierId(null);
    setFormData({
      name: '',
      category: 'Books & Vedic Literature',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      pan: '',
      paymentTerms: 'Net 30',
      rating: 5,
      status: 'active',
      bankName: '',
      bankAccountNo: '',
      bankIfsc: '',
      notes: ''
    });
    setViewMode('form');
  };

  const handleOpenEditForm = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setFormData({
      name: supplier.name,
      category: supplier.category,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address || '',
      city: supplier.city || '',
      state: supplier.state || '',
      pincode: supplier.pincode || '',
      gstin: supplier.gstin || '',
      pan: supplier.pan || '',
      paymentTerms: supplier.paymentTerms,
      rating: supplier.rating,
      status: supplier.status,
      bankName: supplier.bankName || '',
      bankAccountNo: supplier.bankAccountNo || '',
      bankIfsc: supplier.bankIfsc || '',
      notes: supplier.notes || ''
    });
    setViewMode('form');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      quickNotification('Missing Information', 'Supplier Company Name is required.', 'alert');
      return;
    }
    if (!formData.contactPerson?.trim()) {
      quickNotification('Missing Information', 'Primary Contact Person is required.', 'alert');
      return;
    }
    if (!formData.phone?.trim()) {
      quickNotification('Missing Information', 'Contact Phone number is required.', 'alert');
      return;
    }

    if (editingSupplierId) {
      updateSupplier(editingSupplierId, formData);
      quickNotification('Supplier Updated', `Updated vendor profile for "${formData.name}".`, 'success');
    } else {
      addSupplier({
        code: undefined,
        name: formData.name.trim(),
        category: formData.category || 'General Supplies',
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email?.trim() || '',
        address: formData.address?.trim() || '',
        city: formData.city?.trim() || '',
        state: formData.state?.trim() || '',
        pincode: formData.pincode?.trim() || '',
        gstin: formData.gstin?.trim() || '',
        pan: formData.pan?.trim() || '',
        paymentTerms: (formData.paymentTerms as SupplierPaymentTerms) || 'Net 30',
        rating: formData.rating || 5,
        status: formData.status || 'active',
        bankName: formData.bankName?.trim() || '',
        bankAccountNo: formData.bankAccountNo?.trim() || '',
        bankIfsc: formData.bankIfsc?.trim() || '',
        notes: formData.notes?.trim() || '',
        branchId: currentBranch?.id,
        branchName: currentBranch?.name
      });
      quickNotification('Supplier Created', `Registered new supplier "${formData.name}".`, 'success');
    }

    setViewMode('list');
    setEditingSupplierId(null);
  };

  const handleDeleteConfirmed = () => {
    if (supplierToDelete) {
      deleteSupplier(supplierToDelete.id);
      quickNotification('Supplier Deleted', `Removed vendor "${supplierToDelete.name}".`, 'info');
      setSupplierToDelete(null);
    }
  };

  // Helper for Payment Terms Badge Color
  const getTermsBadgeColor = (terms: SupplierPaymentTerms) => {
    switch (terms) {
      case 'Advance':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'COD':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Net 15':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Net 30':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Net 45':
      case 'Net 60':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Suppliers & Vendors Directory
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage registered publishers, artisan cooperatives, GSTIN tax credentials, and inward purchase histories.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher CTA */}
        {viewMode === 'list' ? (
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Supplier</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Suppliers List</span>
          </button>
        )}
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider">Total Suppliers</p>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {overallStats.totalSuppliers}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              {overallStats.activeSuppliers} Active Partners
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider">Inward Shipments (GRN)</p>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {overallStats.totalInwardOrders}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Across all temple branches
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider">Total Purchase Value</p>
            <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{overallStats.totalInwardValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Verified incoming stock
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider">Tax Compliant Vendors</p>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {suppliers.filter(s => !!s.gstin).length} <span className="text-sm font-normal text-slate-400">/ {suppliers.length}</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              GSTIN registered
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ======================= VIEW MODE: LIST ======================= */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Suppliers</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code, name, phone, GSTIN..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category / Specialization</label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Terms</label>
              <select
                value={paymentTermsFilter}
                onChange={e => setPaymentTermsFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              >
                <option value="all">All Payment Terms</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option>
                <option value="Advance">Advance</option>
                <option value="COD">COD</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Supplier Details</th>
                    <th className="py-3.5 px-4">Contact Person</th>
                    <th className="py-3.5 px-4">Contact Info</th>
                    <th className="py-3.5 px-4">GSTIN & Terms</th>
                    <th className="py-3.5 px-4 text-center">Rating</th>
                    <th className="py-3.5 px-4 text-right">Inward Summary</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        <p className="font-semibold text-slate-600 dark:text-slate-400">No suppliers matched your search criteria.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try resetting filters or click &quot;Add New Supplier&quot; to register one.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(supplier => {
                      const stats = supplierInwardStats[supplier.id] || { count: 0, totalValue: 0, notes: [] };

                      return (
                        <tr
                          key={supplier.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* 1. Supplier Details */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  {supplier.code}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                    supplier.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {supplier.status}
                                </span>
                              </div>
                              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                {supplier.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                                <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{supplier.category}</span>
                              </p>
                              {supplier.city && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{supplier.city}, {supplier.state}</span>
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 2. Contact Person */}
                          <td className="py-4 px-4 align-top">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {supplier.contactPerson}
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                              Key Representative
                            </span>
                          </td>

                          {/* 3. Contact Info */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-1 font-mono text-[11px]">
                              <a
                                href={`tel:${supplier.phone}`}
                                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-amber-600 transition-colors"
                              >
                                <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{supplier.phone}</span>
                              </a>
                              {supplier.email && (
                                <a
                                  href={`mailto:${supplier.email}`}
                                  className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-amber-600 transition-colors"
                                >
                                  <Mail className="w-3 h-3 text-blue-500 shrink-0" />
                                  <span className="truncate max-w-[180px]">{supplier.email}</span>
                                </a>
                              )}
                            </div>
                          </td>

                          {/* 4. GSTIN & Terms */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-1.5">
                              {supplier.gstin ? (
                                <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{supplier.gstin}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Unregistered / Exempt</span>
                              )}
                              <div>
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getTermsBadgeColor(
                                    supplier.paymentTerms
                                  )}`}
                                >
                                  {supplier.paymentTerms}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 5. Rating */}
                          <td className="py-4 px-4 align-top text-center">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                              <span className="font-bold font-mono text-amber-800 dark:text-amber-300">
                                {supplier.rating || 5}.0
                              </span>
                            </div>
                          </td>

                          {/* 6. Inward Summary */}
                          <td className="py-4 px-4 align-top text-right font-mono">
                            <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                              ₹{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="font-bold text-amber-600 dark:text-amber-400">{stats.count}</span> GRN shipments
                            </div>
                          </td>

                          {/* 7. Actions */}
                          <td className="py-4 px-4 align-top text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Ledger Button */}
                              <button
                                type="button"
                                title="View Supplier Ledger & Inward Shipments"
                                onClick={() => setSelectedLedgerSupplier(supplier)}
                                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Button (opens dedicated form view) */}
                              <button
                                type="button"
                                title="Edit Supplier"
                                onClick={() => handleOpenEditForm(supplier)}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                title="Delete Supplier"
                                onClick={() => setSupplierToDelete(supplier)}
                                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= VIEW MODE: DEDICATED FORM ======================= */}
      {viewMode === 'form' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-6 animate-in fade-in duration-200">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                <span>{editingSupplierId ? 'Edit Supplier Record' : 'Register New Vendor / Publisher'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter company registration, primary contact, tax identification, and payment schedule.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-6 text-xs">
            {/* Section 1: Business Details */}
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                <span>1. Business & Category Identification</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Company / Organization Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. BBT South India Publishing or Vrindavan Artisans"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Category / Specialization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category || 'Books & Vedic Literature'}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  >
                    <option value="Books & Vedic Literature">Books & Vedic Literature</option>
                    <option value="Deity Jewelry & Deities">Deity Jewelry & Deities</option>
                    <option value="Japa Malas & Beads">Japa Malas & Beads</option>
                    <option value="Incense & Essential Oils">Incense & Essential Oils</option>
                    <option value="Devotional Apparel & Cloth">Devotional Apparel & Cloth</option>
                    <option value="A2 Ghee & Organic Products">A2 Ghee & Organic Products</option>
                    <option value="Puja Paraphernalia">Puja Paraphernalia</option>
                    <option value="Temple Merchandise & Souvenirs">Temple Merchandise & Souvenirs</option>
                    <option value="General Supplies">General Supplies</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Supplier Status
                  </label>
                  <select
                    value={formData.status || 'active'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  >
                    <option value="active">Active (Permitted for Inward GRN)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Vendor Quality Rating
                  </label>
                  <select
                    value={formData.rating || 5}
                    onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none font-mono"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ 5 Stars (Preferred Partner)</option>
                    <option value={4}>⭐⭐⭐⭐ 4 Stars (Reliable)</option>
                    <option value={3}>⭐⭐⭐ 3 Stars (Average Delivery)</option>
                    <option value={2}>⭐⭐ 2 Stars (Needs Review)</option>
                    <option value={1}>⭐ 1 Star (High Defect Rate)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Contact Person & Details */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                <span>2. Contact Representative & Channels</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Primary Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactPerson || ''}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g. Mukunda Dasa or Ramchandra Prabhu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98450 12345"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="orders@supplier.org"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Premises, Street, Landmark..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">City</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Bengaluru"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">State</label>
                  <input
                    type="text"
                    value={formData.state || ''}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Karnataka"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Postal PIN Code</label>
                  <input
                    type="text"
                    value={formData.pincode || ''}
                    onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="e.g. 560010"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Tax Identification & Payment Terms */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                <span>3. Tax Credentials & Payment Agreement</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    GSTIN (15 Character Tax ID)
                  </label>
                  <input
                    type="text"
                    value={formData.gstin || ''}
                    onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g. 29AAATB1234F1Z8"
                    maxLength={15}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono uppercase font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={formData.pan || ''}
                    onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="e.g. AAATB1234F"
                    maxLength={10}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Payment Terms <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.paymentTerms || 'Net 30'}
                    onChange={e => setFormData({ ...formData, paymentTerms: e.target.value as SupplierPaymentTerms })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days (Standard)</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Advance">100% Advance Payment</option>
                    <option value="COD">Cash / Cheque On Delivery (COD)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName || ''}
                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g. State Bank of India"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Bank Account Number</label>
                  <input
                    type="text"
                    value={formData.bankAccountNo || ''}
                    onChange={e => setFormData({ ...formData, bankAccountNo: e.target.value })}
                    placeholder="e.g. 30291823746"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Bank IFSC Code</label>
                  <input
                    type="text"
                    value={formData.bankIfsc || ''}
                    onChange={e => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0004567"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Internal Operational Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notes on delivery leads, contact preferences, consignment agreements..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D97706] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#D97706] hover:bg-[#b45309] text-white font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingSupplierId ? 'Update Supplier Profile' : 'Save & Register Supplier'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================= MODAL: SUPPLIER LEDGER ======================= */}
      {selectedLedgerSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {selectedLedgerSupplier.code}
                    </span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      {selectedLedgerSupplier.name} • Inward Ledger
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Past Material Inward (GRN) shipments, purchase orders, item lines, and total valuation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerSupplier(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Supplier Stats & GRN Table */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Mini Vendor Header Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">GSTIN Tax ID</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedLedgerSupplier.gstin || 'Unregistered'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Agreed Terms</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {selectedLedgerSupplier.paymentTerms}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Received GRNs</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {supplierInwardStats[selectedLedgerSupplier.id]?.count || 0} shipments
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cumulative Inward Value</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    ₹{(supplierInwardStats[selectedLedgerSupplier.id]?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* GRN Inward Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Material Inward Notes (GRN) Breakdown
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLedgerSupplier(null);
                      setActiveModule('inward');
                    }}
                    className="text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Create New GRN for this Vendor</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-3">GRN Number</th>
                        <th className="py-2.5 px-3">PO Number</th>
                        <th className="py-2.5 px-3">Invoice Date</th>
                        <th className="py-2.5 px-3">Warehouse Zone</th>
                        <th className="py-2.5 px-3 text-center">SKU Lines</th>
                        <th className="py-2.5 px-3 text-right">Inward Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {(supplierInwardStats[selectedLedgerSupplier.id]?.notes || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No Material Inward notes recorded yet for this supplier.
                          </td>
                        </tr>
                      ) : (
                        supplierInwardStats[selectedLedgerSupplier.id].notes.map(note => (
                          <tr key={note.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400">
                              {note.grnNumber}
                            </td>
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                              {note.poNumber}
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{note.invoiceDate}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Warehouse className="w-3 h-3 text-slate-400" />
                                <span>{note.warehouse}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                                {note.items.length} items
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                              ₹{(note.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLedgerSupplier(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: DELETE CONFIRMATION ======================= */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Delete Supplier &quot;{supplierToDelete.name}&quot;?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to remove <strong className="text-slate-800 dark:text-slate-200">{supplierToDelete.code}</strong> from the vendor registry?
                Existing Material Inward (GRN) records will remain intact in audit logs.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
