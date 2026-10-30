import { prisma } from '../prisma';
import { MemoryDb } from '../dbStore';
import { MaterialInwardNote } from '../../types';
import { INITIAL_INWARD_NOTES } from '../../data/initialData';
import { generateEan13Barcode } from '../barcodeUtils';

if (!MemoryDb.inwardNotes || MemoryDb.inwardNotes.length === 0) {
  MemoryDb.inwardNotes = [...INITIAL_INWARD_NOTES];
}

export async function getInwardNotes(includeDeleted = false, branchId?: string): Promise<MaterialInwardNote[]> {
  try {
    if (process.env.DATABASE_URL) {
      const whereClause: any = includeDeleted ? {} : { isDeleted: false };
      if (branchId && branchId !== '*') {
        whereClause.OR = [
          { branchId: branchId },
          { branchId: branchId === 'branch-bangalore' ? 'BLR-05' : branchId === 'BLR-05' ? 'branch-bangalore' : branchId },
          { branchId: branchId === 'branch-mangalore' ? 'IXE-06' : branchId === 'IXE-06' ? 'branch-mangalore' : branchId }
        ];
      }
      const dbNotes = await prisma.materialInwardNote.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        include: { items: true },
        orderBy: { grnNumber: 'desc' },
      });
      return (dbNotes || []).map(n => ({
        ...n,
        status: n.status as any,
        branchId: (n as any).branchId || undefined,
        branchName: (n as any).branchName || undefined,
        isDeleted: n.isDeleted || false,
        deletedAt: n.deletedAt ? n.deletedAt.toISOString() : undefined,
        deletedBy: n.deletedBy || undefined,
      } as unknown as MaterialInwardNote));
    }
  } catch (error) {
    console.warn('Prisma getInwardNotes failed, falling back to MemoryDb:', error);
  }
  const list = MemoryDb.inwardNotes || [];
  let res = includeDeleted ? list : list.filter(n => !n.isDeleted);
  if (branchId && branchId !== '*') {
    res = res.filter(n => {
      if (n.branchId === branchId) return true;
      if (branchId === 'branch-bangalore' && (n.branchName?.toLowerCase().includes('bangalore') || n.warehouse?.toLowerCase().includes('bangalore') || n.items?.some(i => i.sku.startsWith('BLR-')))) return true;
      if (branchId === 'branch-mangalore' && (n.branchName?.toLowerCase().includes('mangalore') || n.warehouse?.toLowerCase().includes('mangalore') || n.items?.some(i => i.sku.startsWith('MGL-')))) return true;
      return false;
    });
  }
  return res;
}

export async function getDeletedInwardNotes(): Promise<MaterialInwardNote[]> {
  try {
    if (process.env.DATABASE_URL) {
      const dbNotes = await prisma.materialInwardNote.findMany({
        where: { isDeleted: true },
        include: { items: true },
        orderBy: { deletedAt: 'desc' },
      });
      return dbNotes.map(n => ({
        ...n,
        status: n.status as any,
        isDeleted: true,
        deletedAt: n.deletedAt ? n.deletedAt.toISOString() : new Date().toISOString(),
        deletedBy: n.deletedBy || undefined,
      } as unknown as MaterialInwardNote));
    }
  } catch (error) {
    console.warn('Prisma getDeletedInwardNotes failed:', error);
  }
  const list = MemoryDb.inwardNotes || [];
  return list.filter(n => n.isDeleted);
}

