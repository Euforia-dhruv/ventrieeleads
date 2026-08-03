-- Seed data: Global location hierarchy + industry taxonomy
-- Run AFTER migration_locations_industries.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- LOCATIONS: World → Country → State/Province → City → District
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── COUNTRIES ──────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, gdp_usd, is_active) VALUES
('a0000000-0000-0000-0000-000000000001', 'United Arab Emirates', 'uae', 'country', NULL, 'AE', 23.4241, 53.8478, 'Asia/Dubai', 9890000, 507000000000, true),
('a0000000-0000-0000-0000-000000000002', 'United Kingdom', 'united-kingdom', 'country', NULL, 'GB', 55.3781, -3.4360, 'Europe/London', 67330000, 3070000000000, true),
('a0000000-0000-0000-0000-000000000003', 'United States', 'united-states', 'country', NULL, 'US', 37.0902, -95.7129, 'America/New_York', 331900000, 25460000000000, true),
('a0000000-0000-0000-0000-000000000004', 'Singapore', 'singapore', 'country', NULL, 'SG', 1.3521, 103.8198, 'Asia/Singapore', 5640000, 397000000000, true),
('a0000000-0000-0000-0000-000000000005', 'Saudi Arabia', 'saudi-arabia', 'country', NULL, 'SA', 23.8859, 45.0792, 'Asia/Riyadh', 35950000, 1061000000000, true),
('a0000000-0000-0000-0000-000000000006', 'India', 'india', 'country', NULL, 'IN', 20.5937, 78.9629, 'Asia/Kolkata', 1408000000, 3385000000000, true),
('a0000000-0000-0000-0000-000000000007', 'Germany', 'germany', 'country', NULL, 'DE', 51.1657, 10.4515, 'Europe/Berlin', 83200000, 4072000000000, true),
('a0000000-0000-0000-0000-000000000008', 'Canada', 'canada', 'country', NULL, 'CA', 56.1304, -106.3468, 'America/Toronto', 38250000, 2140000000000, true),
('a0000000-0000-0000-0000-000000000009', 'Australia', 'australia', 'country', NULL, 'AU', -25.2744, 133.7751, 'Australia/Sydney', 25690000, 1675000000000, true),
('a0000000-0000-0000-0000-000000000010', 'Japan', 'japan', 'country', NULL, 'JP', 36.2048, 138.2529, 'Asia/Tokyo', 125700000, 4231000000000, true),
('a0000000-0000-0000-0000-000000000011', 'Brazil', 'brazil', 'country', NULL, 'BR', -14.2350, -51.9253, 'America/Sao_Paulo', 214300000, 1920000000000, true),
('a0000000-0000-0000-0000-000000000012', 'France', 'france', 'country', NULL, 'FR', 46.2276, 2.2137, 'Europe/Paris', 67390000, 2783000000000, true),
('a0000000-0000-0000-0000-000000000013', 'South Africa', 'south-africa', 'country', NULL, 'ZA', -30.5595, 22.9375, 'Africa/Johannesburg', 60600000, 405000000000, true),
('a0000000-0000-0000-0000-000000000014', 'Qatar', 'qatar', 'country', NULL, 'QA', 25.3548, 51.1839, 'Asia/Qatar', 2881000, 219000000000, true),
('a0000000-0000-0000-0000-000000000015', 'Kuwait', 'kuwait', 'country', NULL, 'KW', 29.3117, 47.4818, 'Asia/Kuwait', 4271000, 164000000000, true),
('a0000000-0000-0000-0000-000000000016', 'Oman', 'oman', 'country', NULL, 'OM', 21.4735, 55.9754, 'Asia/Muscat', 5106000, 88000000000, true),
('a0000000-0000-0000-0000-000000000017', 'Bahrain', 'bahrain', 'country', NULL, 'BH', 26.0667, 50.5577, 'Asia/Bahrain', 1472000, 44000000000, true),
('a0000000-0000-0000-0000-000000000018', 'Kenya', 'kenya', 'country', NULL, 'KE', -0.0236, 37.9062, 'Africa/Nairobi', 54027000, 110000000000, true),
('a0000000-0000-0000-0000-000000000019', 'Nigeria', 'nigeria', 'country', NULL, 'NG', 9.0820, 8.6753, 'Africa/Lagos', 218500000, 477000000000, true),
('a0000000-0000-0000-0000-000000000020', 'Egypt', 'egypt', 'country', NULL, 'EG', 26.8206, 30.8025, 'Africa/Cairo', 104258000, 476000000000, true);

