const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${BACKEND}/api/companies/${id}/competitors`);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json([]);
  }
}
