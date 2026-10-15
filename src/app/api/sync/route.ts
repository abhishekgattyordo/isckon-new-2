import { NextRequest, NextResponse } from 'next/server';
import { MemoryDb } from '@/lib/dbStore';

export async function POST(req: NextRequest) {
  try {
    const { products, inwardNotes, orders, events, salesTags } = await req.json().catch(() => ({}));

    if (process.env.DATABASE_URL) {
      // Database is connected, so database is the absolute source of truth.
      return NextResponse.json({ success: true, message: 'Database is active, sync skipped', dbConnected: true });
    }

    // In-memory fallback: Hydrate server MemoryDb from client localStorage
    if (Array.isArray(products)) {
      MemoryDb.products = [...products];
    }
    if (Array.isArray(inwardNotes)) {
      MemoryDb.inwardNotes = [...inwardNotes];
    }
    if (Array.isArray(orders)) {
      MemoryDb.orders = [...orders];
    }
    if (Array.isArray(events)) {
      MemoryDb.events = [...events];
    }
    if (Array.isArray(salesTags)) {
      MemoryDb.salesTags = [...salesTags];
    }

    return NextResponse.json({ success: true, dbConnected: false });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
