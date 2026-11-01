import { prisma } from '../prisma';
import { MemoryDb } from '../dbStore';
import { InventoryBatch } from '../../types';
import { INITIAL_BATCHES } from '../../data/initialData';

if (!MemoryDb.batches || MemoryDb.batches.length === 0) {
  MemoryDb.batches = [...INITIAL_BATCHES];
}

/**
 * Returns all inventory batches from PostgreSQL or in-memory fallback.
 */
export async function getBatches(includeOutOfStock = true, branchId?: string): Promise<InventoryBatch[]> {
  try {
    if (process.env.DATABASE_URL) {
      const whereClause: any = {};
      if (!includeOutOfStock) {
        whereClause.remainingQuantity = { gt: 0 };
      }
      if (branchId && branchId !== '*') {
        whereClause.OR = [
          { branchId: branchId },
          { branchId: branchId === 'branch-bangalore' ? 'BLR-05' : branchId === 'BLR-05' ? 'branch-bangalore' : branchId },
          { branchId: branchId === 'branch-mangalore' ? 'IXE-06' : branchId === 'IXE-06' ? 'branch-mangalore' : branchId },
        ];
      }
      const dbBatches = await prisma.inventoryBatch.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        orderBy: [
          { receivedDate: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' }
        ],
      });
      if (dbBatches && dbBatches.length > 0) {
        return dbBatches.map(b => ({
          id: b.id,
          sku: b.sku,
          batchNo: b.batchNo,
          receivedDate: b.receivedDate,
          edition: b.edition || undefined,
          costPrice: Number(b.costPrice),
          sellingPrice: Number(b.sellingPrice),
          totalQuantity: b.totalQuantity,
          remainingQuantity: b.remainingQuantity,
          status: b.status as any,
          grnNumber: b.grnNumber || undefined,
          branchId: b.branchId || undefined,
          branchName: b.branchName || undefined,
          createdAt: b.createdAt ? b.createdAt.toISOString() : undefined,
        }));
      }
    }
  } catch (error) {
    console.warn('Prisma getBatches failed, falling back to MemoryDb:', error);
  }

  const list = MemoryDb.batches || [];
  let res = includeOutOfStock ? list : list.filter(b => b.remainingQuantity > 0);
  if (branchId && branchId !== '*') {
    res = res.filter(b => {
      const bAny = b as any;
      if (bAny.branchId === branchId) return true;
      if (branchId === 'branch-bangalore' && (bAny.branchName?.toLowerCase().includes('bangalore') || b.sku.startsWith('BLR-'))) return true;
      if (branchId === 'branch-mangalore' && (bAny.branchName?.toLowerCase().includes('mangalore') || b.sku.startsWith('MGL-'))) return true;
      return false;
    });
  }
  return res.sort((a, b) => {
    const dComp = (a.receivedDate || '').localeCompare(b.receivedDate || '');
    if (dComp !== 0) return dComp;
    return (a.id || a.batchNo || '').localeCompare(b.id || b.batchNo || '');
  });
}

/**
 * Finds all active batches for a given SKU with remainingQuantity > 0,
 * sorted chronologically by receivedDate (oldest first, with secondary tie-breaker).
 */
export async function getActiveBatchesForSku(sku: string): Promise<InventoryBatch[]> {
  if (!sku) return [];
  const normSku = sku.trim().toUpperCase();

  try {
    if (process.env.DATABASE_URL) {
      const dbBatches = await prisma.inventoryBatch.findMany({
        where: {
          sku: { equals: normSku, mode: 'insensitive' },
          remainingQuantity: { gt: 0 }
        },
        orderBy: [
          { receivedDate: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' }
        ]
      });
      if (dbBatches && dbBatches.length > 0) {
        return dbBatches.map(b => ({
          id: b.id,
          sku: b.sku,
          batchNo: b.batchNo,
          receivedDate: b.receivedDate,
          edition: b.edition || undefined,
          costPrice: Number(b.costPrice),
          sellingPrice: Number(b.sellingPrice),
          totalQuantity: b.totalQuantity,
          remainingQuantity: b.remainingQuantity,
          status: b.status as any,
          grnNumber: b.grnNumber || undefined,
          branchId: b.branchId || undefined,
          branchName: b.branchName || undefined,
          createdAt: b.createdAt ? b.createdAt.toISOString() : undefined,
        }));
      }
    }
  } catch (error) {
    console.warn('Prisma getActiveBatchesForSku failed:', error);
  }

  const list = MemoryDb.batches || [];
  return list
    .filter(b => (b.sku || '').trim().toUpperCase() === normSku && b.remainingQuantity > 0)
    .sort((a, b) => {
      const dComp = (a.receivedDate || '').localeCompare(b.receivedDate || '');
      if (dComp !== 0) return dComp;
      return (a.id || a.batchNo || '').localeCompare(b.id || b.batchNo || '');
    });
}

/**
 * Centralized FIFO Price Resolver:
 * Resolves the selling price of the oldest available inventory batch with remainingQuantity > 0.
 * If oldest batch is exhausted, automatically selects the next available batch.
 * If all batches are exhausted or none exist, falls back to the product's base retail price.
 */
export async function getActiveBatchPrice(sku: string, fallbackPrice = 0): Promise<number> {
  const activeBatches = await getActiveBatchesForSku(sku);
  if (activeBatches.length > 0) {
    return activeBatches[0].sellingPrice;
  }
  return fallbackPrice;
}

/**
 * Allocates quantities across FIFO batches for a given SKU and requested quantity.
 * Returns the exact breakdown of how many units come from each batch and at what selling price.
 */
export async function allocateFifoUnits(
  sku: string,
  quantityNeeded: number,
  fallbackPrice = 0
): Promise<{ batchId?: string; batchNo?: string; quantity: number; sellingPrice: number; costPrice?: number }[]> {
  const activeBatches = await getActiveBatchesForSku(sku);
  const allocations: { batchId?: string; batchNo?: string; quantity: number; sellingPrice: number; costPrice?: number }[] = [];
  let remaining = quantityNeeded;

  for (const batch of activeBatches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.remainingQuantity);
    if (take > 0) {
      allocations.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        quantity: take,
        sellingPrice: batch.sellingPrice,
        costPrice: batch.costPrice
      });
      remaining -= take;
    }
  }

  // If quantity exceeds all active batches, take the remainder from the latest batch or fallback price
  if (remaining > 0) {
    const lastBatch = activeBatches.length > 0 ? activeBatches[activeBatches.length - 1] : undefined;
    allocations.push({
      batchId: lastBatch?.id,
      batchNo: lastBatch?.batchNo,
      quantity: remaining,
      sellingPrice: lastBatch ? lastBatch.sellingPrice : fallbackPrice,
      costPrice: lastBatch?.costPrice
    });
  }

  return allocations;
}