-- ── UAE STATES/EMIRATES ────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, is_active) VALUES
('b0000000-0001-0000-0000-000000000001', 'Dubai', 'dubai', 'state', 'a0000000-0000-0000-0000-000000000001', 'AE', 25.2048, 55.2708, 'Asia/Dubai', 3490000, true),
('b0000000-0001-0000-0000-000000000002', 'Abu Dhabi', 'abu-dhabi', 'state', 'a0000000-0000-0000-0000-000000000001', 'AE', 24.4539, 54.3773, 'Asia/Dubai', 1807000, true),
('b0000000-0001-0000-0000-000000000003', 'Sharjah', 'sharjah', 'state', 'a0000000-0000-0000-0000-000000000001', 'AE', 25.3573, 55.3908, 'Asia/Dubai', 1400000, true),
('b0000000-0001-0000-0000-000000000004', 'Ajman', 'ajman', 'state', 'a0000000-0000-0000-0000-000000000001', 'AE', 25.4052, 55.4857, 'Asia/Dubai', 504000, true),
('b0000000-0001-0000-0000-000000000005', 'Ras Al Khaimah', 'ras-al-khaimah', 'state', 'a0000000-0000-0000-0000-000000000001', 'AE', 25.7895, 55.9432, 'Asia/Dubai', 191000, true),
('b0000000-0001-0000-0000-000000000006', 'Fujairah', 'fujairah', 'state', 'a0000000-0000-0000-0000-000000000001', 'AE', 25.1288, 56.3264, 'Asia/Dubai', 118000, true),
('b0000000-0001-0000-0000-000000000007', 'Umm Al Quwain', 'umm-al-quwain', 'state', 'a0000000-0000-0000-0000-000000000001', 'AE', 25.5647, 55.5467, 'Asia/Dubai', 72000, true);

-- ── UAE CITIES ─────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, is_active) VALUES
('c0000000-0001-0001-0000-000000000001', 'Downtown Dubai', 'downtown-dubai', 'city', 'b0000000-0001-0000-0000-000000000001', 'AE', 25.1972, 55.2744, true),
('c0000000-0001-0001-0000-000000000002', 'Business Bay', 'business-bay', 'city', 'b0000000-0001-0000-0000-000000000001', 'AE', 25.1854, 55.2661, true),
('c0000000-0001-0001-0000-000000000003', 'Dubai Marina', 'dubai-marina', 'city', 'b0000000-0001-0000-0000-000000000001', 'AE', 25.0805, 55.1346, true),
('c0000000-0001-0001-0000-000000000004', 'Jumeirah', 'jumeirah', 'city', 'b0000000-0001-0000-0000-000000000001', 'AE', 25.2285, 55.2468, true),
('c0000000-0001-0001-0000-000000000005', 'Deira', 'deira', 'city', 'b0000000-0001-0000-0000-000000000001', 'AE', 25.2673, 55.3016, true),
('c0000000-0001-0001-0000-000000000006', 'Al Reem Island', 'al-reem-island', 'city', 'b0000000-0001-0000-0000-000000000002', 'AE', 24.4958, 54.4033, true),
('c0000000-0001-0001-0000-000000000007', 'Yas Island', 'yas-island', 'city', 'b0000000-0001-0000-0000-000000000002', 'AE', 24.4700, 54.6000, true),
('c0000000-0001-0001-0000-000000000008', 'Al Majaz', 'al-majaz', 'city', 'b0000000-0001-0000-0000-000000000003', 'AE', 25.3310, 55.3850, true),
('c0000000-0001-0001-0000-000000000009', 'Al Nahda', 'al-nahda', 'city', 'b0000000-0001-0000-0000-000000000003', 'AE', 25.2930, 55.3560, true);

-- ── UK STATES ──────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, is_active) VALUES
('b0000000-0002-0000-0000-000000000001', 'England', 'england', 'state', 'a0000000-0000-0000-0000-000000000002', 'GB', 52.3555, -1.1743, 'Europe/London', 56286000, true),
('b0000000-0002-0000-0000-000000000002', 'Scotland', 'scotland', 'state', 'a0000000-0000-0000-0000-000000000002', 'GB', 56.4907, -4.2026, 'Europe/London', 5454000, true),
('b0000000-0002-0000-0000-000000000003', 'Wales', 'wales', 'state', 'a0000000-0000-0000-0000-000000000002', 'GB', 52.1307, -3.7837, 'Europe/London', 3107000, true);

