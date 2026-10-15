import { prisma } from '../prisma';
import { MemoryDb } from '../dbStore';
import { MaterialInwardNote } from '../../types';
import { INITIAL_INWARD_NOTES } from '../../data/initialData';

if (!MemoryDb.inwardNotes || MemoryDb.inwardNotes.length === 0) {
  MemoryDb.inwardNotes = [...INITIAL_INWARD_NOTES];
}

export async function getInwardNotes(includeDeleted = false, branchId?: string): Promise<MaterialInwardNote[]> {
  try {
    if (process.env.DATABASE_URL) {
      const whereClause: any = includeDeleted ? {} : { isDeleted: false };
      if (branchId && branchId !== '*') {
        whereClause.branchId = branchId;
      }
      const dbNotes = await prisma.materialInwardNote.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        include: { items: true },
        orderBy: { grnNumber: 'desc' },
      });
      if (dbNotes && dbNotes.length > 0) {
        return dbNotes.map(n => ({
          ...n,
          status: n.status as any,
          branchId: (n as any).branchId || undefined,
          branchName: (n as any).branchName || undefined,
          isDeleted: n.isDeleted || false,
          deletedAt: n.deletedAt ? n.deletedAt.toISOString() : undefined,
          deletedBy: n.deletedBy || undefined,
        } as unknown as MaterialInwardNote));
      }
    }
  } catch (error) {
    console.warn('Prisma getInwardNotes failed, falling back to MemoryDb:', error);
  }
  const list = MemoryDb.inwardNotes && MemoryDb.inwardNotes.length > 0 ? MemoryDb.inwardNotes : INITIAL_INWARD_NOTES;
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

  // Consolidate duplicate rows of the same SKU to prevent duplicate line items
  const consolidatedMap = new Map<string, typeof noteData.items[0]>();
  for (const item of noteData.items) {
    const key = (item.sku || '').trim().toUpperCase();
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
    items: cleanItems,
    id: `min-${Date.now()}`,
    isDeleted: false,
  };

  try {
    if (process.env.DATABASE_URL) {
      const dbNote = await prisma.materialInwardNote.create({
        data: {
          id: newNote.id,
          grnNumber: newNote.grnNumber,
          poNumber: newNote.poNumber,
          vendorName: newNote.vendorName,
          invoiceDate: newNote.invoiceDate,
          warehouse: newNote.warehouse,
          status: newNote.status,
          totalValue: Number(newNote.totalValue),
          receivedBy: newNote.receivedBy,
          timestamp: newNote.timestamp,
          notes: newNote.notes,
          isDeleted: false,
          branchId: newNote.branchId,
          branchName: newNote.branchName,
          items: {
            create: cleanItems.map(item => ({
              sku: item.sku,
              name: item.name,
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
              batchNo: item.batchNo,
              expiryDate: item.expiryDate,
              taxRate: Number(item.taxRate),
              total: Number(item.total),
            })),
          },
        },
        include: { items: true },
      });

      // Update product stocks, costs, and selling prices (or create if newly introduced item)
      for (const item of cleanItems) {
        const prod = await prisma.product.findUnique({ where: { sku: item.sku } });
        if (prod) {
          await prisma.product.update({
            where: { sku: item.sku },
            data: {
              stock: prod.stock + Number(item.quantity),
              cost: item.unitCost ? Number(item.unitCost) : prod.cost,
              price: item.sellingPrice ? Number(item.sellingPrice) : prod.price,
              batchNo: item.batchNo || prod.batchNo,
              lastUpdated: new Date(),
            },
          });
        } else {
          // Auto-create product record if inwarding a newly created SKU
          await prisma.product.create({
            data: {
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
              status: Number(item.quantity) > 5 ? 'in_stock' : 'low_stock',
              branchId: newNote.branchId,
              branchName: newNote.branchName,
              isDeleted: false,
            }
          }).catch(err => console.warn('Could not auto-create product in DB:', err));
        }
      }

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

  // Automatically update product stock, cost, and selling price in MemoryDb (or add product)
  cleanItems.forEach((item: any) => {
    const prod = MemoryDb.products.find(p => p.sku === item.sku);
    if (prod) {
      prod.stock += Number(item.quantity);
      if (item.unitCost) prod.cost = Number(item.unitCost);
      if (item.sellingPrice) prod.price = Number(item.sellingPrice);
      if (item.batchNo) prod.batchNo = item.batchNo;
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
        barcode: item.sku,
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
  });

  return newNote;
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
