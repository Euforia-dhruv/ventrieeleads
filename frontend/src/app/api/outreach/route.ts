import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getAuthHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = request.cookies.get('token')?.value;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = getAuthHeaders(request);

    const res = await fetch(`${BACKEND_URL}/api/outreach/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Failed to generate outreach' }, { status: 500 });
  }
}
