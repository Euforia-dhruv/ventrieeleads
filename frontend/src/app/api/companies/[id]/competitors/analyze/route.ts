const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${BACKEND}/api/companies/${id}/competitors`, { method: 'POST' });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