-- ── UK CITIES ──────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, population, is_active) VALUES
('c0000000-0002-0001-0000-000000000001', 'London', 'london', 'city', 'b0000000-0002-0000-0000-000000000001', 'GB', 51.5074, -0.1278, 8982000, true),
('c0000000-0002-0001-0000-000000000002', 'Manchester', 'manchester', 'city', 'b0000000-0002-0000-0000-000000000001', 'GB', 53.4808, -2.2426, 553000, true),
('c0000000-0002-0001-0000-000000000003', 'Birmingham', 'birmingham', 'city', 'b0000000-0002-0000-0000-000000000001', 'GB', 52.4862, -1.8904, 1141000, true),
('c0000000-0002-0001-0000-000000000004', 'Edinburgh', 'edinburgh', 'city', 'b0000000-0002-0000-0000-000000000002', 'GB', 55.9533, -3.1883, 527000, true);

-- ── US STATES ──────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, is_active) VALUES
('b0000000-0003-0000-0000-000000000001', 'California', 'california', 'state', 'a0000000-0000-0000-0000-000000000003', 'US', 36.7783, -119.4179, 'America/Los_Angeles', 39538000, true),
('b0000000-0003-0000-0000-000000000002', 'New York', 'new-york-state', 'state', 'a0000000-0000-0000-0000-000000000003', 'US', 42.1657, -74.9481, 'America/New_York', 20201000, true),
('b0000000-0003-0000-0000-000000000003', 'Texas', 'texas', 'state', 'a0000000-0000-0000-0000-000000000003', 'US', 31.9686, -99.9018, 'America/Chicago', 29145000, true),
('b0000000-0003-0000-0000-000000000004', 'Florida', 'florida', 'state', 'a0000000-0000-0000-0000-000000000003', 'US', 27.6648, -81.5158, 'America/New_York', 21538000, true),
('b0000000-0003-0000-0000-000000000005', 'Illinois', 'illinois', 'state', 'a0000000-0000-0000-0000-000000000003', 'US', 40.6331, -89.3985, 'America/Chicago', 12812000, true);

-- ── US CITIES ──────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, population, is_active) VALUES
('c0000000-0003-0001-0000-000000000001', 'New York City', 'new-york-city', 'city', 'b0000000-0003-0000-0000-000000000002', 'US', 40.7128, -74.0060, 8336000, true),
('c0000000-0003-0001-0000-000000000002', 'Los Angeles', 'los-angeles', 'city', 'b0000000-0003-0000-0000-000000000001', 'US', 34.0522, -118.2437, 3979000, true),
('c0000000-0003-0001-0000-000000000003', 'San Francisco', 'san-francisco', 'city', 'b0000000-0003-0000-0000-000000000001', 'US', 37.7749, -122.4194, 874000, true),
('c0000000-0003-0001-0000-000000000004', 'Chicago', 'chicago', 'city', 'b0000000-0003-0000-0000-000000000005', 'US', 41.8781, -87.6298, 2693000, true),
('c0000000-0003-0001-0000-000000000005', 'Miami', 'miami', 'city', 'b0000000-0003-0000-0000-000000000004', 'US', 25.7617, -80.1918, 442000, true),
('c0000000-0003-0001-0000-000000000006', 'Houston', 'houston', 'city', 'b0000000-0003-0000-0000-000000000003', 'US', 29.7604, -95.3698, 2320000, true);

-- ── SAUDI STATES ───────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, is_active) VALUES
('b0000000-0005-0000-0000-000000000001', 'Riyadh Province', 'riyadh-province', 'state', 'a0000000-0000-0000-0000-000000000005', 'SA', 24.7136, 46.6753, 'Asia/Riyadh', 8216000, true),
('b0000000-0005-0000-0000-000000000002', 'Makkah Province', 'makkah-province', 'state', 'a0000000-0000-0000-0000-000000000005', 'SA', 21.6319, 39.7917, 'Asia/Riyadh', 8565000, true),
('b0000000-0005-0000-0000-000000000003', 'Eastern Province', 'eastern-province', 'state', 'a0000000-0000-0000-0000-000000000005', 'SA', 24.3000, 49.5800, 'Asia/Riyadh', 5128000, true);

