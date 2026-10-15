import { NextRequest, NextResponse } from 'next/server';
import { getReportsSummary } from '@/lib/services/reportService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get('branchId') || req.headers.get('x-branch-id') || undefined;
    const reportData = await getReportsSummary(branchId);
    return NextResponse.json(reportData);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
