INSERT INTO tenants (id, name, slug, config) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Jazz Gallery',
    'jazz-gallery',
    '{"primaryColor":"#1a1a2e","accentColor":"#f4c542","venueType":"jazz"}'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Empire Arts',
    'empire-arts',
    '{"primaryColor":"#0f3460","accentColor":"#00c9a7","venueType":"theater"}'
  )
ON CONFLICT (slug) DO NOTHING;
