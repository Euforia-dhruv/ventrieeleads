import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function forwardHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (auth) headers['authorization'] = auth;
  if (cookie) headers['cookie'] = cookie;
  return headers;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = forwardHeaders(request);

    const res = await fetch(`${BACKEND_URL}/api/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to create search job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const headers = forwardHeaders(request);

    const res = await fetch(`${BACKEND_URL}/api/search/jobs?${query}`, { headers });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch search jobs' },
      { status: 500 }
    );
  }
}
