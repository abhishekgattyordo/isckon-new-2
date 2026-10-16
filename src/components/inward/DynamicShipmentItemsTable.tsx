'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, Layers, Search, ChevronDown, X } from 'lucide-react';

export interface ShipmentItemRow {
  id: string;
  sku: string;
  description: string;
  quantity: number | '';
  unitCost: number | '';
  sellingPrice: number | '';
  batchNo: string;
  taxRate: number; // 0, 5, 12, 18
  total: number;
}

export interface SkuProductInfo {
  sku: string;
  name?: string;
  description?: string;
  cost?: number;
  unitCost?: number;
  price?: number;
  sellingPrice?: number;
  batchNo?: string;
  taxRate?: number;
}

export interface DynamicShipmentItemsTableProps {
  /** Real product catalog passed from parent or fetched from an API */
  availableProducts?: SkuProductInfo[];
  /** Optional lookup handler when a SKU is selected */
  onSkuLookup?: (sku: string) => Promise<SkuProductInfo | null> | SkuProductInfo | null;
  /** Initial row list (defaults to 1 empty row ready for input) */
  initialRows?: ShipmentItemRow[];
  /** Callback triggered whenever items or calculations change */
  onChange?: (
    rows: ShipmentItemRow[],
    summary: { totalUnits: number; totalValuation: number }
  ) => void;
  /** Currency symbol (defaults to ₹) */
  currencySymbol?: string;
  /** Read-only mode for audit or review view */
  readOnly?: boolean;
  /** Custom container styling classes */
  className?: string;
}

export const TAX_OPTIONS = [
  { label: '0%', value: 0 },
  { label: '5%', value: 5 },
  { label: '12%', value: 12 },
  { label: '18%', value: 18 }
];

export const createEmptyRow = (): ShipmentItemRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  sku: '',
  description: '',
  quantity: 1,
  unitCost: '',
  sellingPrice: '',
  batchNo: '',
  taxRate: 0,
  total: 0
});

interface SkuSearchLookupProps {
  value: string;
  disabled?: boolean;
  availableProducts: SkuProductInfo[];
  existingSkus?: Set<string>;
  onSelect: (sku: string) => void;
  onOpenChange?: (isOpen: boolean) => void;
  currencySymbol?: string;
}

