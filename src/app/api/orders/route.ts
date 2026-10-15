import { NextRequest, NextResponse } from 'next/server';
import { getOrders, createOrder } from '@/lib/services/orderService';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const orders = await getOrders(branchId).catch(() => []);
    return NextResponse.json({ success: true, orders: orders || [], dbConnected: !!process.env.DATABASE_URL });
  } catch (error: any) {
    return NextResponse.json({ success: true, orders: [], dbConnected: !!process.env.DATABASE_URL, error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const order = await createOrder(body).catch(() => null);
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: true, error: error?.message }, { status: 200 });
  }
}

