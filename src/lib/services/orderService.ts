import { prisma } from '../prisma';
import { MemoryDb } from '../dbStore';
import { POSOrder } from '../../types';
import { INITIAL_ORDERS } from '../../data/initialData';

if (!MemoryDb.orders || MemoryDb.orders.length === 0) {
  MemoryDb.orders = [...INITIAL_ORDERS];
}

export async function getOrders(branchId?: string): Promise<POSOrder[]> {
  try {
    if (process.env.DATABASE_URL) {
      const whereClause: any = {};
      if (branchId && branchId !== '*') {
        whereClause.OR = [
          { branchId: branchId },
          { branchId: branchId === 'branch-bangalore' ? 'BLR-05' : branchId === 'BLR-05' ? 'branch-bangalore' : branchId },
          { branchId: branchId === 'branch-mangalore' ? 'IXE-06' : branchId === 'IXE-06' ? 'branch-mangalore' : branchId }
        ];
      }
      const dbOrders = await prisma.pOSOrder.findMany({
        where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        include: { items: true },
        orderBy: { orderNumber: 'desc' },
      });
      return (dbOrders || []).map(o => ({
        ...o,
        paymentMethod: o.paymentMethod as any,
        branchId: (o as any).branchId || undefined,
        branchName: (o as any).branchName || undefined,
        items: o.items.map(i => ({
          product: {
            id: i.productId,
            sku: i.productSku,
            name: i.productName,
            category: i.productCategory,
            price: i.productPrice,
            cost: 0,
            stock: 0,
            minStock: 0,
            warehouseZone: '',
            batchNo: '',
            barcode: '',
            imageUrl: '',
            status: 'in_stock' as any,
            lastUpdated: '',
            supplier: '',
            rating: 5,
          },
          quantity: i.quantity,
          discountPercent: i.discountPercent,
          customNote: i.customNote || undefined,
        })),
      } as unknown as POSOrder));
    }
  } catch (error) {
    console.warn('Prisma getOrders failed, falling back to MemoryDb:', error);
  }
  let list = MemoryDb.orders || [];
  if (branchId && branchId !== '*') {
    list = list.filter(o => {
      if (o.branchId === branchId) return true;
      if (branchId === 'branch-bangalore' && (o.branchName?.toLowerCase().includes('bangalore') || o.items?.some(i => i.product.sku.startsWith('BLR-')))) return true;
      if (branchId === 'branch-mangalore' && (o.branchName?.toLowerCase().includes('mangalore') || o.items?.some(i => i.product.sku.startsWith('MGL-')))) return true;
      return false;
    });
  }
  return list;
}

import { deductBatchesInTransaction, deductBatchesInMemory } from './batchService';

export async function createOrder(orderData: any): Promise<POSOrder> {
  const newOrder: POSOrder = {
    ...orderData,
    id: orderData.id || `ord-${Date.now()}`,
    orderNumber: orderData.orderNumber || `#AR-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: orderData.timestamp || 'Just now',
  };

  try {
    if (process.env.DATABASE_URL) {
      const dbOrder = await prisma.$transaction(async (tx) => {
        // Validate stock before selling
        if (newOrder.items && Array.isArray(newOrder.items)) {
          for (const cartItem of newOrder.items) {
            const prod = await tx.product.findFirst({
              where: {
                OR: [
                  { id: cartItem.product?.id },
                  { sku: cartItem.product?.sku }
                ]
              }
            });
            if (prod && prod.stock < Number(cartItem.quantity)) {
              throw new Error(`Insufficient stock for ${prod.name || prod.sku}. Available: ${prod.stock}, requested: ${cartItem.quantity}`);
            }
          }
        }

        const createdOrder = await tx.pOSOrder.create({
          data: {
            id: newOrder.id,
            orderNumber: newOrder.orderNumber,
            subtotal: Number(newOrder.subtotal),
            discountAmount: Number(newOrder.discountAmount),
            taxAmount: Number(newOrder.taxAmount),
            total: Number(newOrder.total),
            paymentMethod: newOrder.paymentMethod,
            timestamp: newOrder.timestamp,
            cashierName: newOrder.cashierName,
            branchId: newOrder.branchId,
            branchName: newOrder.branchName,
            customerPhone: newOrder.customerPhone,
            customerName: newOrder.customerName,
            salesTag: newOrder.salesTag,
            upiId: newOrder.upiId,
            items: {
              create: newOrder.items.map(item => ({
                productId: item.product.id,
                productSku: item.product.sku,
                productName: item.product.name,
                productCategory: item.product.category,
                productPrice: Number(item.sellingPrice ?? item.product.price),
                quantity: Number(item.quantity),
                discountPercent: Number(item.discountPercent),
                customNote: item.customNote,
              })),
            },
          },
          include: { items: true },
        });

        // Deduct inventory batches in FIFO order inside this transaction
        if (newOrder.items && Array.isArray(newOrder.items)) {
          const batchDeductionItems = newOrder.items.map(item => ({
            sku: item.product.sku,
            quantity: Number(item.quantity),
            batchId: item.batchId || undefined
          }));
          await deductBatchesInTransaction(tx, batchDeductionItems);

          // Deduct product master stock
          for (const cartItem of newOrder.items) {
            const prod = await tx.product.findFirst({
              where: {
                OR: [
                  { id: cartItem.product?.id },
                  { sku: cartItem.product?.sku }
                ]
              }
            });
            if (prod) {
              const newStock = Math.max(0, prod.stock - Number(cartItem.quantity));
              await tx.product.update({
                where: { id: prod.id },
                data: {
                  stock: newStock,
                  status: newStock === 0 ? 'out_of_stock' : newStock <= (prod.minStock || 5) ? 'low_stock' : 'in_stock',
                  lastUpdated: new Date()
                },
              });
            }
          }
        }

        return createdOrder;
      });

      return {
        ...dbOrder,
        paymentMethod: dbOrder.paymentMethod as any,
        items: dbOrder.items.map(i => ({
          product: {
            id: i.productId,
            sku: i.productSku,
            name: i.productName,
            category: i.productCategory,
            price: i.productPrice,
            cost: 0,
            stock: 0,
            minStock: 0,
            warehouseZone: '',
            batchNo: '',
            barcode: '',
            imageUrl: '',
            status: 'in_stock' as any,
            lastUpdated: '',
            supplier: '',
            rating: 5,
          },
          quantity: i.quantity,
          discountPercent: i.discountPercent,
          customNote: i.customNote || undefined,
        })),
      } as unknown as POSOrder;
    }
  } catch (error) {
    console.warn('Prisma createOrder failed or rolled back, saving to MemoryDb:', error);
  }

  // Fallback to MemoryDb
  MemoryDb.orders.unshift(newOrder);

  // Deduct batches and stock for sold items in MemoryDb
  if (newOrder.items && Array.isArray(newOrder.items)) {
    const batchDeductionItems = newOrder.items.map(item => ({
      sku: item.product.sku,
      quantity: Number(item.quantity),
      batchId: item.batchId || undefined
    }));
    deductBatchesInMemory(batchDeductionItems);

    newOrder.items.forEach((cartItem: any) => {
      const prod = MemoryDb.products.find(p => p.id === cartItem.product?.id || p.sku === cartItem.product?.sku);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - Number(cartItem.quantity));
        prod.status = prod.stock === 0 ? 'out_of_stock' : prod.stock <= (prod.minStock || 5) ? 'low_stock' : 'in_stock';
      }
    });
  }

  return newOrder;
}

