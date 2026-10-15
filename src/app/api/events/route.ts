import { NextRequest, NextResponse } from 'next/server';
import {
  getEvents,
  createEvent,
  updateEventService,
  softDeleteEventService,
  permanentDeleteEventService,
  restoreEventService,
  getEventAllocations,
  saveEventAllocation,
  getEventTransactions,
  createEventTransaction
} from '@/lib/services/eventService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const eventId = searchParams.get('eventId') || undefined;

    if (type === 'allocations') {
      const allocations = await getEventAllocations(eventId).catch(() => []);
      return NextResponse.json({ success: true, allocations });
    }

    if (type === 'transactions') {
      const transactions = await getEventTransactions(eventId).catch(() => []);
      return NextResponse.json({ success: true, transactions });
    }

    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const branchId = searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const events = await getEvents(includeDeleted, branchId).catch(() => []);
    return NextResponse.json({ success: true, events: events || [], dbConnected: !!process.env.DATABASE_URL });
  } catch (error: any) {
    return NextResponse.json({ success: true, events: [], dbConnected: !!process.env.DATABASE_URL, error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'restore' && body.id) {
      const success = await restoreEventService(body.id);
      return NextResponse.json({ success });
    }

    if (body.type === 'allocation') {
      const allocation = await saveEventAllocation(body.data || body);
      return NextResponse.json({ success: true, allocation }, { status: 201 });
    }

    if (body.type === 'transaction') {
      const transaction = await createEventTransaction(body.data || body);
      return NextResponse.json({ success: true, transaction }, { status: 201 });
    }

    const event = await createEvent(body).catch((err) => {
      console.warn('Failed in createEvent:', err);
      return null;
    });
    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body.id;
    const updates = body.updates || body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Event ID is required for update' }, { status: 400 });
    }

    const event = await updateEventService(id, updates);
    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';
    const deletedBy = searchParams.get('deletedBy') || 'Staff User';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Event ID is required' }, { status: 400 });
    }

    const success = permanent
      ? await permanentDeleteEventService(id)
      : await softDeleteEventService(id, deletedBy);

    return NextResponse.json({ success, isPermanent: permanent });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 200 });
  }
}
