import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const res = await fetch(`${API_URL}/api/export/leads?${queryString}`);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': res.headers.get('Content-Disposition') || 'attachment',
        },
      });
    }
  } catch {
    return NextResponse.json({ success: false, message: 'Export failed' }, { status: 500 });
  }
}