-- ── SAUDI CITIES ───────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, population, is_active) VALUES
('c0000000-0005-0001-0000-000000000001', 'Riyadh', 'riyadh', 'city', 'b0000000-0005-0000-0000-000000000001', 'SA', 24.7136, 46.6753, 7677000, true),
('c0000000-0005-0001-0000-000000000002', 'Jeddah', 'jeddah', 'city', 'b0000000-0005-0000-0000-000000000002', 'SA', 21.4858, 39.1925, 4610000, true),
('c0000000-0005-0001-0000-000000000003', 'Dammam', 'dammam', 'city', 'b0000000-0005-0000-0000-000000000003', 'SA', 26.3927, 49.9777, 1252000, true);

-- ── INDIA STATES ───────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, timezone, population, is_active) VALUES
('b0000000-0006-0000-0000-000000000001', 'Maharashtra', 'maharashtra', 'state', 'a0000000-0000-0000-0000-000000000006', 'IN', 19.7515, 75.7139, 'Asia/Kolkata', 124000000, true),
('b0000000-0006-0000-0000-000000000002', 'Karnataka', 'karnataka', 'state', 'a0000000-0000-0000-0000-000000000006', 'IN', 15.3173, 75.7139, 'Asia/Kolkata', 67700000, true),
('b0000000-0006-0000-0000-000000000003', 'Delhi', 'delhi', 'state', 'a0000000-0000-0000-0000-000000000006', 'IN', 28.7041, 77.1025, 'Asia/Kolkata', 20000000, true),
('b0000000-0006-0000-0000-000000000004', 'Tamil Nadu', 'tamil-nadu', 'state', 'a0000000-0000-0000-0000-000000000006', 'IN', 11.1271, 78.6569, 'Asia/Kolkata', 77200000, true);

-- ── INDIA CITIES ───────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, population, is_active) VALUES
('c0000000-0006-0001-0000-000000000001', 'Mumbai', 'mumbai', 'city', 'b0000000-0006-0000-0000-000000000001', 'IN', 19.0760, 72.8777, 12478000, true),
('c0000000-0006-0001-0000-000000000002', 'Bangalore', 'bangalore', 'city', 'b0000000-0006-0000-0000-000000000002', 'IN', 12.9716, 77.5946, 8443000, true),
('c0000000-0006-0001-0000-000000000003', 'New Delhi', 'new-delhi', 'city', 'b0000000-0006-0000-0000-000000000003', 'IN', 28.6139, 77.2090, 3029000, true),
('c0000000-0006-0001-0000-000000000004', 'Chennai', 'chennai', 'city', 'b0000000-0006-0000-0000-000000000004', 'IN', 13.0827, 80.2707, 7088000, true);

