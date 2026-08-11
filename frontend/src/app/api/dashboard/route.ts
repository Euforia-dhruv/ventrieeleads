import { NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard/stats`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      success: true,
      data: {
        totalLeads: 0,
        qualifiedLeads: 0,
        todayLeads: 0,
        hotLeads: 0,
        coldLeads: 0,
        jobsRunning: 0,
        jobsCompleted: 0,
        avgLeadScore: 0,
        byIndustry: {},
        byCity: {},
        byStatus: {},
      },
    });
  }
}
