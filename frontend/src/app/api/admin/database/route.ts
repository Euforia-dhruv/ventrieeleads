import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function proxy(request: NextRequest, path: string, method: string = 'GET') {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') init.body = await request.text();
    const url = new URL(request.url);
    const qs = url.searchParams.toString();
    const res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, init);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Backend request failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return proxy(request, '/api/admin/database'); }
