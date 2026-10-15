import { NextRequest, NextResponse } from 'next/server';
import { getUsers, createUser, updateUserService, softDeleteUserService, permanentDeleteUserService, restoreUserService } from '@/lib/services/userService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const branchId = searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const users = await getUsers(includeDeleted, branchId);
    const dbConnected = Boolean(process.env.DATABASE_URL);
    return NextResponse.json({ success: true, users, dbConnected });
  } catch (error: any) {
    console.error('Failed to get users:', error);
    return NextResponse.json({ success: true, users: [], error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === 'restore' && body.id) {
      const success = await restoreUserService(body.id);
      return NextResponse.json({ success });
    }
    if (!body.name || !body.email) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }
    const newUser = await createUser(body);
    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }
    const updated = await updateUserService(id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('Failed to update user:', error);
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
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const success = permanent
      ? await permanentDeleteUserService(id)
      : await softDeleteUserService(id, deletedBy);

    return NextResponse.json({ success, isPermanent: permanent });
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
