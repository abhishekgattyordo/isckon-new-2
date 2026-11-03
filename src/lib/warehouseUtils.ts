import { Product, WarehouseZone, InventoryBatch } from '../types';

/**
 * Extracts base zone identifier before any dash, colon, or slash.
 * Supports em-dash (—), en-dash (–), hyphen (-), colon (:), slash (/).
 */
export function getZoneBaseTitle(zoneNameOrCode?: string | null): string {
  if (!zoneNameOrCode) return '';
  const clean = zoneNameOrCode.trim();
  const parts = clean.split(/[—–\-\:\/]/);
  return (parts[0] || '').trim().toLowerCase();
}

/**
 * Determines whether a product or inventory item belongs to a specific WarehouseZone.
 * Handles:
 *  1. Exact ID, Code, or Name matches
 *  2. Case-insensitive matches
 *  3. Base name matches (e.g. "Zone A — General Literature" matches "Zone A" or "Zone A — Main Floor")
 *  4. Code pattern matching (e.g. zone.code "ZA-01" / "ZA" matches product "Zone A")
 *  5. Single-zone facility automatic mapping: if a facility/branch has only 1 zone,
 *     all products present in that facility naturally belong to this zone.
 *  6. Safe fallback for unassigned items when there's a primary/first zone in the facility.
 */
export function isProductInZone(
  product: { warehouseZone?: string | null; branchId?: string | null; sku?: string | null },
  zone: WarehouseZone,
  branchZones: WarehouseZone[] = []
): boolean {
  if (!product || !zone) return false;

  const pZoneRaw = (product.warehouseZone || '').trim();

  // If product has no zone explicitly specified:
  if (!pZoneRaw) {
    if (branchZones.length === 1 && branchZones[0].id === zone.id) return true;
    return branchZones.length > 0 && branchZones[0].id === zone.id;
  }

  const pLower = pZoneRaw.toLowerCase();
  const zIdLower = (zone.id || '').toLowerCase();
  const zCodeLower = (zone.code || '').toLowerCase();
  const zNameLower = (zone.name || '').toLowerCase();

  // 1. Direct equality with id, code, or name
  if (pLower === zIdLower || pLower === zCodeLower || pLower === zNameLower) {
    return true;
  }

  // 2. Base name extraction (handles em-dash, en-dash, hyphen, colon)
  const pBase = getZoneBaseTitle(pZoneRaw);
  const zBase = getZoneBaseTitle(zone.name);

  if (pBase && zBase && (pBase === zBase || pBase === zCodeLower || zBase === pLower)) {
    return true;
  }

  // 3. Substring matching
  if (zCodeLower && pLower.includes(zCodeLower)) return true;
  if (pBase && (zNameLower.includes(pBase) || zCodeLower.includes(pBase))) return true;
  if (zBase && (pLower.includes(zBase) || pLower.includes(zCodeLower))) return true;

  // 4. Code letters matching (e.g. zone.code "ZA-01" matches "Zone A" or "ZA")
  const codeMatch = (zone.code || '').match(/Z([A-Z])/i);
  if (codeMatch) {
    const letter = codeMatch[1].toLowerCase();
    if (
      pLower === `zone ${letter}` ||
      pLower.startsWith(`zone ${letter} `) ||
      pLower.startsWith(`zone ${letter}-`) ||
      pLower.startsWith(`zone ${letter}—`) ||
      pLower.startsWith(`zone ${letter}–`)
    ) {
      return true;
    }
  }

  // 5. If this facility has only 1 zone configured, all products stored in this facility belong to this zone
  if (branchZones.length === 1 && branchZones[0].id === zone.id) {
    return true;
  }

  // 6. If the product does not match any other zone in the facility, map to default/first zone
  const matchesOtherZone = branchZones.some(other => {
    if (other.id === zone.id) return false;
    const oId = (other.id || '').toLowerCase();
    const oCode = (other.code || '').toLowerCase();
    const oName = (other.name || '').toLowerCase();
    const oBase = getZoneBaseTitle(other.name);
    return (
      pLower === oId ||
      pLower === oCode ||
      pLower === oName ||
      (pBase && oBase && pBase === oBase) ||
      (oBase && pLower.includes(oBase)) ||
      (oCode && pLower.includes(oCode))
    );
  });

  if (!matchesOtherZone && branchZones.length > 0 && branchZones[0].id === zone.id) {
    return true;
  }

  return false;
}

/**
 * Calculates occupied slots, active SKU count, and capacity percentage for a zone.
 * Formula: Capacity Percentage = Math.round((Total Occupied Slots / Zone Capacity Limit) * 100)
 */
export function calculateZoneStats(
  zone: WarehouseZone,
  products: Product[],
  branchZones: WarehouseZone[] = []
) {
  const assignedProducts = products.filter(p => isProductInZone(p, zone, branchZones));
  const occupiedSlots = assignedProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const skuCount = assignedProducts.length;
  const capacityLimit = Math.max(1, Number(zone.capacity) || 1000);
  const capacityPercent = Math.min(100, Math.round((occupiedSlots / capacityLimit) * 100));

  return {
    assignedProducts,
    occupiedSlots,
    skuCount,
    capacityLimit,
    capacityPercent,
  };
}

/**
 * Returns the oldest active inventory batch with remainingQuantity > 0 for a given SKU (FIFO principle).
 * Uses receivedDate ascending with stable secondary sort on id/batchNo.
 */
