import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, createAuditLog, getStockMovements, createStockMovement } from '@/lib/services/auditService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const logs = await getAuditLogs(branchId).catch(() => []);
    const movements = await getStockMovements(branchId).catch(() => []);
    return NextResponse.json({ success: true, logs: logs || [], movements: movements || [] });
  } catch (error: any) {
    return NextResponse.json({ success: true, logs: [], movements: [], error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    if (body.isMovement || body.type === 'movement') {
      const { isMovement, movementType, type, ...data } = body;
      const finalType = movementType || (type && type !== 'movement' ? type : 'stock_adjustment');
      const movement = await createStockMovement({ ...data, type: finalType }).catch(() => null);
      return NextResponse.json({ success: true, movement }, { status: 201 });
    } else {
      const { type, ...data } = body;
      const log = await createAuditLog(data).catch(() => null);
      return NextResponse.json({ success: true, log }, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: true, error: error?.message }, { status: 200 });
  }
}

