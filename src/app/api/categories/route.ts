import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory } from '@/lib/services/categoryService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const categories = await getCategories();
    return NextResponse.json({
      success: true,
      categories: categories || []
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch categories', categories: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body || !body.name) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    const category = await createCategory(body);
    return NextResponse.json(
      { success: true, category },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
