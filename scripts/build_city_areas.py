"""
The coloured city areas on the zoomed-out map, from OpenStreetMap.

    python scripts/build_city_areas.py <folder for the downloads>

Asks OpenStreetMap's Nominatim for each Metro Manila city's outline, one request a second as
its usage policy asks, keeps the raw answers in the given folder, and writes
src/lib/geo/cityAreas.generated.ts.

THE DATA'S LICENCE: OpenStreetMap, Open Database License (openstreetmap.org/copyright, read
5 Nov 2026). It needs the credit "(c) OpenStreetMap contributors", which the map's info button
already shows, and a changed copy of the data may only be shared under the same licence. These
outlines are simplified OpenStreetMap data, so the generated file stays under that licence,
separate from the shop list (Charls' own field data), which it never touches.

WHAT IT DOES TO THE OUTLINES, none of it visible at the zooms they are drawn at:
  - straightens them to about 65 m (a few hundred points a city is plenty below zoom 12.5);
  - keeps outer edges only (no holes) and drops tiny islands;
  - gives neighbours different tones (0-4), so two cities side by side never look like one;
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'src', 'lib', 'geo', 'cityAreas.generated.ts')

# App area id -> what to ask for. Same ids as Area in lib/settings/store.tsx.
CITIES = {
    'caloocan': 'Caloocan',
    'las-pinas': 'Las Pinas',
    'makati': 'Makati',
    'malabon': 'Malabon',
    'mandaluyong': 'Mandaluyong',
    'manila': 'Manila',
    'marikina': 'Marikina',
    'muntinlupa': 'Muntinlupa',
    'navotas': 'Navotas',
    'paranaque': 'Paranaque',
    'pasay': 'Pasay',
    'pasig': 'Pasig',
    'pateros': 'Pateros',
    'quezon-city': 'Quezon City',
    'san-juan': 'San Juan',
    'taguig': 'Taguig',
    'valenzuela': 'Valenzuela',
}
SIMPLIFY_DEG = 0.0006
TONES = 5


def fetch(area, name, folder):
    path = os.path.join(folder, area + '.json')
    if os.path.exists(path):
        return json.load(open(path, encoding='utf-8'))
    q = urllib.parse.urlencode({
        'q': '%s, Metro Manila, Philippines' % name,
        'format': 'jsonv2',
        'polygon_geojson': 1,
        'limit': 8,
    })
    req = urllib.request.Request('https://nominatim.openstreetmap.org/search?' + q,
                                 headers={'User-Agent': 'ayoos-city-areas-script'})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    time.sleep(1.2)
    return data


def outline(results, name):
    """The answer that is a real administrative boundary with an area, biggest first."""
    good = [r for r in results
            if r.get('category') == 'boundary' and r.get('type') == 'administrative'
            and r['geojson']['type'] in ('Polygon', 'MultiPolygon')]
    if not good:
        raise SystemExit('no boundary came back for ' + name)
    return max(good, key=lambda r: float(r.get('importance') or 0))


def simplify(points, eps):
    """Douglas-Peucker, without recursion, keeping the ring closed."""
    if len(points) < 4:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    # A ring's two ends are the same point, so split it at its farthest point first.
    far = max(range(len(points)), key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2)
    keep[far] = True
    stack = [(0, far), (far, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        length = dx * dx + dy * dy
        worst, at = 0, None
        for i in range(a + 1, b):
            px, py = points[i]
            if length == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > worst:
                worst, at = d, i
        if at is not None and worst > eps * eps:
            keep[at] = True
            stack += [(a, at), (at, b)]
    return [p for p, k in zip(points, keep) if k]


def ring_area(ring):
    return abs(sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1))) / 2


def touching(a, b, gap=0.003):
    """Do two cities share an edge? Tested on their points, close enough for colouring."""
    for ra in a:
        for ax, ay in ra:
            for rb in b:
                for bx, by in rb:
                    if abs(ax - bx) < gap and abs(ay - by) < gap:
                        return True
    return False


def main(folder):
    os.makedirs(folder, exist_ok=True)
    shapes = {}
    for area, name in CITIES.items():
        r = outline(fetch(area, name, folder), name)
        g = r['geojson']
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        rings = [p[0] for p in polys]
        big = max(ring_area(x) for x in rings)
        rings = [x for x in rings if ring_area(x) > big * 0.01]
        small = []
        for x in rings:
            s = [(round(a, 4), round(b, 4)) for a, b in simplify([tuple(p) for p in x], SIMPLIFY_DEG)]
            if s[0] != s[-1]:
                s.append(s[0])
            small.append(s)
        shapes[area] = small
        print('%-12s %-40s %3d rings, %4d -> %3d points' % (
            area, r.get('display_name', '')[:40], len(small), sum(len(x) for x in rings), sum(len(x) for x in small)))

    # Neighbours get different tones: most-connected city first, each takes the first free tone.
    near = {a: {b for b in shapes if b != a and touching(shapes[a], shapes[b])} for a in shapes}
    tone = {}
    for a in sorted(shapes, key=lambda k: (-len(near[k]), k)):
        used = {tone[b] for b in near[a] if b in tone}
        tone[a] = next(t for t in range(TONES) if t not in used)

    def fmt(rings):
        return json.dumps([[[list(p) for p in r]] for r in rings], separators=(',', ':'))

    lines = [
        '/*',
        '  GENERATED by scripts/build_city_areas.py. Do not edit: re-run it.',
        '  City outlines from OpenStreetMap, simplified. (c) OpenStreetMap contributors,',
        '  Open Database License (openstreetmap.org/copyright). `tone`: 0-4, neighbours differ.',
        '*/',
        'export const CITY_AREAS: GeoJSON.FeatureCollection = {',
        "  type: 'FeatureCollection',",
        '  features: [',
    ]
    for a, rings in shapes.items():
        lines.append("    { type: 'Feature', properties: { area: '%s', tone: %d }, geometry: { type: 'MultiPolygon', coordinates: %s } }," % (a, tone[a], fmt(rings)))
    lines += ['  ],', '};']
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print('tones', tone)
    print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
