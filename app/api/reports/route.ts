import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-helpers';
import { getReportData, type ReportPeriod } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const q = req.nextUrl.searchParams;
  const period = (q.get('period') || 'all') as ReportPeriod;
  const data = await getReportData(period, q.get('from'), q.get('to'));
  return NextResponse.json(data);
}
