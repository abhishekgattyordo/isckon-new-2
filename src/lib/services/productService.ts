import { prisma } from '../prisma';
import { MemoryDb } from '../dbStore';
import { Product } from '../../types';
import { INITIAL_PRODUCTS } from '../../data/initialData';
import { generateEan13Barcode } from '../barcodeUtils';
import { getEventAllocations } from './eventService';

if (MemoryDb.products.length === 0) {
  MemoryDb.products = [...INITIAL_PRODUCTS];
}

export interface ProductQueryOptions {
  includeDeleted?: boolean;
  branchId?: string;
  search?: string;
  page?: number;
  limit?: number;
  userEmail?: string;
  stallId?: string;
  eventId?: string;
}

async function filterByStallManifest(
  prods: Product[],
  opts: { userEmail?: string; stallId?: string; eventId?: string }
): Promise<Product[]> {
  const { userEmail, stallId, eventId } = opts;
  if (!userEmail && !stallId && !eventId) {
    return prods;
  }

  const isSuperAdminEmail = userEmail && (
    userEmail.toLowerCase().includes('admin') ||
    userEmail.toLowerCase() === 'abhishekgatty80@gmail.com' ||
    userEmail.toLowerCase() === 'abhishekgatty1@gmail.com' ||
    userEmail.toLowerCase() === 'abhishekgatty58@gmail.com'
  );

  // If superadmin and no stallId was explicitly asked, don't restrict
  if (isSuperAdminEmail && !stallId) {
    return prods;
  }

  const allAllocations = await getEventAllocations(eventId).catch(() => []);
  let targetAllocations = allAllocations;

  if (stallId) {
    targetAllocations = targetAllocations.filter(a => a.stallId === stallId);
  } else if (userEmail) {
    const emailNorm = userEmail.toLowerCase().trim();
    targetAllocations = targetAllocations.filter(a => (a.managerEmail || '').toLowerCase().trim() === emailNorm);
  }

  // Non-admin stall manager or specific stall query
  if (stallId || (userEmail && !isSuperAdminEmail)) {
    if (!targetAllocations || targetAllocations.length === 0) {
      return [];
    }

    const allocSkuMap = new Map<string, typeof targetAllocations[0]>();
    for (const a of targetAllocations) {
      const normSku = (a.sku || '').trim().toUpperCase();
      allocSkuMap.set(normSku, a);
    }

    return prods
      .filter(p => {
        const normSku = (p.sku || '').trim().toUpperCase();
        const alloc = allocSkuMap.get(normSku);
        if (!alloc) return false;
        const remaining = Math.max(0, Number(alloc.allocatedQty) - Number(alloc.soldQty || 0) - Number(alloc.damagedQty || 0));
        return remaining > 0;
      })
      .map(p => {
        const normSku = (p.sku || '').trim().toUpperCase();
        const alloc = allocSkuMap.get(normSku)!;
        const remaining = Math.max(0, Number(alloc.allocatedQty) - Number(alloc.soldQty || 0) - Number(alloc.damagedQty || 0));
        return {
          ...p,
          stock: remaining,
          warehouseZone: alloc.stallName ? `Stall: ${alloc.stallName}` : p.warehouseZone,
          price: alloc.price && Number(alloc.price) > 0 ? Number(alloc.price) : p.price,
          stallAllocation: {
            stallId: alloc.stallId,
            stallName: alloc.stallName,
            allocatedQty: Number(alloc.allocatedQty),
            soldQty: Number(alloc.soldQty || 0),
            remainingQty: remaining
          }
        };
      });
  }

  return prods;
}

