import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function proxyRequest(request: NextRequest, backendPath: string, method: string = 'GET') {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const init: RequestInit = { method, headers };

    if (method !== 'GET' && method !== 'HEAD') {
      init.body = await request.text();
    }

    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const fullUrl = `${API_BASE}${backendPath}${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(fullUrl, init);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Backend request failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, '/api/auth/profile', 'GET');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, '/api/auth/profile', 'PUT');
}