-- ── SINGAPOR ───────────────────────────────────────────────────────────────────
INSERT INTO locations (id, name, slug, location_type, parent_id, country_code, latitude, longitude, population, is_active) VALUES
('c0000000-0004-0001-0000-000000000001', 'Marina Bay', 'marina-bay', 'city', 'a0000000-0000-0000-0000-000000000004', 'SG', 1.2813, 103.8610, 100000, true),
('c0000000-0004-0001-0000-000000000002', 'Orchard', 'orchard', 'city', 'a0000000-0000-0000-0000-000000000004', 'SG', 1.3048, 103.8318, 50000, true),
('c0000000-0004-0001-0000-000000000003', 'CBD', 'cbd', 'city', 'a0000000-0000-0000-0000-000000000004', 'SG', 1.2789, 103.8536, 80000, true);


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDUSTRIES: Multi-level taxonomy
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── LEVEL 1: Top-level industries ──────────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0000-0000-0000-000000000001', 'Technology', 'technology', NULL, 'cpu', 1),
('d0000000-0000-0000-0000-000000000002', 'Real Estate', 'real-estate', NULL, 'building', 2),
('d0000000-0000-0000-0000-000000000003', 'Healthcare', 'healthcare', NULL, 'heart', 3),
('d0000000-0000-0000-0000-000000000004', 'Finance & Insurance', 'finance', NULL, 'banknote', 4),
('d0000000-0000-0000-0000-000000000005', 'Education', 'education', NULL, 'graduation-cap', 5),
('d0000000-0000-0000-0000-000000000006', 'Hospitality & Tourism', 'hospitality', NULL, 'hotel', 6),
('d0000000-0000-0000-0000-000000000007', 'Retail & E-commerce', 'retail', NULL, 'shopping-cart', 7),
('d0000000-0000-0000-0000-000000000008', 'Manufacturing', 'manufacturing', NULL, 'factory', 8),
('d0000000-0000-0000-0000-000000000009', 'Construction', 'construction', NULL, 'hammer', 9),
('d0000000-0000-0000-0000-000000000010', 'Automotive', 'automotive', NULL, 'car', 10),
('d0000000-0000-0000-0000-000000000011', 'Food & Beverage', 'food-beverage', NULL, 'utensils', 11),
('d0000000-0000-0000-0000-000000000012', 'Fashion & Luxury', 'fashion', NULL, 'shirt', 12),
('d0000000-0000-0000-0000-000000000013', 'Beauty & Wellness', 'beauty-wellness', NULL, 'sparkles', 13),
('d0000000-0000-0000-0000-000000000014', 'Marketing & Advertising', 'marketing', NULL, 'megaphone', 14),
('d0000000-0000-0000-0000-000000000015', 'Logistics & Transportation', 'logistics', NULL, 'truck', 15),
('d0000000-0000-0000-0000-000000000016', 'Legal', 'legal', NULL, 'scale', 16),
('d0000000-0000-0000-0000-000000000017', 'Consulting', 'consulting', NULL, 'briefcase', 17),
('d0000000-0000-0000-0000-000000000018', 'Energy & Utilities', 'energy', NULL, 'zap', 18),
('d0000000-0000-0000-0000-000000000019', 'Telecommunications', 'telecommunications', NULL, 'radio', 19),
('d0000000-0000-0000-0000-000000000020', 'Sports & Fitness', 'sports-fitness', NULL, 'dumbbell', 20),
('d0000000-0000-0000-0000-000000000021', 'Media & Entertainment', 'media', NULL, 'film', 21),
('d0000000-0000-0000-0000-000000000022', 'Agriculture', 'agriculture', NULL, 'leaf', 22),
('d0000000-0000-0000-0000-000000000023', 'Government & Non-Profit', 'government', NULL, 'landmark', 23);

-- ── LEVEL 2: Technology sub-industries ─────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0001-0000-0000-000000000001', 'Software Development', 'software-development', 'd0000000-0000-0000-0000-000000000001', 'code', 1),
('d0000000-0001-0000-0000-000000000002', 'SaaS', 'saas', 'd0000000-0000-0000-0000-000000000001', 'cloud', 2),
('d0000000-0001-0000-0000-000000000003', 'IT Services', 'it-services', 'd0000000-0000-0000-0000-000000000001', 'server', 3),
('d0000000-0001-0000-0000-000000000004', 'Cybersecurity', 'cybersecurity', 'd0000000-0000-0000-0000-000000000001', 'shield', 4),
('d0000000-0001-0000-0000-000000000005', 'AI & Machine Learning', 'ai-ml', 'd0000000-0000-0000-0000-000000000001', 'brain', 5),
('d0000000-0001-0000-0000-000000000006', 'Cloud Computing', 'cloud-computing', 'd0000000-0000-0000-0000-000000000001', 'cloud', 6),
('d0000000-0001-0000-0000-000000000007', 'Web Development', 'web-development', 'd0000000-0000-0000-0000-000000000001', 'globe', 7),
('d0000000-0001-0000-0000-000000000008', 'Mobile App Development', 'mobile-development', 'd0000000-0000-0000-0000-000000000001', 'smartphone', 8),
('d0000000-0001-0000-0000-000000000009', 'E-commerce Platforms', 'ecommerce-platforms', 'd0000000-0000-0000-0000-000000000001', 'shopping-bag', 9),
('d0000000-0001-0000-0000-000000000010', 'Data Analytics', 'data-analytics', 'd0000000-0000-0000-0000-000000000001', 'bar-chart', 10);

