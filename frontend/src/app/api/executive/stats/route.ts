const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/executive/stats`);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({});
  }
}
