import { NextRequest, NextResponse } from 'next/server';
import {
  getAllRecycleBinItems,
  restoreRecycleItemService,
  permanentDeleteRecycleItemService,
  emptyRecycleBinService,
} from '@/lib/services/recycleBinService';
import { RecycleItemType } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get('type') as RecycleItemType | null;

    let items = await getAllRecycleBinItems();
    if (filterType) {
      items = items.filter(i => i.type === filterType);
    }

    return NextResponse.json({ success: true, items, count: items.length });
  } catch (error: any) {
    console.error('Failed to get recycle bin items:', error);
    return NextResponse.json({ success: true, items: [], count: 0, error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, type, id } = body;

    if (action === 'restore') {
      if (!type || !id) {
        return NextResponse.json({ success: false, error: 'type and id are required to restore' }, { status: 400 });
      }
      const success = await restoreRecycleItemService(type, id);
      return NextResponse.json({ success, message: 'Item restored successfully' });
    }

    if (action === 'empty') {
      const result = await emptyRecycleBinService(type);
      return NextResponse.json({ success: true, deletedCount: result.count });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed in recycle bin POST:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let type = searchParams.get('type') as RecycleItemType | null;
    let id = searchParams.get('id');

    if (!id || !type) {
      // Check JSON body
      try {
        const body = await req.json();
        type = type || body.type;
        id = id || body.id;
      } catch {
        // ignore
      }
    }

    if (!id || !type) {
      return NextResponse.json({ success: false, error: 'type and id are required' }, { status: 400 });
    }

    const success = await permanentDeleteRecycleItemService(type, id);
    return NextResponse.json({ success, message: 'Item permanently deleted' });
  } catch (error: any) {
    console.error('Failed in recycle bin DELETE:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
