import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MemoryDb } from '@/lib/dbStore';
import { INITIAL_BARCODES } from '@/data/initialData';

export const dynamic = 'force-dynamic';

if (!MemoryDb.barcodeRecords || MemoryDb.barcodeRecords.length === 0) {
  MemoryDb.barcodeRecords = [...INITIAL_BARCODES];
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const sku = url.searchParams.get('sku') || undefined;

    if (process.env.DATABASE_URL) {
      try {
        const whereClause: any = {};
        if (branchId && branchId !== '*') {
          whereClause.OR = [
            { branchId: branchId },
            { branchId: null }
          ];
        }
        if (sku) {
          whereClause.sku = sku;
        }

        const dbRecords = await prisma.barcodeRecord.findMany({
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          orderBy: { generatedAt: 'desc' }
        });

        if (dbRecords && dbRecords.length > 0) {
          return NextResponse.json({
            success: true,
            barcodes: dbRecords,
            dbConnected: true
          });
        }
      } catch (e) {
        console.warn('Prisma barcode query failed, falling back to MemoryDb:', e);
      }
    }

    let records = MemoryDb.barcodeRecords || [];
    if (sku) {
      records = records.filter(r => r.sku?.toLowerCase() === sku.toLowerCase());
    }
    return NextResponse.json({
      success: true,
      barcodes: records,
      dbConnected: !!process.env.DATABASE_URL
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      barcodes: MemoryDb.barcodeRecords || [],
      error: error?.message
    }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const records = Array.isArray(body) ? body : [body];
    const created: any[] = [];

    for (const r of records) {
      if (!r.sku || !r.barcodeValue) continue;

      const recordItem = {
        id: r.id || `bar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sku: String(r.sku).trim(),
        productName: String(r.productName || r.name || 'Product Item').trim(),
        barcodeValue: String(r.barcodeValue).trim(),
        batchNo: r.batchNo ? String(r.batchNo) : null,
        format: r.format || 'code128',
        template: r.template || 'retail_tag_1x2',
        generatedAt: r.generatedAt || new Date().toISOString(),
        printCount: Number(r.printCount) || 1,
        batchId: r.batchId ? String(r.batchId) : null,
        branchId: r.branchId ? String(r.branchId) : null,
        branchName: r.branchName ? String(r.branchName) : null,
        grnNumber: r.grnNumber ? String(r.grnNumber) : null,
        purchaseCost: r.purchaseCost !== undefined ? Number(r.purchaseCost) : null,
        sellingPrice: r.sellingPrice !== undefined ? Number(r.sellingPrice) : null,
      };

      if (process.env.DATABASE_URL) {
        try {
          const upserted = await prisma.barcodeRecord.upsert({
            where: { id: recordItem.id },
            update: {
              productName: recordItem.productName,
              barcodeValue: recordItem.barcodeValue,
              batchNo: recordItem.batchNo,
              printCount: recordItem.printCount,
              purchaseCost: recordItem.purchaseCost,
              sellingPrice: recordItem.sellingPrice,
            },
            create: {
              id: recordItem.id,
              sku: recordItem.sku,
              productName: recordItem.productName,
              barcodeValue: recordItem.barcodeValue,
              batchNo: recordItem.batchNo,
              format: recordItem.format,
              template: recordItem.template,
              generatedAt: recordItem.generatedAt,
              printCount: recordItem.printCount,
              batchId: recordItem.batchId,
              purchaseCost: recordItem.purchaseCost,
              sellingPrice: recordItem.sellingPrice,
            },
          });
          created.push(upserted);

          // ALSO ensure Product table has this barcode if currently empty!
          const existingProd = await prisma.product.findUnique({
            where: { sku: recordItem.sku }
          });
          if (existingProd && (!existingProd.barcode || existingProd.barcode === existingProd.sku)) {
            await prisma.product.update({
              where: { sku: recordItem.sku },
              data: { barcode: recordItem.barcodeValue }
            }).catch(() => {});
          }
        } catch (dbErr) {
          console.warn('Prisma barcodeRecord save error:', dbErr);
        }
      }

      // Sync into MemoryDb
      const existingIdx = MemoryDb.barcodeRecords.findIndex(b => b.barcodeValue === recordItem.barcodeValue || b.id === recordItem.id);
      if (existingIdx >= 0) {
        MemoryDb.barcodeRecords[existingIdx] = { ...MemoryDb.barcodeRecords[existingIdx], ...recordItem };
      } else {
        MemoryDb.barcodeRecords.unshift(recordItem);
      }

      const memProd = MemoryDb.products.find(p => p.sku === recordItem.sku);
      if (memProd && (!memProd.barcode || memProd.barcode === memProd.sku)) {
        memProd.barcode = recordItem.barcodeValue;
      }

      if (!created.some(c => c.id === recordItem.id)) {
        created.push(recordItem);
      }
    }

    return NextResponse.json({ success: true, count: created.length, barcodes: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
