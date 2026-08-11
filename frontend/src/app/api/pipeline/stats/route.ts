import { NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/pipeline/stats`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: true, data: { total: 0, active: 0, won: 0, lost: 0, win_rate: 0, total_pipeline_value: 0 } });
  }
}