const SkuSearchLookup: React.FC<SkuSearchLookupProps> = ({
  value,
  disabled = false,
  availableProducts = [],
  existingSkus,
  onSelect,
  onOpenChange,
  currencySymbol = '₹'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchedProducts, setFetchedProducts] = useState<SkuProductInfo[]>(availableProducts.slice(0, 5));
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setDropdownOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      onOpenChange?.(open);
    },
    [onOpenChange]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setDropdownOpen]);

  // AJAX-style dynamic backend search limited to top 5 matching items
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const qParam = searchTerm.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : '';
        const res = await fetch(`/api/products?limit=5${qParam}`).then(r => r.json());
        if (res.success && Array.isArray(res.products)) {
          setFetchedProducts(res.products.slice(0, 5));
        } else {
          const q = searchTerm.trim().toLowerCase();
          const filtered = !q
            ? availableProducts
            : availableProducts.filter(
                p => p.sku.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)
              );
          setFetchedProducts(filtered.slice(0, 5));
        }
      } catch {
        const q = searchTerm.trim().toLowerCase();
        const filtered = !q
          ? availableProducts
          : availableProducts.filter(
              p => p.sku.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)
            );
        setFetchedProducts(filtered.slice(0, 5));
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, availableProducts]);

  const filteredProducts = fetchedProducts;

  // Reset highlighted index when searchTerm changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelectProduct = (sku: string) => {
    onSelect(sku);
    setDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      setSearchTerm(value || '');
      setDropdownOpen(true);
      return;
    }

    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredProducts.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
          handleSelectProduct(filteredProducts[highlightedIndex].sku);
        } else if (searchTerm.trim()) {
          handleSelectProduct(searchTerm.trim());
        }
      } else if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search SKU or Name..."
          disabled={disabled}
          value={isOpen ? searchTerm : value}
          onFocus={() => {
            setSearchTerm(value || '');
            setDropdownOpen(true);
          }}
          onChange={e => {
            setSearchTerm(e.target.value);
            if (!isOpen) setDropdownOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full h-10.5 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#D97706] focus:border-transparent transition-all disabled:opacity-60 placeholder:text-slate-400"
        />

        {value && !disabled ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onSelect('');
              setSearchTerm('');
              setDropdownOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear SKU"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
      </div>

      {/* SKU SEARCH LOOKUP Dropdown - Absolute Floating Card */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              SKU Search Lookup ({filteredProducts.length} results)
            </span>
            <span className="text-[10px] text-slate-400">↑↓ navigate, ↵ select</span>
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5"
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p, idx) => {
                const isSelected = p.sku === value;
                const isHighlighted = idx === highlightedIndex;
                const displayName = p.name || p.description || 'Catalog SKU Item';

                return (
                  <div
                    key={p.sku}
                    onClick={() => handleSelectProduct(p.sku)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`p-3 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs ${
                      isHighlighted
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 font-semibold'
                        : isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                          {p.sku}
                        </span>
                        {p.taxRate !== undefined && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-500">
                            GST: {p.taxRate}%
                          </span>
                        )}
                        {existingSkus?.has(p.sku.toUpperCase()) && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 font-mono font-bold text-amber-700 dark:text-amber-300">
                            In Shipment
                          </span>
                        )}
                      </div>
                      <p className="truncate font-medium text-slate-900 dark:text-white mt-0.5">
                        {displayName}
                      </p>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      {(p.unitCost !== undefined || p.cost !== undefined) && (
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          Cost: {currencySymbol}{(p.unitCost ?? p.cost)?.toFixed(2)}
                        </div>
                      )}
                      {(p.sellingPrice !== undefined || p.price !== undefined) && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          MRP: {currencySymbol}{(p.sellingPrice ?? p.price)?.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 font-mono">
                <p>No matching SKU or product found for "{searchTerm}"</p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelectProduct(searchTerm.trim())}
                    className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer block mx-auto"
                  >
                    + Select custom SKU "{searchTerm.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const DynamicShipmentItemsTable: React.FC<DynamicShipmentItemsTableProps> = ({
  availableProducts = [],
  onSkuLookup,
  initialRows,
  onChange,
  currencySymbol = '₹',
  readOnly = false,
  className = ''
}) => {
  // Initialize state with exactly 1 empty row ready for input (no mock data)
  const [rows, setRows] = useState<ShipmentItemRow[]>(() => {
    if (initialRows && initialRows.length > 0) {
      return initialRows;
    }
    return [createEmptyRow()];
  });

  // Track which row has the active dropdown open to elevate its z-index
  const [activeDropdownRowId, setActiveDropdownRowId] = useState<string | null>(null);

  // Calculate row total dynamically: (Unit Cost * Qty) + (Tax % applied)
  const calculateRowTotal = (
    qty: number | '',
    cost: number | '',
    taxRate: number
  ): number => {
    const q = typeof qty === 'number' ? qty : parseFloat(qty) || 0;
    const c = typeof cost === 'number' ? cost : parseFloat(cost) || 0;
    const subtotal = q * c;
    const taxAmount = subtotal * (taxRate / 100);
    return Number((subtotal + taxAmount).toFixed(2));
  };

  // Summaries
  const totalUnits = useMemo(() => {
    return rows.reduce((sum, row) => {
      const q = typeof row.quantity === 'number' ? row.quantity : parseFloat(row.quantity) || 0;
      return sum + q;
    }, 0);
  }, [rows]);

  const totalValuation = useMemo(() => {
    return rows.reduce((sum, row) => sum + row.total, 0);
  }, [rows]);

  // Stable onChange reference to prevent re-render cascading loops
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Notify parent of updates when rows change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (onChangeRef.current) {
      onChangeRef.current(rows, { totalUnits, totalValuation });
    }
  }, [rows, totalUnits, totalValuation]);

  // Pass existing SKUs to highlight and manage duplicates
  const existingSkus = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.sku && r.sku.trim()) set.add(r.sku.trim().toUpperCase());
    });
    return set;
  }, [rows]);

  // Handle SKU lookup selection and auto-fill callback with duplicate prevention
  const handleSkuSelect = useCallback(
    async (rowId: string, selectedSku: string) => {
      if (!selectedSku) {
        setRows(prev =>
          prev.map(row => {
            if (row.id === rowId) {
              return {
                ...row,
                sku: '',
                description: '',
                unitCost: '',
                sellingPrice: '',
                batchNo: '',
                taxRate: 0,
                total: 0
              };
            }
            return row;
          })
        );
        return;
      }

      const normSku = selectedSku.trim().toUpperCase();

      // Check if this SKU is already added in another row in the table
      const duplicateIndex = rows.findIndex(
        r => r.id !== rowId && r.sku && r.sku.trim().toUpperCase() === normSku
      );

      let matchedProd: SkuProductInfo | null | undefined = null;
      if (onSkuLookup) {
        matchedProd = await onSkuLookup(selectedSku);
      }
      if (!matchedProd && availableProducts.length > 0) {
        matchedProd = availableProducts.find(p => p.sku.toUpperCase() === normSku);
      }

      const desc = matchedProd?.description || matchedProd?.name || '';
      const cost = matchedProd?.unitCost ?? matchedProd?.cost ?? '';
      const price = matchedProd?.sellingPrice ?? matchedProd?.price ?? '';
      const batch = matchedProd?.batchNo || `BAT-2026-${Math.floor(10 + Math.random() * 89)}`;
      const tax = matchedProd?.taxRate ?? 0;
      const validTax = [0, 5, 12, 18].includes(tax) ? tax : 0;

      if (duplicateIndex !== -1) {
        // Product already exists in another row! Consolidate quantity into the existing row
        const existingRow = rows[duplicateIndex];
        const currentRow = rows.find(r => r.id === rowId);
        const addQty =
          typeof currentRow?.quantity === 'number'
            ? currentRow.quantity
            : parseFloat(currentRow?.quantity as any) || 1;
        const prevQty =
          typeof existingRow.quantity === 'number'
            ? existingRow.quantity
            : parseFloat(existingRow.quantity as any) || 0;
        const newQty = prevQty + addQty;

        setRows(prev => {
          const updated = prev.map(r => {
            if (r.id === existingRow.id) {
              const updatedCost = cost !== '' ? cost : r.unitCost;
              const total = calculateRowTotal(newQty, updatedCost, validTax || r.taxRate);
              return {
                ...r,
                quantity: newQty,
                unitCost: updatedCost,
                sellingPrice: price !== '' ? price : r.sellingPrice,
                taxRate: validTax || r.taxRate,
                total
              };
            }
            return r;
          });

          // Remove the duplicate row if we have multiple rows, otherwise reset it
          if (updated.length > 1) {
            return updated.filter(r => r.id !== rowId);
          } else {
            return updated.map(r => (r.id === rowId ? createEmptyRow() : r));
          }
        });
        return;
      }

      setRows(prev =>
        prev.map(row => {
          if (row.id === rowId) {
            const total = calculateRowTotal(row.quantity, cost, validTax);
            return {
              ...row,
              sku: selectedSku,
              description: desc,
              unitCost: cost,
              sellingPrice: price,
              batchNo: batch || row.batchNo,
              taxRate: validTax,
              total
            };
          }
          return row;
        })
      );
    },
    [availableProducts, onSkuLookup, rows]
  );

  // Update specific row fields
  const handleRowChange = (
    rowId: string,
    field: keyof ShipmentItemRow,
    value: any
  ) => {
    setRows(prev =>
      prev.map(row => {
        if (row.id === rowId) {
          const updated: ShipmentItemRow = { ...row, [field]: value };

          // Recalculate total if quantity, unit cost, or tax rate changed
          if (field === 'quantity' || field === 'unitCost' || field === 'taxRate') {
            updated.total = calculateRowTotal(
              field === 'quantity' ? value : row.quantity,
              field === 'unitCost' ? value : row.unitCost,
              field === 'taxRate' ? Number(value) : row.taxRate
            );
          }

          return updated;
        }
        return row;
      })
    );
  };

  // Add new empty row
  const handleAddRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  // Remove specific row
  const handleRemoveRow = (rowId: string) => {
    setRows(prev => {
      const filtered = prev.filter(r => r.id !== rowId);
      // Keep at least one empty row ready for input
      if (filtered.length === 0) {
        return [createEmptyRow()];
      }
      return filtered;
    });
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs font-sans ${className}`}
    >
      {/* Table Header Bar with Neatly Aligned "+ ADD SKU ROW" */}
      <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Dynamic Shipment Items
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Goods Received Note (GRN) line item valuation & inward inventory
            </p>
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D97706] hover:bg-[#b45309] text-white text-xs sm:text-sm font-bold font-mono tracking-wide transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ ADD SKU ROW</span>
          </button>
        )}
      </div>

      {/* Clean Table Grid Container */}
      <div className="overflow-x-auto overflow-y-visible">
        <div className="min-w-[960px]">
          {/* Explicit Table Column Headers (30% / 30% / 10% / 10% / 10% / 10%) */}
          <div className="grid grid-cols-[30%_30%_10%_10%_10%_10%] gap-3 px-6 py-3.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono items-center">
            <div>SKU SEARCH LOOKUP (30%)</div>
            <div>PRODUCT DESCRIPTION / TITLE (30%)</div>
            <div className="text-center">QTY (10%)</div>
            <div className="text-right">UNIT COST ({currencySymbol}) (10%)</div>
            <div className="text-center">TAX % (10%)</div>
            <div className="text-right pr-10">TOTAL ({currencySymbol}) (10%)</div>
          </div>

          {/* Table Rows Body with min-height to ensure dropdown has plenty of space */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 min-h-[300px]">
            {rows.map((row) => {
              const isDropdownActive = activeDropdownRowId === row.id;

              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[30%_30%_10%_10%_10%_10%] gap-3 px-6 py-3.5 items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors relative ${
                    isDropdownActive ? 'z-40' : 'z-10'
                  }`}
                >
                  {/* 1. SKU Search Input (30%) */}
                  <div className="relative">
                    <SkuSearchLookup
                      value={row.sku}
                      disabled={readOnly}
                      availableProducts={availableProducts}
                      existingSkus={existingSkus}
                      onSelect={sku => handleSkuSelect(row.id, sku)}
                      onOpenChange={open => setActiveDropdownRowId(open ? row.id : null)}
                      currencySymbol={currencySymbol}
                    />
                  </div>

                  {/* 2. Product Description / Title (30% - Read-only / Auto-filled) */}
                  <div>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      placeholder="Auto-filled description"
                      value={row.description}
                      className="w-full h-10.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 text-slate-700 dark:text-slate-300 text-xs sm:text-sm focus:outline-none cursor-default truncate font-medium"
                      title={row.description}
                    />
                  </div>

                  {/* 3. Qty (10%) */}
                  <div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={readOnly}
                      value={row.quantity}
                      onChange={e => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                        handleRowChange(row.id, 'quantity', isNaN(val as number) ? '' : val);
                      }}
                      className="w-full h-10.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706] focus:border-transparent transition-all disabled:opacity-60 font-mono"
                    />
                  </div>

                  {/* 4. Unit Cost (10%) */}
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      disabled={readOnly}
                      value={row.unitCost}
                      onChange={e => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        handleRowChange(row.id, 'unitCost', isNaN(val as number) ? '' : val);
                      }}
                      className="w-full h-10.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right focus:outline-none focus:ring-2 focus:ring-[#D97706] focus:border-transparent transition-all disabled:opacity-60"
                    />
                  </div>

                  {/* 5. Tax % (10%) */}
                  <div>
                    <select
                      disabled={readOnly}
                      value={row.taxRate}
                      onChange={e =>
                        handleRowChange(row.id, 'taxRate', parseFloat(e.target.value) || 0)
                      }
                      className="w-full h-10.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs sm:text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#D97706] focus:border-transparent transition-all disabled:opacity-60 cursor-pointer"
                    >
                      {TAX_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 6. Total (10%) & Delete Action Button */}
                  <div className="flex items-center justify-between pl-1">
                    <div className="font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm text-right flex-1 pr-2">
                      {currencySymbol}
                      {row.total.toFixed(2)}
                    </div>

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={rows.length === 1 && !row.sku && !row.unitCost}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer shrink-0"
                        title="Remove Item Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Section (Bottom of Table) */}
      <div className="p-5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-b-2xl font-mono">
        <div className="space-y-1">
          <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span>Total Units Received:</span>
            <span className="font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
              {totalUnits} pcs
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Valuation calculated as: (Unit Cost × Qty) + applicable Tax %
          </p>
        </div>

        <div className="flex items-baseline gap-3 sm:text-right">
          <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
            TOTAL GRN VALUATION:
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white text-emerald-600 dark:text-emerald-400">
            {currencySymbol}
            {totalValuation.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