export async function getProducts(
  includeDeletedOrOpts: boolean | ProductQueryOptions = false,
  branchIdArg?: string
): Promise<any> {
  let includeDeleted = false;
  let branchId: string | undefined = undefined;
  let search: string | undefined = undefined;
  let page = 1;
  let limit = 1000;
  let isPaginatedRequest = false;
  let userEmail: string | undefined = undefined;
  let stallId: string | undefined = undefined;
  let eventId: string | undefined = undefined;

  if (typeof includeDeletedOrOpts === 'object' && includeDeletedOrOpts !== null) {
    includeDeleted = includeDeletedOrOpts.includeDeleted ?? false;
    branchId = includeDeletedOrOpts.branchId;
    search = includeDeletedOrOpts.search;
    page = includeDeletedOrOpts.page ?? 1;
    limit = includeDeletedOrOpts.limit ?? 20;
    isPaginatedRequest = true;
    userEmail = includeDeletedOrOpts.userEmail;
    stallId = includeDeletedOrOpts.stallId;
    eventId = includeDeletedOrOpts.eventId;
  } else {
    includeDeleted = Boolean(includeDeletedOrOpts);
    branchId = branchIdArg;
  }

  try {
    if (process.env.DATABASE_URL) {
      try {
        const statements = [
          'ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id VARCHAR(255)',
          'ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255)',
          "UPDATE products SET branch_id = 'branch-mangalore', branch_name = 'Mangalore ISKCON Jagannath Mandir' WHERE (branch_id IS NULL OR branch_id = '') AND (sku LIKE 'MGL-%' OR warehouse_zone LIKE '%Mangalore%')",
          "UPDATE products SET branch_id = 'branch-bangalore', branch_name = 'Bangalore ISKCON Sri Radha Krishna Temple' WHERE (branch_id IS NULL OR branch_id = '') AND (sku LIKE 'BLR-%' OR warehouse_zone LIKE '%Bangalore%')",
          "UPDATE products SET branch_id = 'branch-vrindavan-store', branch_name = 'Vrindavan Krishna Balaram Mandir' WHERE (branch_id IS NULL OR branch_id = '') AND (sku LIKE 'VRN-%' OR warehouse_zone LIKE '%Vrindavan%')",
          "UPDATE products SET branch_id = 'branch-mumbai-juhu', branch_name = 'Mumbai Juhu Hare Krishna Land' WHERE (branch_id IS NULL OR branch_id = '') AND (sku LIKE 'BOM-%' OR warehouse_zone LIKE '%Mumbai%' OR warehouse_zone LIKE '%Juhu%')",
          "UPDATE products SET branch_id = 'branch-delhi-glory', branch_name = 'Delhi Glory of India Centre' WHERE (branch_id IS NULL OR branch_id = '') AND (sku LIKE 'DEL-%' OR warehouse_zone LIKE '%Delhi%')",
          "UPDATE products SET branch_id = 'branch-mayapur-hq', branch_name = 'Mayapur HQ Central' WHERE branch_id IS NULL OR branch_id = ''"
        ];
        for (const stmt of statements) {
          await prisma.$executeRawUnsafe(stmt).catch(() => {});
        }
      } catch (e) {}

      const whereClause: any = includeDeleted ? {} : { isDeleted: false };
      if (branchId && branchId !== '*') {
        whereClause.branchId = branchId;
      }
      if (search && search.trim()) {
        const q = search.trim();
        whereClause.OR = [
          { sku: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } }
        ];
      }

      const totalCount = await prisma.product.count({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined
      });

      const skip = (page - 1) * limit;
      const dbProducts = await prisma.product.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        orderBy: { lastUpdated: 'desc' },
        skip: isPaginatedRequest ? skip : undefined,
        take: isPaginatedRequest ? limit : undefined,
      });

      let fifoPriceMap = new Map<string, { price: number; batchNo: string }>();
      try {
        const activeBatches = await prisma.inventoryBatch.findMany({
          where: { remainingQuantity: { gt: 0 } },
          orderBy: [{ receivedDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
        });
        for (const b of activeBatches) {
          const normSku = (b.sku || '').trim().toUpperCase();
          if (!fifoPriceMap.has(normSku)) {
            fifoPriceMap.set(normSku, { price: Number(b.sellingPrice), batchNo: b.batchNo });
          }
        }
      } catch (e) {}

      if (dbProducts) {
        const mapped: Product[] = dbProducts.map(p => {
          const bId = (p as any).branchId || (
            p.sku?.startsWith('MGL-') || p.warehouseZone?.includes('Mangalore') ? 'branch-mangalore' :
            p.sku?.startsWith('BLR-') || p.warehouseZone?.includes('Bangalore') ? 'branch-bangalore' :
            p.sku?.startsWith('VRN-') || p.warehouseZone?.includes('Vrindavan') ? 'branch-vrindavan-store' :
            p.sku?.startsWith('BOM-') || p.warehouseZone?.includes('Mumbai') ? 'branch-mumbai-juhu' :
            p.sku?.startsWith('DEL-') || p.warehouseZone?.includes('Delhi') ? 'branch-delhi-glory' :
            'branch-mayapur-hq'
          );
          const bName = (p as any).branchName || (
            bId === 'branch-mangalore' ? 'Mangalore ISKCON Jagannath Mandir' :
            bId === 'branch-bangalore' ? 'Bangalore ISKCON Sri Radha Krishna Temple' :
            bId === 'branch-vrindavan-store' ? 'Vrindavan Krishna Balaram Mandir' :
            bId === 'branch-mumbai-juhu' ? 'Mumbai Juhu Hare Krishna Land' :
            bId === 'branch-delhi-glory' ? 'Delhi Glory of India Centre' :
            'Mayapur HQ Central'
          );

          const normSku = (p.sku || '').trim().toUpperCase();
          const batchInfo = fifoPriceMap.get(normSku);
          const resolvedPrice = batchInfo ? batchInfo.price : Number(p.price);
          const resolvedBatchNo = batchInfo ? batchInfo.batchNo : (p.batchNo || '');

          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            price: resolvedPrice,
            cost: Number(p.cost),
            stock: p.stock,
            minStock: p.minStock,
            warehouseZone: p.warehouseZone,
            batchNo: resolvedBatchNo,
            barcode: p.barcode || '',
            imageUrl: p.imageUrl || '',
            status: p.status as any,
            lastUpdated: p.lastUpdated ? p.lastUpdated.toISOString() : new Date().toISOString(),
            supplier: p.supplier || '',
            rating: Number(p.rating || 5),
            description: p.description || undefined,
            tags: p.tags || [],
            branchId: bId,
            branchName: bName,
            isDeleted: p.isDeleted || false,
            deletedAt: p.deletedAt ? p.deletedAt.toISOString() : undefined,
            deletedBy: p.deletedBy || undefined,
          };
        });

        let filtered: Product[] = mapped;
        if (branchId && branchId !== '*') {
          filtered = filtered.filter(p => {
            if (p.branchId === branchId) return true;
            if ((branchId === 'branch-bangalore' || branchId === 'BLR-05' || branchId === 'BLR-SK-05') && (p.branchId === 'branch-bangalore' || p.branchId === 'BLR-05' || p.sku?.startsWith('BLR-') || p.branchName?.toLowerCase().includes('bangalore') || p.warehouseZone?.toLowerCase().includes('bangalore'))) return true;
            if ((branchId === 'branch-mangalore' || branchId === 'IXE-06' || branchId === 'IXE-JM-06') && (p.branchId === 'branch-mangalore' || p.branchId === 'IXE-06' || p.sku?.startsWith('MGL-') || p.branchName?.toLowerCase().includes('mangalore') || p.warehouseZone?.toLowerCase().includes('mangalore'))) return true;
            return false;
          });
        }

        filtered = await filterByStallManifest(filtered, { userEmail, stallId, eventId });

        const finalTotal = isPaginatedRequest ? (stallId || userEmail ? filtered.length : totalCount) : filtered.length;
        const totalPages = Math.ceil(finalTotal / limit) || 1;
        const resultProds = isPaginatedRequest && (stallId || userEmail) ? filtered.slice((page - 1) * limit, page * limit) : filtered;

        if (isPaginatedRequest) {
          return {
            products: resultProds,
            totalCount: finalTotal,
            page,
            limit,
            totalPages
          };
        }
        return filtered;
      }
    }
  } catch (error) {
    console.warn('Prisma getProducts failed, falling back to MemoryDb:', error);
  }

  const memBatches = (MemoryDb.batches || [])
    .filter(b => b.remainingQuantity > 0)
    .sort((a, b) => {
      const dComp = (a.receivedDate || '').localeCompare(b.receivedDate || '');
      if (dComp !== 0) return dComp;
      return (a.id || a.batchNo || '').localeCompare(b.id || b.batchNo || '');
    });
  const memFifoMap = new Map<string, { price: number; batchNo: string }>();
  for (const b of memBatches) {
    const normSku = (b.sku || '').trim().toUpperCase();
    if (!memFifoMap.has(normSku)) {
      memFifoMap.set(normSku, { price: Number(b.sellingPrice), batchNo: b.batchNo });
    }
  }

  let list = (MemoryDb.products || []).map(p => {
    const normSku = (p.sku || '').trim().toUpperCase();
    const batchInfo = memFifoMap.get(normSku);
    return {
      ...p,
      price: batchInfo ? batchInfo.price : p.price,
      batchNo: batchInfo ? batchInfo.batchNo : (p.batchNo || '')
    };
  });
  let filtered = includeDeleted ? list : list.filter(p => !p.isDeleted);
  if (branchId && branchId !== '*') {
    filtered = filtered.filter(p => {
      if (p.branchId === branchId) return true;
      if ((branchId === 'branch-bangalore' || branchId === 'BLR-05' || branchId === 'BLR-SK-05') && (p.branchId === 'branch-bangalore' || p.branchId === 'BLR-05' || p.sku?.startsWith('BLR-') || p.branchName?.toLowerCase().includes('bangalore') || p.warehouseZone?.toLowerCase().includes('bangalore'))) return true;
      if ((branchId === 'branch-mangalore' || branchId === 'IXE-06' || branchId === 'IXE-JM-06') && (p.branchId === 'branch-mangalore' || p.branchId === 'IXE-06' || p.sku?.startsWith('MGL-') || p.branchName?.toLowerCase().includes('mangalore') || p.warehouseZone?.toLowerCase().includes('mangalore'))) return true;
      if (branchId === 'branch-mangalore' && (p.sku?.startsWith('MGL-') || p.branchName?.toLowerCase().includes('mangalore') || p.warehouseZone?.toLowerCase().includes('mangalore'))) return true;
      return false;
    });
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(p =>
      p.sku?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    );
  }

  filtered = await filterByStallManifest(filtered, { userEmail, stallId, eventId });

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const paginated = isPaginatedRequest ? filtered.slice((page - 1) * limit, page * limit) : filtered;

  if (isPaginatedRequest) {
    return {
      products: paginated,
      totalCount,
      page,
      limit,
      totalPages
    };
  }
  return paginated;


}