export function getActiveBatch(sku: string, batches: InventoryBatch[]): InventoryBatch | undefined {
  const activeBatches = getAllActiveBatches(sku, batches);
  return activeBatches[0];
}

/**
 * Returns all active inventory batches with remainingQuantity > 0 for a given SKU in FIFO order.
 */
export function getAllActiveBatches(sku: string, batches: InventoryBatch[]): InventoryBatch[] {
  if (!sku || !batches || !Array.isArray(batches)) return [];
  const normSku = sku.trim().toUpperCase();
  return batches
    .filter(b => b.sku && b.sku.trim().toUpperCase() === normSku && Number(b.remainingQuantity) > 0)
    .sort((a, b) => {
      const dateA = a.receivedDate || '';
      const dateB = b.receivedDate || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const cA = a.createdAt || '';
      const cB = b.createdAt || '';
      if (cA && cB && cA !== cB) return cA.localeCompare(cB);
      return (a.id || a.batchNo || '').localeCompare(b.id || b.batchNo || '');
    });
}

/**
 * Returns summary info about multi-batch queue for POS display.
 */
export function getMultiBatchInfo(sku: string, batches: InventoryBatch[]): {
  count: number;
  currentBatch?: InventoryBatch;
  nextBatch?: InventoryBatch;
  allBatches: InventoryBatch[];
} {
  const activeList = getAllActiveBatches(sku, batches);
  return {
    count: activeList.length,
    currentBatch: activeList[0],
    nextBatch: activeList[1],
    allBatches: activeList,
  };
}

/**
 * Centralized FIFO Price Resolver helper for components:
 * Returns the selling price of the oldest available inventory batch with remainingQuantity > 0.
 * Automatically shifts to the next batch when the older batch reaches 0.
 */
export function getActiveBatchPrice(sku: string, batches: InventoryBatch[], fallbackPrice = 0): number {
  const activeBatch = getActiveBatch(sku, batches);
  return activeBatch ? activeBatch.sellingPrice : fallbackPrice;
}

/**
 * Returns the effective selling price of a product based on FIFO oldest active batch pricing.
 */
export function getEffectiveProductPrice(product: { sku: string; price: number }, batches: InventoryBatch[]): number {
  return getActiveBatchPrice(product.sku, batches, product.price);
}

/**
 * Returns the effective batch number of a product based on FIFO oldest active batch.
 */
export function getEffectiveBatchNo(product: { sku: string; batchNo?: string | null }, batches: InventoryBatch[]): string {
  const activeBatch = getActiveBatch(product.sku, batches);
  return activeBatch ? activeBatch.batchNo : (product.batchNo || '');
}

/**
 * Allocates a requested quantity across available FIFO batches (oldest first).
 * If quantity spans across batches (e.g. 7 units when Batch A has 5 units @ ₹500 and Batch B has 10 units @ ₹799),
 * splits the allocations cleanly across the batches.
 */
export function allocateFifoCartItems(
  product: Product,
  totalQuantity: number,
  batches: InventoryBatch[]
): {
  batchId?: string;
  batchNumber?: string;
  quantity: number;
  costPrice?: number;
  sellingPrice: number;
  batchProduct: Product;
}[] {
  if (!product || totalQuantity <= 0) return [];
  const normSku = (product.sku || '').trim().toUpperCase();
  const activeBatches = batches
    .filter(b => b.sku && b.sku.trim().toUpperCase() === normSku && Number(b.remainingQuantity) > 0)
    .sort((a, b) => {
      const dateA = a.receivedDate || '';
      const dateB = b.receivedDate || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const cA = a.createdAt || '';
      const cB = b.createdAt || '';
      if (cA && cB && cA !== cB) return cA.localeCompare(cB);
      return (a.id || a.batchNo || '').localeCompare(b.id || b.batchNo || '');
    });

  if (activeBatches.length === 0) {
    return [{
      batchNumber: product.batchNo || undefined,
      quantity: totalQuantity,
      costPrice: product.cost,
      sellingPrice: product.price,
      batchProduct: { ...product }
    }];
  }

  const result: {
    batchId?: string;
    batchNumber?: string;
    quantity: number;
    costPrice?: number;
    sellingPrice: number;
    batchProduct: Product;
  }[] = [];

  let remaining = totalQuantity;
  for (const b of activeBatches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.remainingQuantity);
    if (take > 0) {
      result.push({
        batchId: b.id,
        batchNumber: b.batchNo,
        quantity: take,
        costPrice: b.costPrice,
        sellingPrice: b.sellingPrice,
        batchProduct: {
          ...product,
          price: b.sellingPrice,
          cost: b.costPrice,
          batchNo: b.batchNo
        }
      });
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const lastBatch = activeBatches[activeBatches.length - 1];
    result.push({
      batchId: lastBatch ? lastBatch.id : undefined,
      batchNumber: lastBatch ? lastBatch.batchNo : product.batchNo || undefined,
      quantity: remaining,
      costPrice: lastBatch ? lastBatch.costPrice : product.cost,
      sellingPrice: lastBatch ? lastBatch.sellingPrice : product.price,
      batchProduct: {
        ...product,
        price: lastBatch ? lastBatch.sellingPrice : product.price,
        cost: lastBatch ? lastBatch.costPrice : product.cost,
        batchNo: lastBatch ? lastBatch.batchNo : product.batchNo
      }
    });
  }

  return result;
}