/**
 * Deducts quantities from inventory batches and updates product stock in a database transaction.
 */
export async function deductBatchesInTransaction(
  tx: any,
  items: { sku: string; quantity: number; batchId?: string }[]
): Promise<void> {
  for (const item of items) {
    let remainingToDeduct = item.quantity;
    const normSku = (item.sku || '').trim().toUpperCase();

    // 1. If a specific batch ID was requested, attempt to deduct from that batch first
    if (item.batchId) {
      const specificBatch = await tx.inventoryBatch.findUnique({
        where: { id: item.batchId }
      });
      if (specificBatch && specificBatch.remainingQuantity > 0) {
        const deduct = Math.min(remainingToDeduct, specificBatch.remainingQuantity);
        const newRem = specificBatch.remainingQuantity - deduct;
        const newStatus = newRem === 0 ? 'out_of_stock' : newRem <= 5 ? 'low_stock' : 'in_stock';
        await tx.inventoryBatch.update({
          where: { id: specificBatch.id },
          data: {
            remainingQuantity: newRem,
            status: newStatus
          }
        });
        remainingToDeduct -= deduct;
      }
    }

    // 2. If there is still quantity to deduct, proceed in strict FIFO order across active batches
    if (remainingToDeduct > 0) {
      const activeBatches = await tx.inventoryBatch.findMany({
        where: {
          sku: { equals: normSku, mode: 'insensitive' },
          remainingQuantity: { gt: 0 }
        },
        orderBy: [
          { receivedDate: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' }
        ]
      });

      for (const batch of activeBatches) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(remainingToDeduct, batch.remainingQuantity);
        const newRem = batch.remainingQuantity - deduct;
        const newStatus = newRem === 0 ? 'out_of_stock' : newRem <= 5 ? 'low_stock' : 'in_stock';

        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: {
            remainingQuantity: newRem,
            status: newStatus
          }
        });

        remainingToDeduct -= deduct;
      }
    }
  }
}

/**
 * MemoryDb deduction fallback when running without external PostgreSQL.
 */
export function deductBatchesInMemory(
  items: { sku: string; quantity: number; batchId?: string }[]
): void {
  for (const item of items) {
    let remainingToDeduct = item.quantity;
    const normSku = (item.sku || '').trim().toUpperCase();

    if (item.batchId) {
      const b = MemoryDb.batches.find(x => x.id === item.batchId);
      if (b && b.remainingQuantity > 0) {
        const deduct = Math.min(remainingToDeduct, b.remainingQuantity);
        b.remainingQuantity -= deduct;
        b.status = b.remainingQuantity === 0 ? 'out_of_stock' : b.remainingQuantity <= 5 ? 'low_stock' : 'in_stock';
        remainingToDeduct -= deduct;
      }
    }

    if (remainingToDeduct > 0) {
      const activeBatches = MemoryDb.batches
        .filter(b => (b.sku || '').trim().toUpperCase() === normSku && b.remainingQuantity > 0)
        .sort((a, b) => {
          const dComp = (a.receivedDate || '').localeCompare(b.receivedDate || '');
          if (dComp !== 0) return dComp;
          return (a.id || a.batchNo || '').localeCompare(b.id || b.batchNo || '');
        });

      for (const batch of activeBatches) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(remainingToDeduct, batch.remainingQuantity);
        batch.remainingQuantity -= deduct;
        batch.status = batch.remainingQuantity === 0 ? 'out_of_stock' : batch.remainingQuantity <= 5 ? 'low_stock' : 'in_stock';
        remainingToDeduct -= deduct;
      }
    }
  }
}
