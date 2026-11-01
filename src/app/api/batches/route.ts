import { NextRequest, NextResponse } from 'next/server';
import { getBatches, getActiveBatchPrice, getActiveBatchesForSku } from '@/lib/services/batchService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const sku = url.searchParams.get('sku') || undefined;
    const includeOutOfStock = url.searchParams.get('includeOutOfStock') !== 'false';

    const batches = await getBatches(includeOutOfStock, branchId);

    let activeBatchPrice: number | undefined;
    if (sku) {
      activeBatchPrice = await getActiveBatchPrice(sku);
    }

    return NextResponse.json({
      success: true,
      batches: batches || [],
      activeBatchPrice,
      dbConnected: !!process.env.DATABASE_URL
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      batches: [],
      dbConnected: !!process.env.DATABASE_URL,
      error: error?.message
    }, { status: 200 });
  }
}
