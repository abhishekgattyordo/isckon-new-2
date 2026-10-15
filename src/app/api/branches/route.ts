import { NextRequest, NextResponse } from 'next/server';
import { getBranches, createBranch, updateBranch, deleteBranch } from '@/lib/services/branchService';

export async function GET(req: NextRequest) {
  try {
    const branches = await getBranches();
    return NextResponse.json({ success: true, branches });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.name || !data.code || !data.city) {
      return NextResponse.json({ success: false, error: 'Branch Name, Code, and City are required' }, { status: 400 });
    }
    const branch = await createBranch(data);
    return NextResponse.json({ success: true, branch });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ success: false, error: 'Branch ID is required' }, { status: 400 });
    }
    const branch = await updateBranch(data.id, data);
    if (!branch) {
      return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, branch });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Branch ID is required' }, { status: 400 });
    }
    const success = await deleteBranch(id);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
