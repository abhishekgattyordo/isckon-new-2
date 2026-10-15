import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ISKCON Retail ERP Backend API',
    version: '2.5.0',
    timestamp: new Date().toISOString()
  });
}
