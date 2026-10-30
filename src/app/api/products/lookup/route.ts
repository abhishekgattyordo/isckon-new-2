import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MemoryDb } from '@/lib/dbStore';
import { Product, POSOrder } from '@/types';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawCode = url.searchParams.get('code');
  const typeParam = url.searchParams.get('type');

  if (!rawCode) {
    console.warn('[BARCODE LOOKUP API] Received empty lookup request.');
    return NextResponse.json({ success: false, error: 'Code is required' }, { status: 400 });
  }

  // Normalize incoming barcode/code
  let cleanInput = rawCode.trim();
  if (cleanInput.startsWith('*') && cleanInput.endsWith('*') && cleanInput.length > 2) {
    cleanInput = cleanInput.slice(1, -1).trim();
  }

  console.log(`\n=================== [BARCODE LOOKUP BACKEND START] ===================`);
  console.log(`[BARCODE LOOKUP API] Input: "${rawCode}" -> Cleaned: "${cleanInput}" (Type Filter: ${typeParam || 'None'})`);

  const dbConnected = !!process.env.DATABASE_URL;
  console.log(`[BARCODE LOOKUP API] PostgreSQL Database Connected: ${dbConnected}`);

  try {
    if (dbConnected) {
      const cleanInputDigits = cleanInput.replace(/[^0-9]/g, '');

      // 1. Exact match by Product Barcode
      console.log(`[BARCODE LOOKUP API] Querying Products table by barcode: "${cleanInput}"...`);
      let dbProduct = await prisma.product.findFirst({
        where: {
          OR: [
            { barcode: cleanInput },
            ...(cleanInputDigits.length >= 6 ? [{ barcode: cleanInputDigits }] : [])
          ]
        }
      });

      if (dbProduct) {
        console.log(`[BARCODE LOOKUP API] SUCCESS: Found exact match by Product Barcode. ID: ${dbProduct.id}, SKU: ${dbProduct.sku}, Name: "${dbProduct.name}"`);
        const mappedProduct = mapDbProduct(dbProduct);
        console.log(`[BARCODE LOOKUP API] API Response: { success: true, type: 'product', item: "${mappedProduct.name}" }`);
        console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
        return NextResponse.json({ success: true, type: 'product', product: mappedProduct, dbConnected: true });
      }

      // 2. Match by Product SKU (case insensitive)
      console.log(`[BARCODE LOOKUP API] No barcode match. Querying Products table by SKU (case-insensitive): "${cleanInput}"...`);
      dbProduct = await prisma.product.findFirst({
        where: { sku: { equals: cleanInput, mode: 'insensitive' } }
      });

      if (dbProduct) {
        console.log(`[BARCODE LOOKUP API] SUCCESS: Found exact match by Product SKU. ID: ${dbProduct.id}, SKU: ${dbProduct.sku}, Name: "${dbProduct.name}"`);
        const mappedProduct = mapDbProduct(dbProduct);
        console.log(`[BARCODE LOOKUP API] API Response: { success: true, type: 'product', item: "${mappedProduct.name}" }`);
        console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
        return NextResponse.json({ success: true, type: 'product', product: mappedProduct, dbConnected: true });
      }

      // 3. Match by BarcodeRecord barcode_value
      console.log(`[BARCODE LOOKUP API] No SKU match. Querying BarcodeRecords table by barcode_value: "${cleanInput}"...`);
      const barcodeRecord = await prisma.barcodeRecord.findFirst({
        where: {
          OR: [
            { barcodeValue: cleanInput },
            ...(cleanInputDigits.length >= 6 ? [{ barcodeValue: cleanInputDigits }] : []),
            { barcodeValue: { equals: cleanInput, mode: 'insensitive' } }
          ]
        }
      });

      if (barcodeRecord) {
        console.log(`[BARCODE LOOKUP API] Found custom barcode record. Mapping barcode value "${cleanInput}" to SKU "${barcodeRecord.sku}"...`);
        dbProduct = await prisma.product.findFirst({
          where: { sku: { equals: barcodeRecord.sku, mode: 'insensitive' } }
        });

        if (dbProduct) {
          console.log(`[BARCODE LOOKUP API] SUCCESS: Found custom barcode match in Products. ID: ${dbProduct.id}, SKU: ${dbProduct.sku}, Name: "${dbProduct.name}"`);
          const mappedProduct = mapDbProduct(dbProduct);
          console.log(`[BARCODE LOOKUP API] API Response: { success: true, type: 'product', item: "${mappedProduct.name}" }`);
          console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
          return NextResponse.json({ success: true, type: 'product', product: mappedProduct, dbConnected: true });
        }
      }

      // 4. Exact match by POS Order Number (Invoice)
      if (typeParam !== 'product') {
        console.log(`[BARCODE LOOKUP API] No Product match. Querying POSOrders table by orderNumber or ID: "${cleanInput}"...`);
        const dbOrder = await prisma.pOSOrder.findFirst({
          where: {
            OR: [
              { orderNumber: { equals: cleanInput, mode: 'insensitive' } },
              { id: { equals: cleanInput, mode: 'insensitive' } }
            ]
          },
          include: { items: true }
        });

        if (dbOrder) {
          console.log(`[BARCODE LOOKUP API] SUCCESS: Found matching Invoice. ID: ${dbOrder.id}, Order Number: ${dbOrder.orderNumber}`);
          const mappedOrder = {
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
          };
          console.log(`[BARCODE LOOKUP API] API Response: { success: true, type: 'order', item: "${mappedOrder.orderNumber}" }`);
          console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
          return NextResponse.json({ success: true, type: 'order', order: mappedOrder, dbConnected: true });
        }
      }

      console.log(`[BARCODE LOOKUP API] No matching records found in PostgreSQL database.`);
      console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
      return NextResponse.json({ success: false, error: 'Product or invoice not found', dbConnected: true });
    }
  } catch (err: any) {
    console.error(`[BARCODE LOOKUP API] Database query failed:`, err);
  }

  // Fallback to MemoryDb / Mock Data lookup ONLY if database is NOT connected
  console.log(`[BARCODE LOOKUP API] No database connected. Falling back to MemoryDb searching...`);

  const cleanInputDigits = cleanInput.replace(/[^0-9]/g, '');

  // 1. Product by barcode or SKU
  let memoryProduct = MemoryDb.products.find(p => 
    p.barcode === cleanInput || 
    (cleanInputDigits.length >= 6 && p.barcode === cleanInputDigits) ||
    p.sku.toLowerCase() === cleanInput.toLowerCase()
  );

  // If not found in product barcodes directly, check MemoryDb.barcodeRecords
  if (!memoryProduct && Array.isArray(MemoryDb.barcodeRecords)) {
    const memRecord = MemoryDb.barcodeRecords.find(b => 
      b.barcodeValue === cleanInput || 
      (cleanInputDigits.length >= 6 && b.barcodeValue === cleanInputDigits) ||
      b.sku?.toLowerCase() === cleanInput.toLowerCase()
    );
    if (memRecord) {
      memoryProduct = MemoryDb.products.find(p => p.sku.toLowerCase() === memRecord.sku.toLowerCase());
    }
  }

  if (memoryProduct) {
    console.log(`[BARCODE LOOKUP API] SUCCESS (MemoryDb): Found product: ID: ${memoryProduct.id}, SKU: ${memoryProduct.sku}, Name: "${memoryProduct.name}"`);
    console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
    return NextResponse.json({ success: true, type: 'product', product: memoryProduct, dbConnected: false });
  }

  // 2. Order by orderNumber or ID
  if (typeParam !== 'product') {
    const memoryOrder = MemoryDb.orders.find(o => 
      o.orderNumber.toLowerCase() === cleanInput.toLowerCase() || 
      o.id.toLowerCase() === cleanInput.toLowerCase()
    );

    if (memoryOrder) {
      console.log(`[BARCODE LOOKUP API] SUCCESS (MemoryDb): Found order: ID: ${memoryOrder.id}, Order Number: ${memoryOrder.orderNumber}`);
      console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
      return NextResponse.json({ success: true, type: 'order', order: memoryOrder, dbConnected: false });
    }
  }

  console.log(`[BARCODE LOOKUP API] FAILURE: No product or invoice matching "${cleanInput}" was found.`);
  console.log(`=================== [BARCODE LOOKUP BACKEND END] ===================\n`);
  return NextResponse.json({ success: false, error: 'Product or invoice not found', dbConnected });
}

function mapDbProduct(p: any): Product {
  return {
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
  };
}
