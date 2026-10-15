import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '@/lib/services/settingsService';

export async function GET() {
  try {
    const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
    return NextResponse.json({ success: true, settings: settings || DEFAULT_SETTINGS });
  } catch (error: any) {
    return NextResponse.json({ success: true, settings: DEFAULT_SETTINGS, error: error?.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settings = await updateSettings(body).catch(() => DEFAULT_SETTINGS);
    return NextResponse.json({ success: true, settings: settings || DEFAULT_SETTINGS });
  } catch (error: any) {
    return NextResponse.json({ success: true, settings: DEFAULT_SETTINGS, error: error?.message }, { status: 200 });
  }
}

