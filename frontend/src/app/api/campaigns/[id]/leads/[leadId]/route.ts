import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  try {
    const { id, leadId } = await params;
    const res = await fetch(`${API_URL}/api/campaigns/${id}/leads/${leadId}`, { method: 'DELETE' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Failed to remove lead' }, { status: 500 });
  }
}
