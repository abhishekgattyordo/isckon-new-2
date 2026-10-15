import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return NextResponse.json({
      connected: false,
      status: 'Disconnected',
      message: 'DATABASE_URL environment variable is not defined. Running in memory / localStorage fallback mode.',
      latencyMs: null,
      details: null,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      return NextResponse.json({
        connected: false,
        status: 'Client Initialization Failed',
        message: 'Could not initialize Prisma client.',
        latencyMs: null,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Run query to verify connection
    const dbCheck = await prisma.$queryRaw<Array<{ current_database: string; now: Date }>>`
      SELECT current_database(), now();
    `;
    const latencyMs = Date.now() - startTime;

    // Fetch counts from database safely
    const [userCount, productCount, branchCount, orderCount, inwardCount] = await Promise.all([
      (prisma.user ? prisma.user.count() : Promise.resolve(0)).catch(() => 0),
      (prisma.product ? prisma.product.count() : Promise.resolve(0)).catch(() => 0),
      (prisma.branch ? prisma.branch.count() : Promise.resolve(0)).catch(() => 0),
      ((prisma as any).pOSOrder ? (prisma as any).pOSOrder.count() : Promise.resolve(0)).catch(() => 0),
      ((prisma as any).materialInwardNote ? (prisma as any).materialInwardNote.count() : Promise.resolve(0)).catch(() => 0),
    ]);

    // Parse sanitized host info (without exposing password)
    let sanitizedHost = 'PostgreSQL Server';
    try {
      const url = new URL(dbUrl);
      sanitizedHost = `${url.hostname}:${url.port || '5432'}`;
    } catch {
      // ignore
    }

    const dbName = dbCheck[0]?.current_database || 'iskcon';

    return NextResponse.json({
      connected: true,
      status: 'Connected',
      engine: 'PostgreSQL',
      orm: 'Prisma Client',
      database: dbName,
      host: sanitizedHost,
      latencyMs,
      serverTime: dbCheck[0]?.now || new Date().toISOString(),
      counts: {
        users: userCount,
        products: productCount,
        branches: branchCount,
        orders: orderCount,
        inwards: inwardCount,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('Database connection check error:', error);
    return NextResponse.json({
      connected: false,
      status: 'Connection Error',
      message: error?.message || 'Failed to connect to PostgreSQL database.',
      latencyMs,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