-- ── LEVEL 2: Real Estate sub-industries ────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0002-0000-0000-000000000001', 'Residential Real Estate', 'residential', 'd0000000-0000-0000-0000-000000000002', 'home', 1),
('d0000000-0002-0000-0000-000000000002', 'Commercial Real Estate', 'commercial', 'd0000000-0000-0000-0000-000000000002', 'building', 2),
('d0000000-0002-0000-0000-000000000003', 'Property Management', 'property-management', 'd0000000-0000-0000-0000-000000000002', 'settings', 3),
('d0000000-0002-0000-0000-000000000004', 'Interior Design', 'interior-design', 'd0000000-0000-0000-0000-000000000002', 'palette', 4),
('d0000000-0002-0000-0000-000000000005', 'Architecture', 'architecture', 'd0000000-0000-0000-0000-000000000002', 'ruler', 5);

-- ── LEVEL 2: Healthcare sub-industries ─────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0003-0000-0000-000000000001', 'Hospitals', 'hospitals', 'd0000000-0000-0000-0000-000000000003', 'hospital', 1),
('d0000000-0003-0000-0000-000000000002', 'Clinics', 'clinics', 'd0000000-0000-0000-0000-000000000003', 'stethoscope', 2),
('d0000000-0003-0000-0000-000000000003', 'Dental', 'dental', 'd0000000-0000-0000-0000-000000000003', 'smile', 3),
('d0000000-0003-0000-0000-000000000004', 'Pharmaceuticals', 'pharmaceuticals', 'd0000000-0000-0000-0000-000000000003', 'pill', 4),
('d0000000-0003-0000-0000-000000000005', 'Medical Devices', 'medical-devices', 'd0000000-0000-0000-0000-000000000003', 'activity', 5),
('d0000000-0003-0000-0000-000000000006', 'Telemedicine', 'telemedicine', 'd0000000-0000-0000-0000-000000000003', 'video', 6);

-- ── LEVEL 2: Hospitality sub-industries ────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0006-0000-0000-000000000001', 'Hotels', 'hotels', 'd0000000-0000-0000-0000-000000000006', 'bed', 1),
('d0000000-0006-0000-0000-000000000002', 'Restaurants', 'restaurants', 'd0000000-0000-0000-0000-000000000006', 'utensils', 2),
('d0000000-0006-0000-0000-000000000003', 'Cafes', 'cafes', 'd0000000-0000-0000-0000-000000000006', 'coffee', 3),
('d0000000-0006-0000-0000-000000000004', 'Travel Agencies', 'travel-agencies', 'd0000000-0000-0000-0000-000000000006', 'plane', 4),
('d0000000-0006-0000-0000-000000000005', 'Event Management', 'event-management', 'd0000000-0000-0000-0000-000000000006', 'calendar', 5);

-- ── LEVEL 2: Retail sub-industries ─────────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0007-0000-0000-000000000001', 'E-commerce', 'ecommerce', 'd0000000-0000-0000-0000-000000000007', 'shopping-bag', 1),
('d0000000-0007-0000-0000-000000000002', 'Luxury Brands', 'luxury-brands', 'd0000000-0000-0000-0000-000000000007', 'crown', 2),
('d0000000-0007-0000-0000-000000000003', 'Jewellery', 'jewellery', 'd0000000-0000-0000-0000-000000000007', 'gem', 3),
('d0000000-0007-0000-0000-000000000004', 'Furniture', 'furniture', 'd0000000-0000-0000-0000-000000000007', 'armchair', 4);

-- ── LEVEL 2: Marketing sub-industries ──────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0014-0000-0000-000000000001', 'Digital Marketing', 'digital-marketing', 'd0000000-0000-0000-0000-000000000014', 'trending-up', 1),
('d0000000-0014-0000-0000-000000000002', 'SEO', 'seo', 'd0000000-0000-0000-0000-000000000014', 'search', 2),
('d0000000-0014-0000-0000-000000000003', 'Content Marketing', 'content-marketing', 'd0000000-0000-0000-0000-000000000014', 'file-text', 3),
('d0000000-0014-0000-0000-000000000004', 'Social Media Marketing', 'social-media', 'd0000000-0000-0000-0000-000000000014', 'share-2', 4),
('d0000000-0014-0000-0000-000000000005', 'Web Design Agency', 'web-design', 'd0000000-0000-0000-0000-000000000014', 'layout', 5),
('d0000000-0014-0000-0000-000000000006', 'Branding Agency', 'branding', 'd0000000-0000-0000-0000-000000000014', 'star', 6),
('d0000000-0014-0000-0000-000000000007', 'PR Agency', 'pr-agency', 'd0000000-0000-0000-0000-000000000014', 'mic', 7);

