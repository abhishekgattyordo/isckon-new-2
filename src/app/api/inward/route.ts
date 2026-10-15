import { NextRequest, NextResponse } from 'next/server';
import { getInwardNotes, createInwardNote, softDeleteInwardNoteService, permanentDeleteInwardNoteService, restoreInwardNoteService } from '@/lib/services/inwardService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const branchId = searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const inwardNotes = await getInwardNotes(includeDeleted, branchId).catch(() => []);
    return NextResponse.json({ success: true, inwardNotes: inwardNotes || [], dbConnected: !!process.env.DATABASE_URL });
  } catch (error: any) {
    return NextResponse.json({ success: true, inwardNotes: [], dbConnected: !!process.env.DATABASE_URL, error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'restore' && body.id) {
      const success = await restoreInwardNoteService(body.id);
      return NextResponse.json({ success });
    }
    const inwardNote = await createInwardNote(body).catch(() => null);
    return NextResponse.json({ success: true, inwardNote }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: true, error: error?.message }, { status: 200 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';
    const deletedBy = searchParams.get('deletedBy') || 'Staff User';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Inward Note ID is required' }, { status: 400 });
    }

    const success = permanent
      ? await permanentDeleteInwardNoteService(id)
      : await softDeleteInwardNoteService(id, deletedBy);

    return NextResponse.json({ success, isPermanent: permanent });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
