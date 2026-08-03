import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('token')?.value;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await res.json();

    const response = NextResponse.json(data);
    response.cookies.delete('token');
    response.cookies.delete('refreshToken');
    return response;
  } catch {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('token');
    response.cookies.delete('refreshToken');
    return response;
  }
}
