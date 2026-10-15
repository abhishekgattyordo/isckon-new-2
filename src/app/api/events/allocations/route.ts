import { NextRequest, NextResponse } from 'next/server';
import {
  getEventAllocations,
  saveEventAllocation,
  deleteEventAllocation
} from '@/lib/services/eventService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;
    const allocations = await getEventAllocations(eventId).catch(() => []);
    return NextResponse.json({ success: true, allocations });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message, allocations: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.eventId || !body.sku) {
      return NextResponse.json({ success: false, error: 'eventId and sku are required' }, { status: 400 });
    }
    const allocation = await saveEventAllocation(body);
    return NextResponse.json({ success: true, allocation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Allocation ID is required' }, { status: 400 });
    }
    const success = await deleteEventAllocation(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