export async function createInwardNote(noteData: Omit<MaterialInwardNote, 'id'>): Promise<MaterialInwardNote> {
  const isDraft = noteData.status === 'draft';

  if (!isDraft) {
    if (!noteData.vendorName || !noteData.vendorName.trim()) {
      throw new Error('Validation Error: Vendor Name is mandatory for GRN submission.');
    }
    if (!noteData.poNumber || !noteData.poNumber.trim()) {
      throw new Error('Validation Error: PO Number is mandatory for GRN submission.');
    }
    if (!noteData.items || !Array.isArray(noteData.items) || noteData.items.length === 0) {
      throw new Error('Validation Error: GRN must contain at least one item row.');
    }
    for (const item of noteData.items) {
      if (!item.sku || !item.sku.trim()) {
        throw new Error('Validation Error: Product SKU/Name is mandatory for every item row.');
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        throw new Error(`Validation Error: Quantity must be greater than 0 for item SKU "${item.sku}".`);
      }
    }
  }

  // Consolidate duplicate rows of the same SKU to prevent duplicate line items
  const consolidatedMap = new Map<string, typeof noteData.items[0]>();
  for (const item of (noteData.items || [])) {
    const key = (item.sku || '').trim().toUpperCase();
    if (!key) continue;
    if (consolidatedMap.has(key)) {
      const ex = consolidatedMap.get(key)!;
      ex.quantity = Number(ex.quantity) + Number(item.quantity);
      ex.total = Number(ex.total) + Number(item.total);
      if (item.unitCost) ex.unitCost = item.unitCost;
      if (item.sellingPrice) ex.sellingPrice = item.sellingPrice;
      if (item.batchNo) ex.batchNo = item.batchNo;
    } else {
      consolidatedMap.set(key, { ...item });
    }
  }
  const cleanItems = Array.from(consolidatedMap.values());

  const newNote: MaterialInwardNote = {
    ...noteData,
    vendorName: noteData.vendorName?.trim() || (isDraft ? 'Draft Supplier' : ''),
    poNumber: noteData.poNumber?.trim() || (isDraft ? `DRAFT-PO-${Date.now().toString().slice(-4)}` : ''),
    warehouse: noteData.warehouse || 'Zone A — Main Retail Floor',
    items: cleanItems,
    id: `min-${Date.now()}`,
    isDeleted: false,
    status: isDraft ? 'draft' : (noteData.status || 'completed'),
    totalValue: cleanItems.reduce((acc, i) => acc + (Number(i.total) || 0), 0)
  };

  try {
    if (process.env.DATABASE_URL) {
      const dbNote = await prisma.$transaction(async (tx) => {
        const createdNote = await tx.materialInwardNote.create({
          data: {
            id: newNote.id,
            grnNumber: newNote.grnNumber,
            poNumber: newNote.poNumber,
            vendorName: newNote.vendorName,
            invoiceDate: newNote.invoiceDate || new Date().toISOString().slice(0, 10),
            warehouse: newNote.warehouse,
            status: newNote.status,
            totalValue: Number(newNote.totalValue),
            receivedBy: newNote.receivedBy || 'Store Staff',
            timestamp: newNote.timestamp || new Date().toISOString(),
            notes: newNote.notes,
            isDeleted: false,
            branchId: newNote.branchId,
            branchName: newNote.branchName,
            items: {
              create: cleanItems.map(item => ({
                sku: item.sku,
                name: item.name,
                quantity: Number(item.quantity),
                unitCost: Number(item.unitCost) || 0,
                sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
                batchNo: item.batchNo,
                expiryDate: item.expiryDate || '2035-12-31',
                taxRate: Number(item.taxRate || 0),
                total: Number(item.total),
              })),
            },
          },
          include: { items: true },
        });

        // Only update product stock and catalog prices if NOT draft
        if (!isDraft) {
          for (const item of cleanItems) {
            const barcodeVal = generateEan13Barcode('890', `${item.sku}-${item.batchNo || 'BAT'}-${newNote.grnNumber}-${Math.floor(Number(item.unitCost) || 100)}`);
            const prod = await tx.product.findUnique({ where: { sku: item.sku } });

            if (prod) {
              const newStock = prod.stock + Number(item.quantity);
              const productUpdates: any = {
                stock: newStock,
                cost: item.unitCost != null ? Number(item.unitCost) : prod.cost,
                price: item.sellingPrice != null ? Number(item.sellingPrice) : prod.price,
                batchNo: item.batchNo || prod.batchNo,
                status: newStock > (prod.minStock || 5) ? 'in_stock' : 'low_stock',
                lastUpdated: new Date(),
              };
              if (!prod.barcode || prod.barcode.trim() === '' || prod.barcode === prod.sku) {
                productUpdates.barcode = barcodeVal;
              }
              await tx.product.update({
                where: { sku: item.sku },
                data: productUpdates,
              });
            } else {
              await tx.product.create({
                data: {
                  id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  sku: item.sku,
                  name: item.name || 'General Inventory Item',
                  category: 'General Merchandise',
                  price: item.sellingPrice != null ? Number(item.sellingPrice) : (Number(item.unitCost) * 1.5),
                  cost: Number(item.unitCost) || 0,
                  stock: Number(item.quantity),
                  minStock: 5,
                  warehouseZone: newNote.warehouse || 'Zone A',
                  batchNo: item.batchNo || '',
                  barcode: barcodeVal,
                  status: Number(item.quantity) > 5 ? 'in_stock' : 'low_stock',
                  branchId: newNote.branchId,
                  branchName: newNote.branchName,
                  isDeleted: false,
                }
              });
            }

            await tx.barcodeRecord.create({
              data: {
                id: `bar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                sku: item.sku,
                productName: item.name || 'General Inventory Item',
                barcodeValue: barcodeVal,
                batchNo: item.batchNo || null,
                format: 'code128',
                template: 'retail_tag_1x2',
                generatedAt: new Date().toISOString(),
                printCount: Number(item.quantity) || 1,
                purchaseCost: Number(item.unitCost) || null,
                sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : null,
              }
            });
          }
        }

        return createdNote;
      });

      return {
        ...dbNote,
        status: dbNote.status as any,
        isDeleted: false,
      } as unknown as MaterialInwardNote;
    }
  } catch (error) {
    console.warn('Prisma createInwardNote failed, saving to MemoryDb:', error);
  }

  // Fallback to MemoryDb
  MemoryDb.inwardNotes.unshift(newNote);

  // Only update product stock in MemoryDb if NOT draft
  if (!isDraft) {
    cleanItems.forEach((item: any) => {
      const barcodeVal = generateEan13Barcode('890', `${item.sku}-${item.batchNo || 'BAT'}-${newNote.grnNumber}-${Math.floor(item.unitCost || 100)}`);
      const prod = MemoryDb.products.find(p => p.sku === item.sku);
      if (prod) {
        prod.stock += Number(item.quantity);
        if (item.unitCost) prod.cost = Number(item.unitCost);
        if (item.sellingPrice) prod.price = Number(item.sellingPrice);
        if (item.batchNo) prod.batchNo = item.batchNo;
        prod.status = prod.stock > (prod.minStock || 5) ? 'in_stock' : 'low_stock';
        if (!prod.barcode || prod.barcode.trim() === '' || prod.barcode === prod.sku) {
          prod.barcode = barcodeVal;
        }
      } else {
        MemoryDb.products.unshift({
          id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sku: item.sku,
          name: item.name || 'General Inventory Item',
          category: 'General Merchandise',
          price: item.sellingPrice ? Number(item.sellingPrice) : (Number(item.unitCost) * 1.5),
          cost: Number(item.unitCost),
          stock: Number(item.quantity),
          minStock: 5,
          warehouseZone: newNote.warehouse || 'Zone A',
          batchNo: item.batchNo || '',
          barcode: barcodeVal,
          imageUrl: 'https://images.unsplash.com/photo-1582515073490-39981397c445?w=500&auto=format&fit=crop&q=60',
          supplier: newNote.vendorName || 'General Supplier',
          rating: 5,
          status: Number(item.quantity) > 5 ? 'in_stock' : 'low_stock',
          branchId: newNote.branchId,
          branchName: newNote.branchName,
          isDeleted: false,
          lastUpdated: new Date().toISOString()
        });
      }

      MemoryDb.barcodeRecords.unshift({
        id: `bar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sku: item.sku,
        productName: item.name || 'General Inventory Item',
        barcodeValue: barcodeVal,
        batchNo: item.batchNo || null,
        format: 'code128',
        template: 'retail_tag_1x2',
        generatedAt: new Date().toISOString(),
        printCount: Number(item.quantity) || 1,
        branchId: newNote.branchId || null,
        branchName: newNote.branchName || null,
        grnNumber: newNote.grnNumber,
        purchaseCost: Number(item.unitCost) || null,
        sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
      });
    });
  }

  return newNote;
}

export async function updateInwardNoteService(id: string, updates: Partial<MaterialInwardNote>): Promise<MaterialInwardNote> {
  const existingIndex = MemoryDb.inwardNotes.findIndex(n => n.id === id);
  const existing = existingIndex !== -1 ? MemoryDb.inwardNotes[existingIndex] : null;

  const wasDraft = existing?.status === 'draft';
  const nowCompleted = updates.status === 'completed';

  const updatedNote: MaterialInwardNote = {
    ...(existing || {}),
    ...updates,
    id,
  } as MaterialInwardNote;

  if (existingIndex !== -1) {
    MemoryDb.inwardNotes[existingIndex] = updatedNote;
  } else {
    MemoryDb.inwardNotes.unshift(updatedNote);
  }

  // If transitioning from draft to completed, update product stock and barcodes!
  if (wasDraft && nowCompleted && Array.isArray(updatedNote.items)) {
    updatedNote.items.forEach(async (item: any) => {
      const barcodeVal = generateEan13Barcode('890', `${item.sku}-${item.batchNo || 'BAT'}-${updatedNote.grnNumber}-${Math.floor(item.unitCost || 100)}`);
      const prod = MemoryDb.products.find(p => p.sku === item.sku);
      if (prod) {
        prod.stock += Number(item.quantity || 0);
        if (item.unitCost) prod.cost = Number(item.unitCost);
        if (item.sellingPrice) prod.price = Number(item.sellingPrice);
        if (item.batchNo) prod.batchNo = item.batchNo;
        prod.status = prod.stock > (prod.minStock || 5) ? 'in_stock' : 'low_stock';
        if (!prod.barcode || prod.barcode.trim() === '' || prod.barcode === prod.sku) {
          prod.barcode = barcodeVal;
        }
      }

      MemoryDb.barcodeRecords.unshift({
        id: `bar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sku: item.sku,
        productName: item.name || 'General Inventory Item',
        barcodeValue: barcodeVal,
        batchNo: item.batchNo || null,
        format: 'code128',
        template: 'retail_tag_1x2',
        generatedAt: new Date().toISOString(),
        printCount: Number(item.quantity) || 1,
        branchId: updatedNote.branchId || null,
        branchName: updatedNote.branchName || null,
        grnNumber: updatedNote.grnNumber,
        purchaseCost: Number(item.unitCost) || null,
        sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
      });

      if (process.env.DATABASE_URL) {
        try {
          const dbProd = await prisma.product.findUnique({ where: { sku: item.sku } });
          if (dbProd) {
            const newStock = dbProd.stock + Number(item.quantity || 0);
            const productUpdates: any = {
              stock: newStock,
              cost: item.unitCost ? Number(item.unitCost) : dbProd.cost,
              price: item.sellingPrice ? Number(item.sellingPrice) : dbProd.price,
              batchNo: item.batchNo || dbProd.batchNo,
              status: newStock > (dbProd.minStock || 5) ? 'in_stock' : 'low_stock',
              lastUpdated: new Date(),
            };
            if (!dbProd.barcode || dbProd.barcode.trim() === '' || dbProd.barcode === dbProd.sku) {
              productUpdates.barcode = barcodeVal;
            }
            await prisma.product.update({
              where: { sku: item.sku },
              data: productUpdates,
            });
          }

          await prisma.barcodeRecord.create({
            data: {
              id: `bar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              sku: item.sku,
              productName: item.name || 'General Inventory Item',
              barcodeValue: barcodeVal,
              batchNo: item.batchNo || null,
              format: 'code128',
              template: 'retail_tag_1x2',
              generatedAt: new Date().toISOString(),
              printCount: Number(item.quantity) || 1,
              purchaseCost: Number(item.unitCost) || null,
              sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
            }
          }).catch(() => {});
        } catch (e) {}
      }
    });
  }

  try {
    if (process.env.DATABASE_URL) {
      await prisma.materialInwardNote.update({
        where: { id },
        data: {
          vendorName: updates.vendorName,
          poNumber: updates.poNumber,
          warehouse: updates.warehouse,
          invoiceDate: updates.invoiceDate,
          status: updates.status,
          totalValue: updates.totalValue !== undefined ? Number(updates.totalValue) : undefined,
          notes: updates.notes,
        }
      });
    }
  } catch (err) {
    console.warn('Prisma updateInwardNote failed:', err);
  }

  return updatedNote;
}

export async function softDeleteInwardNoteService(id: string, deletedBy = 'System User'): Promise<boolean> {
  const now = new Date();
  try {
    if (process.env.DATABASE_URL) {
      await prisma.materialInwardNote.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy,
        },
      });
      return true;
    }
  } catch (error) {
    console.warn('Prisma softDeleteInwardNote failed:', error);
  }

  const idx = MemoryDb.inwardNotes.findIndex(n => n.id === id);
  if (idx !== -1) {
    MemoryDb.inwardNotes[idx] = {
      ...MemoryDb.inwardNotes[idx],
      isDeleted: true,
      deletedAt: now.toISOString(),
      deletedBy,
    };
    return true;
  }
  return false;
}

export async function restoreInwardNoteService(id: string): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL) {
      await prisma.materialInwardNote.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      });
      return true;
    }
  } catch (error) {
    console.warn('Prisma restoreInwardNote failed:', error);
  }

  const idx = MemoryDb.inwardNotes.findIndex(n => n.id === id);
  if (idx !== -1) {
    MemoryDb.inwardNotes[idx] = {
      ...MemoryDb.inwardNotes[idx],
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
    };
    return true;
  }
  return false;
}

export async function permanentDeleteInwardNoteService(id: string): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL) {
      await prisma.materialInwardNote.delete({
        where: { id },
      });
      return true;
    }
  } catch (error) {
    console.warn('Prisma permanentDeleteInwardNote failed:', error);
  }

  const idx = MemoryDb.inwardNotes.findIndex(n => n.id === id);
  if (idx !== -1) {
    MemoryDb.inwardNotes.splice(idx, 1);
    return true;
  }
  return false;
}

export const deleteInwardNoteService = softDeleteInwardNoteService;
