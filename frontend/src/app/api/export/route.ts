import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  const status = searchParams.get('status') || '';
  const city = searchParams.get('city') || '';

  try {
    const res = await fetch(`${API_BASE}/api/export/leads?format=${format}${status ? `&status=${status}` : ''}${city ? `&city=${city}` : ''}`, {
      cache: 'no-store'
    });
    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': format === 'csv' ? 'text/csv' : format === 'pdf' ? 'application/pdf' : 'application/json',
        'Content-Disposition': `attachment; filename=leads.${format}`
      }
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Export failed' }, { status: 500 });
  }
}