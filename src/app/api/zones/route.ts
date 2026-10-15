import { NextRequest, NextResponse } from 'next/server';
import { getWarehouseZones, createWarehouseZone } from '@/lib/services/zoneService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId') || undefined;
    const zones = await getWarehouseZones(branchId);
    return NextResponse.json({ success: true, zones });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.name || !data.code) {
      return NextResponse.json({ success: false, error: 'Zone Name and Code are required' }, { status: 400 });
    }
    const zone = await createWarehouseZone(data);
    return NextResponse.json({ success: true, zone });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