-- ── LEVEL 2: Construction sub-industries ───────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0009-0000-0000-000000000001', 'General Contracting', 'general-contracting', 'd0000000-0000-0000-0000-000000000009', 'hard-hat', 1),
('d0000000-0009-0000-0000-000000000002', 'Civil Engineering', 'civil-engineering', 'd0000000-0000-0000-0000-000000000009', 'ruler', 2),
('d0000000-0009-0000-0000-000000000003', 'MEP Services', 'mep-services', 'd0000000-0000-0000-0000-000000000009', 'wrench', 3);

-- ── LEVEL 2: Finance sub-industries ────────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0004-0000-0000-000000000001', 'Banking', 'banking', 'd0000000-0000-0000-0000-000000000004', 'landmark', 1),
('d0000000-0004-0000-0000-000000000002', 'Insurance', 'insurance', 'd0000000-0000-0000-0000-000000000004', 'shield', 2),
('d0000000-0004-0000-0000-000000000003', 'Accounting', 'accounting', 'd0000000-0000-0000-0000-000000000004', 'calculator', 3),
('d0000000-0004-0000-0000-000000000004', 'Wealth Management', 'wealth-management', 'd0000000-0000-0000-0000-000000000004', 'trending-up', 4);

-- ── LEVEL 2: Education sub-industries ──────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0005-0000-0000-000000000001', 'Schools', 'schools', 'd0000000-0000-0000-0000-000000000005', 'book-open', 1),
('d0000000-0005-0000-0000-000000000002', 'Universities', 'universities', 'd0000000-0000-0000-0000-000000000005', 'award', 2),
('d0000000-0005-0000-0000-000000000003', 'Training & Coaching', 'training-coaching', 'd0000000-0000-0000-0000-000000000005', 'users', 3),
('d0000000-0005-0000-0000-000000000004', 'EdTech', 'edtech', 'd0000000-0000-0000-0000-000000000005', 'monitor', 4);

-- ── LEVEL 2: Automotive sub-industries ─────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0010-0000-0000-000000000001', 'Car Dealerships', 'car-dealerships', 'd0000000-0000-0000-0000-000000000010', 'car', 1),
('d0000000-0010-0000-0000-000000000002', 'Car Rentals', 'car-rentals', 'd0000000-0000-0000-0000-000000000010', 'key', 2),
('d0000000-0010-0000-0000-000000000003', 'Auto Services', 'auto-services', 'd0000000-0000-0000-0000-000000000010', 'wrench', 3);

-- ── LEVEL 2: Food & Beverage sub-industries ────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0011-0000-0000-000000000001', 'Restaurants', 'fb-restaurants', 'd0000000-0000-0000-0000-000000000011', 'utensils', 1),
('d0000000-0011-0000-0000-000000000002', 'Catering', 'catering', 'd0000000-0000-0000-0000-000000000011', 'users', 2),
('d0000000-0011-0000-0000-000000000003', 'Food Production', 'food-production', 'd0000000-0000-0000-0000-000000000011', 'package', 3),
('d0000000-0011-0000-0000-000000000004', 'Cloud Kitchens', 'cloud-kitchens', 'd0000000-0000-0000-0000-000000000011', 'chef-hat', 4);

-- ── LEVEL 2: Beauty & Wellness sub-industries ──────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0013-0000-0000-000000000001', 'Salons', 'salons', 'd0000000-0000-0000-0000-000000000013', 'scissors', 1),
('d0000000-0013-0000-0000-000000000002', 'Spas', 'spas', 'd0000000-0000-0000-0000-000000000013', 'droplet', 2),
('d0000000-0013-0000-0000-000000000003', 'Fitness Centers', 'fitness-centers', 'd0000000-0000-0000-0000-000000000013', 'dumbbell', 3);

-- ── LEVEL 2: Legal sub-industries ──────────────────────────────────────────────
INSERT INTO industries (id, name, slug, parent_id, icon, sort_order) VALUES
('d0000000-0016-0000-0000-000000000001', 'Law Firms', 'law-firms', 'd0000000-0000-0000-0000-000000000016', 'scale', 1),
('d0000000-0016-0000-0000-000000000002', 'IP Law', 'ip-law', 'd0000000-0000-0000-0000-000000000016', 'fingerprint', 2),
('d0000000-0016-0000-0000-000000000003', 'Corporate Law', 'corporate-law', 'd0000000-0000-0000-0000-000000000016', 'briefcase', 3);
