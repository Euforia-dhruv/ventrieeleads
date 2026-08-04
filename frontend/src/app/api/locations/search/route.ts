import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '20';

    if (q.length < 2) {
      return NextResponse.json({ locations: [] });
    }

    // Try backend API first
    try {
      const res = await fetch(
        `${API_BASE}/api/locations/search?q=${encodeURIComponent(q)}&limit=${limit}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      // Backend not available, use fallback
    }

    // Fallback: generate locations from known cities
    const cities = generateLocations(q);
    return NextResponse.json({ locations: cities.slice(0, parseInt(limit)) });

  } catch (error) {
    console.error('Location search error:', error);
    return NextResponse.json({ locations: [] });
  }
}

function generateLocations(query: string) {
  const q = query.toLowerCase();
  const cities = [
    // UAE
    { name: 'Dubai', country_code: 'AE', location_type: 'city', latitude: 25.2048, longitude: 55.2708 },
    { name: 'Abu Dhabi', country_code: 'AE', location_type: 'city', latitude: 24.4539, longitude: 54.3773 },
    { name: 'Sharjah', country_code: 'AE', location_type: 'city', latitude: 25.3463, longitude: 55.4209 },
    { name: 'Ajman', country_code: 'AE', location_type: 'city', latitude: 25.4052, longitude: 55.5136 },
    { name: 'Ras Al Khaimah', country_code: 'AE', location_type: 'city', latitude: 25.8007, longitude: 55.9762 },
    { name: 'Fujairah', country_code: 'AE', location_type: 'city', latitude: 25.1288, longitude: 56.3264 },
    { name: 'Umm Al Quwain', country_code: 'AE', location_type: 'city', latitude: 25.5643, longitude: 55.5528 },
    // UK
    { name: 'London', country_code: 'GB', location_type: 'city', latitude: 51.5074, longitude: -0.1278 },
    { name: 'Manchester', country_code: 'GB', location_type: 'city', latitude: 53.4808, longitude: -2.2426 },
    { name: 'Birmingham', country_code: 'GB', location_type: 'city', latitude: 52.4862, longitude: -1.8904 },
    { name: 'Edinburgh', country_code: 'GB', location_type: 'city', latitude: 55.9533, longitude: -3.1883 },
    { name: 'Glasgow', country_code: 'GB', location_type: 'city', latitude: 55.8642, longitude: -4.2518 },
    { name: 'Liverpool', country_code: 'GB', location_type: 'city', latitude: 53.4084, longitude: -2.9916 },
    { name: 'Newcastle', country_code: 'GB', location_type: 'city', latitude: 54.9783, longitude: -1.6178 },
    // USA
    { name: 'New York', country_code: 'US', location_type: 'city', latitude: 40.7128, longitude: -74.0060 },
    { name: 'Los Angeles', country_code: 'US', location_type: 'city', latitude: 34.0522, longitude: -118.2437 },
    { name: 'Chicago', country_code: 'US', location_type: 'city', latitude: 41.8781, longitude: -87.6298 },
    { name: 'Houston', country_code: 'US', location_type: 'city', latitude: 29.7604, longitude: -95.3698 },
    { name: 'Miami', country_code: 'US', location_type: 'city', latitude: 25.7617, longitude: -80.1918 },
    { name: 'San Francisco', country_code: 'US', location_type: 'city', latitude: 37.7749, longitude: -122.4194 },
    { name: 'Texas', country_code: 'US', location_type: 'state', latitude: 31.9686, longitude: -99.9018 },
    { name: 'New York State', country_code: 'US', location_type: 'state', latitude: 42.1657, longitude: -74.9481 },
    // Canada
    { name: 'Toronto', country_code: 'CA', location_type: 'city', latitude: 43.6532, longitude: -79.3832 },
    { name: 'Vancouver', country_code: 'CA', location_type: 'city', latitude: 49.2827, longitude: -123.1207 },
    { name: 'Montreal', country_code: 'CA', location_type: 'city', latitude: 45.5017, longitude: -73.5673 },
    // Europe
    { name: 'Berlin', country_code: 'DE', location_type: 'city', latitude: 52.5200, longitude: 13.4050 },
    { name: 'Paris', country_code: 'FR', location_type: 'city', latitude: 48.8566, longitude: 2.3522 },
    { name: 'Amsterdam', country_code: 'NL', location_type: 'city', latitude: 52.3676, longitude: 4.9041 },
    { name: 'Madrid', country_code: 'ES', location_type: 'city', latitude: 40.4168, longitude: -3.7038 },
    { name: 'Barcelona', country_code: 'ES', location_type: 'city', latitude: 41.3874, longitude: 2.1686 },
    { name: 'Rome', country_code: 'IT', location_type: 'city', latitude: 41.9028, longitude: 12.4964 },
    { name: 'Munich', country_code: 'DE', location_type: 'city', latitude: 48.1351, longitude: 11.5820 },
    // Asia
    { name: 'Tokyo', country_code: 'JP', location_type: 'city', latitude: 35.6762, longitude: 139.6503 },
    { name: 'Singapore', country_code: 'SG', location_type: 'city', latitude: 1.3521, longitude: 103.8198 },
    { name: 'Hong Kong', country_code: 'HK', location_type: 'city', latitude: 22.3193, longitude: 114.1694 },
    { name: 'Bangkok', country_code: 'TH', location_type: 'city', latitude: 13.7563, longitude: 100.5018 },
    { name: 'Mumbai', country_code: 'IN', location_type: 'city', latitude: 19.0760, longitude: 72.8777 },
    { name: 'New Delhi', country_code: 'IN', location_type: 'city', latitude: 28.6139, longitude: 77.2090 },
    { name: 'Bangalore', country_code: 'IN', location_type: 'city', latitude: 12.9716, longitude: 77.5946 },
    // Oceania
    { name: 'Sydney', country_code: 'AU', location_type: 'city', latitude: -33.8688, longitude: 151.2093 },
    { name: 'Melbourne', country_code: 'AU', location_type: 'city', latitude: -37.8136, longitude: 144.9631 },
    { name: 'Auckland', country_code: 'NZ', location_type: 'city', latitude: -36.8485, longitude: 174.7633 },
    // Middle East
    { name: 'Riyadh', country_code: 'SA', location_type: 'city', latitude: 24.7136, longitude: 46.6753 },
    { name: 'Jeddah', country_code: 'SA', location_type: 'city', latitude: 21.4858, longitude: 39.1925 },
    { name: 'Doha', country_code: 'QA', location_type: 'city', latitude: 25.2854, longitude: 51.5310 },
    { name: 'Kuwait City', country_code: 'KW', location_type: 'city', latitude: 29.3759, longitude: 47.9774 },
    // Africa
    { name: 'Cairo', country_code: 'EG', location_type: 'city', latitude: 30.0444, longitude: 31.2357 },
    { name: 'Dubai', country_code: 'AE', location_type: 'city', latitude: 25.2048, longitude: 55.2708 },
    { name: 'Johannesburg', country_code: 'ZA', location_type: 'city', latitude: -26.2041, longitude: 28.0473 },
    { name: 'Nairobi', country_code: 'KE', location_type: 'city', latitude: -1.2921, longitude: 36.8219 },
    { name: 'Lagos', country_code: 'NG', location_type: 'city', latitude: 6.5244, longitude: 3.3792 },
  ];

  return cities
    .filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.country_code.toLowerCase().includes(q)
    )
    .map((c, i) => ({
      ...c,
      id: `loc-${i}-${c.name}`,
    }));
}
