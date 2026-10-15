import { NextRequest, NextResponse } from 'next/server';
import { getProducts, createProduct, updateProductService, softDeleteProductService, permanentDeleteProductService, restoreProductService } from '@/lib/services/productService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const branchId = url.searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 500;

    const result = await getProducts({ includeDeleted, branchId, search, page, limit });
    return NextResponse.json({
      success: true,
      products: result.products || [],
      totalCount: result.totalCount || 0,
      page: result.page || 1,
      limit: result.limit || limit,
      totalPages: result.totalPages || 1,
      dbConnected: !!process.env.DATABASE_URL
    });
  } catch (error: any) {
    return NextResponse.json({ success: true, products: [], totalCount: 0, page: 1, limit: 20, totalPages: 1, dbConnected: !!process.env.DATABASE_URL, error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'restore' && body.id) {
      const success = await restoreProductService(body.id);
      return NextResponse.json({ success });
    }
    const product = await createProduct(body).catch(() => null);
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: true, error: error?.message }, { status: 200 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, updates } = await req.json().catch(() => ({}));
    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }
    const product = await updateProductService(id, updates);
    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 200 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const permanent = url.searchParams.get('permanent') === 'true';
    const deletedBy = url.searchParams.get('deletedBy') || 'Staff User';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const success = permanent
      ? await permanentDeleteProductService(id)
      : await softDeleteProductService(id, deletedBy);

    return NextResponse.json({ success, isPermanent: permanent });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 200 });
  }
}
