import { NextRequest, NextResponse } from 'next/server';
import {
  getEventTransactions,
  createEventTransaction
} from '@/lib/services/eventService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;
    const transactions = await getEventTransactions(eventId).catch(() => []);
    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message, transactions: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.eventId || !body.orderNumber) {
      return NextResponse.json({ success: false, error: 'eventId and orderNumber are required' }, { status: 400 });
    }
    const transaction = await createEventTransaction(body);
    return NextResponse.json({ success: true, transaction }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
