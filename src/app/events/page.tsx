import React from 'react';
import CatchAllPageClient from '@/components/CatchAllPageClient';

export const dynamic = 'force-dynamic';

export default function EventsPage() {
  return <CatchAllPageClient initialModule="events" />;
}