export async function getDeletedProducts(): Promise<Product[]> {
  try {
    if (process.env.DATABASE_URL) {
      const dbProducts = await prisma.product.findMany({
        where: { isDeleted: true },
        orderBy: { deletedAt: 'desc' },
      });

      return dbProducts.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        cost: Number(p.cost),
        stock: p.stock,
        minStock: p.minStock,
        warehouseZone: p.warehouseZone,
        batchNo: p.batchNo || '',
        barcode: p.barcode || '',
        imageUrl: p.imageUrl || '',
        status: p.status as any,
        lastUpdated: p.lastUpdated ? p.lastUpdated.toISOString() : new Date().toISOString(),
        supplier: p.supplier || '',
        rating: Number(p.rating || 5),
        description: p.description || undefined,
        tags: p.tags || [],
        isDeleted: true,
        deletedAt: p.deletedAt ? p.deletedAt.toISOString() : new Date().toISOString(),
        deletedBy: p.deletedBy || undefined,
      }));
    }
  } catch (error) {
    console.warn('Prisma getDeletedProducts failed:', error);
  }

  const list = MemoryDb.products || [];
  return list.filter(p => p.isDeleted);
}

export async function createProduct(prodData: Omit<Product, 'id' | 'lastUpdated'>): Promise<Product> {
  const autoBarcode = prodData.barcode && prodData.barcode.trim() !== ''
    ? prodData.barcode.trim()
    : generateEan13Barcode('890', prodData.sku);

  const initialStock = prodData.stock !== undefined ? Number(prodData.stock) : 0;
  const minStock = prodData.minStock !== undefined ? Number(prodData.minStock) : 0;

  let computedStatus: any = 'in_stock';
  if (prodData.status && (prodData.status as string) !== 'Pending Stock Receipt') {
    computedStatus = prodData.status;
  } else if (initialStock === 0) {
    computedStatus = 'out_of_stock';
  } else if (initialStock <= minStock) {
    computedStatus = 'low_stock';
  } else {
    computedStatus = 'in_stock';
  }

  const batchTag = prodData.batchNo && prodData.batchNo.trim() !== ''
    ? prodData.batchNo.trim()
    : `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newProduct: Product = {
    ...prodData,
    barcode: autoBarcode,
    id: `prod-${Date.now()}`,
    stock: initialStock,
    minStock: minStock,
    status: computedStatus,
    batchNo: batchTag,
    branchId: prodData.branchId || 'branch-mayapur-hq',
    branchName: prodData.branchName || 'Mayapur HQ Central',
    lastUpdated: new Date().toISOString(),
    isDeleted: false,
  };

  try {
    if (process.env.DATABASE_URL) {
      const dbProd = await prisma.product.create({
        data: {
          id: newProduct.id,
          sku: newProduct.sku,
          name: newProduct.name,
          category: newProduct.category,
          price: Number(newProduct.price),
          cost: Number(newProduct.cost),
          stock: initialStock,
          minStock: minStock,
          warehouseZone: newProduct.warehouseZone,
          batchNo: batchTag,
          barcode: autoBarcode,
          imageUrl: newProduct.imageUrl,
          status: computedStatus,
          supplier: newProduct.supplier,
          rating: Number(newProduct.rating || 5),
          description: newProduct.description,
          tags: newProduct.tags || [],
          branchId: newProduct.branchId,
          branchName: newProduct.branchName,
          isDeleted: false,
        },
      });

      // Auto-create initial batch in inventoryBatch table
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await prisma.inventoryBatch.create({
        data: {
          id: batchId,
          sku: newProduct.sku,
          batchNo: batchTag,
          receivedDate: new Date().toISOString().slice(0, 10),
          costPrice: Number(newProduct.cost) || 0,
          sellingPrice: Number(newProduct.price) || 0,
          totalQuantity: initialStock,
          remainingQuantity: initialStock,
          status: initialStock > 0 ? 'in_stock' : 'out_of_stock',
          branchId: newProduct.branchId,
          branchName: newProduct.branchName,
          createdAt: new Date(),
        }
      }).catch(e => console.warn('Could not auto-create initial inventoryBatch in DB:', e));

      if (newProduct.barcode) {
        await prisma.barcodeRecord.create({
          data: {
            id: `bar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            sku: newProduct.sku,
            productName: newProduct.name,
            barcodeValue: newProduct.barcode,
            batchNo: batchTag,
            format: 'code128',
            template: 'retail_tag_1x2',
            generatedAt: new Date().toISOString(),
            printCount: 24,
            purchaseCost: Number(newProduct.cost) || null,
            sellingPrice: Number(newProduct.price) || null,
          }
        }).catch(e => console.warn('Could not auto-create barcodeRecord in DB:', e));
      }

      return {
        id: dbProd.id,
        sku: dbProd.sku,
        name: dbProd.name,
        category: dbProd.category,
        price: Number(dbProd.price),
        cost: Number(dbProd.cost),
        stock: dbProd.stock,
        minStock: dbProd.minStock,
        warehouseZone: dbProd.warehouseZone,
        batchNo: dbProd.batchNo || batchTag,
        barcode: dbProd.barcode || autoBarcode,
        imageUrl: dbProd.imageUrl || '',
        status: dbProd.status as any,
        lastUpdated: dbProd.lastUpdated ? dbProd.lastUpdated.toISOString() : new Date().toISOString(),
        supplier: dbProd.supplier || '',
        rating: Number(dbProd.rating || 5),
        description: dbProd.description || undefined,
        tags: dbProd.tags || [],
        branchId: (dbProd as any).branchId || newProduct.branchId,
        branchName: (dbProd as any).branchName || newProduct.branchName,
        isDeleted: false,
      };
    }
  } catch (error) {
    console.warn('Prisma createProduct failed, saving to MemoryDb:', error);
  }

  if (newProduct.barcode) {
    MemoryDb.barcodeRecords.unshift({
      id: `bar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sku: newProduct.sku,
      productName: newProduct.name,
      barcodeValue: newProduct.barcode,
      batchNo: batchTag,
      format: 'code128',
      template: 'retail_tag_1x2',
      generatedAt: new Date().toISOString(),
      printCount: 24,
      branchId: newProduct.branchId || null,
      branchName: newProduct.branchName || null,
      purchaseCost: Number(newProduct.cost) || null,
      sellingPrice: Number(newProduct.price) || null,
    });
  }

  MemoryDb.batches.unshift({
    id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sku: newProduct.sku,
    batchNo: batchTag,
    receivedDate: new Date().toISOString().slice(0, 10),
    costPrice: Number(newProduct.cost) || 0,
    sellingPrice: Number(newProduct.price) || 0,
    totalQuantity: initialStock,
    remainingQuantity: initialStock,
    status: initialStock > 0 ? 'in_stock' : 'out_of_stock',
    branchId: newProduct.branchId,
    branchName: newProduct.branchName,
  });

  MemoryDb.products.unshift(newProduct);
  return newProduct;
}

export async function updateProductService(id: string, updates: Partial<Product>): Promise<Product | null> {
  try {
    if (process.env.DATABASE_URL) {
      const updated = await prisma.product.update({
        where: { id },
        data: {
          sku: updates.sku,
          name: updates.name,
          category: updates.category,
          price: updates.price !== undefined ? Number(updates.price) : undefined,
          cost: updates.cost !== undefined ? Number(updates.cost) : undefined,
          stock: updates.stock !== undefined ? Number(updates.stock) : undefined,
          minStock: updates.minStock !== undefined ? Number(updates.minStock) : undefined,
          warehouseZone: updates.warehouseZone,
          batchNo: updates.batchNo,
          barcode: updates.barcode,
          imageUrl: updates.imageUrl,
          status: updates.status,
          supplier: updates.supplier,
          rating: updates.rating !== undefined ? Number(updates.rating) : undefined,
          description: updates.description,
          tags: updates.tags,
          branchId: updates.branchId,
          branchName: updates.branchName,
          isDeleted: updates.isDeleted,
          deletedAt: updates.deletedAt ? new Date(updates.deletedAt) : updates.deletedAt === null ? null : undefined,
          deletedBy: updates.deletedBy,
          lastUpdated: new Date(),
        },
      });
      return {
        id: updated.id,
        sku: updated.sku,
        name: updated.name,
        category: updated.category,
        price: Number(updated.price),
        cost: Number(updated.cost),
        stock: updated.stock,
        minStock: updated.minStock,
        warehouseZone: updated.warehouseZone,
        batchNo: updated.batchNo || '',
        barcode: updated.barcode || '',
        imageUrl: updated.imageUrl || '',
        status: updated.status as any,
        lastUpdated: updated.lastUpdated ? updated.lastUpdated.toISOString() : new Date().toISOString(),
        supplier: updated.supplier || '',
        rating: Number(updated.rating || 5),
        description: updated.description || undefined,
        tags: updated.tags || [],
        branchId: (updated as any).branchId || updates.branchId,
        branchName: (updated as any).branchName || updates.branchName,
        isDeleted: updated.isDeleted,
        deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : undefined,
        deletedBy: updated.deletedBy || undefined,
      };
    }
  } catch (error) {
    console.warn('Prisma updateProduct failed, updating in MemoryDb:', error);
  }

  const idx = MemoryDb.products.findIndex(p => p.id === id);
  if (idx !== -1) {
    const updated = { ...MemoryDb.products[idx], ...updates, lastUpdated: new Date().toISOString() };
    MemoryDb.products[idx] = updated;
    return updated;
  }
  return null;
}

export async function softDeleteProductService(id: string, deletedBy = 'System User'): Promise<boolean> {
  const now = new Date();
  try {
    if (process.env.DATABASE_URL) {
      await prisma.product.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy,
          lastUpdated: now,
        },
      });
      return true;
    }
  } catch (error) {
    console.warn('Prisma softDeleteProduct failed:', error);
  }

  const idx = MemoryDb.products.findIndex(p => p.id === id);
  if (idx !== -1) {
    MemoryDb.products[idx] = {
      ...MemoryDb.products[idx],
      isDeleted: true,
      deletedAt: now.toISOString(),
      deletedBy,
    };
    return true;
  }
  return false;
}

export async function restoreProductService(id: string): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL) {
      await prisma.product.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          lastUpdated: new Date(),
        },
      });
      return true;
    }
  } catch (error) {
    console.warn('Prisma restoreProduct failed:', error);
  }

  const idx = MemoryDb.products.findIndex(p => p.id === id);
  if (idx !== -1) {
    MemoryDb.products[idx] = {
      ...MemoryDb.products[idx],
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      lastUpdated: new Date().toISOString(),
    };
    return true;
  }
  return false;
}

export async function permanentDeleteProductService(id: string): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL) {
      await prisma.product.delete({
        where: { id },
      });
      return true;
    }
  } catch (error) {
    console.warn('Prisma permanentDeleteProduct failed:', error);
  }

  const idx = MemoryDb.products.findIndex(p => p.id === id);
  if (idx !== -1) {
    MemoryDb.products.splice(idx, 1);
    return true;
  }
  return false;
}

export const deleteProductService = softDeleteProductService;
