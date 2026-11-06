/**
 * 15.7: a regional failover on a globe, for the selected project. Regions and user cities sit at their real latitude and
 * longitude, so the arcs and distances are real great-circle geometry. Round-trip times use a rule of thumb (light in
 * fibre covers about 200 km per millisecond, and routes run about 1.5 times the straight line), and user shares, regions
 * and capacity are illustrative. Data residency limits where each project may fail over to. Pure.
 */
import type { ProjectId } from '../../data/projects'
import type { Path, PointView, SceneStep, Segments, Tone, Vec3 } from '../scene3d/tensor.ts'

export interface Place {
  name: string
  lat: number
  lon: number
}
interface City extends Place {
  /** Share of peak traffic, illustrative. */
  share: number
  /** Regions this city's data may be served from, in order of preference; omitted means any. */
  allowed?: string[]
}
interface Setup {
  regions: Place[]
  cities: City[]
  /** The region that fails. */
  fails: string
  residency: string
}

const R = (name: string, lat: number, lon: number): Place => ({ name, lat, lon })
const MUMBAI = R('Mumbai', 19.08, 72.88)
const HYDERABAD = R('Hyderabad', 17.39, 78.49)
const SINGAPORE = R('Singapore', 1.35, 103.82)
const ASHBURN = R('Ashburn', 39.04, -77.49)
const DUBLIN = R('Dublin', 53.35, -6.26)
const FRANKFURT = R('Frankfurt', 50.11, 8.68)

const INDIA: City[] = [
  { name: 'Delhi', lat: 28.61, lon: 77.21, share: 0.25 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88, share: 0.2 },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59, share: 0.2 },
  { name: 'Chennai', lat: 13.08, lon: 80.27, share: 0.1 },
  { name: 'Kolkata', lat: 22.57, lon: 88.36, share: 0.1 },
  { name: 'Hyderabad', lat: 17.39, lon: 78.49, share: 0.15 },
]

export const SETUPS: Record<ProjectId, Setup> = {
  harbor: {
    regions: [ASHBURN, DUBLIN, FRANKFURT, MUMBAI],
    cities: [
      { name: 'New York', lat: 40.71, lon: -74.01, share: 0.3 },
      { name: 'San Francisco', lat: 37.77, lon: -122.42, share: 0.15 },
      { name: 'London', lat: 51.51, lon: -0.13, share: 0.2, allowed: ['Dublin', 'Frankfurt'] },
      { name: 'Berlin', lat: 52.52, lon: 13.4, share: 0.15, allowed: ['Dublin', 'Frankfurt'] },
      { name: 'Bengaluru', lat: 12.97, lon: 77.59, share: 0.2 },
    ],
    fails: 'Frankfurt',
    residency: 'EU tenants’ data and prompts stay in EU regions, so EU users may fail over only to Dublin.',
  },
  store: { regions: [MUMBAI, HYDERABAD, SINGAPORE], cities: [...INDIA.map((c) => ({ ...c, share: c.name === 'Bengaluru' ? 0.15 : c.share })), { name: 'Pune', lat: 18.52, lon: 73.86, share: 0.05 }], fails: 'Mumbai', residency: 'No residency rule binds shoppers here, so Singapore can take overflow, at a cost in latency.' },
  bank: { regions: [MUMBAI, HYDERABAD], cities: INDIA.map((c) => ({ ...c, allowed: ['Mumbai', 'Hyderabad'] })), fails: 'Mumbai', residency: 'Customer and payment data must stay in India, so the bank runs two Indian regions and nothing can fail over abroad.' },
  travel: {
    regions: [MUMBAI, HYDERABAD, SINGAPORE],
    cities: [...INDIA.map((c) => ({ ...c, share: c.share * 0.9 })), { name: 'Dubai', lat: 25.2, lon: 55.27, share: 0.06 }, { name: 'London', lat: 51.51, lon: -0.13, share: 0.04 }],
    fails: 'Mumbai',
    residency: 'Bookings may be served from any region, so Singapore can take overflow.',
  },
}

/** Great-circle distance in km. */
export function distanceKm(a: Place, b: Place): number {
  const rad = Math.PI / 180
  const [p1, p2] = [a.lat * rad, b.lat * rad]
  const dp = p2 - p1
  const dl = (b.lon - a.lon) * rad
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Round trip by the rule of thumb: route 1.5 × the great circle, at 200 km per ms each way. Illustrative. */
export const rttMs = (km: number) => (2 * km * 1.5) / 200

/** Each city's region: the nearest one it is allowed, among those up. */
export function assign(s: Setup, down: Set<string>): Map<string, string | null> {
  const out = new Map<string, string | null>()
  for (const c of s.cities) {
    const ok = s.regions.filter((r) => !down.has(r.name) && (!c.allowed || c.allowed.includes(r.name)))
    ok.sort((a, b) => distanceKm(c, a) - distanceKm(c, b))
    out.set(c.name, ok[0]?.name ?? null)
  }
  return out
}

/** Each region's share of peak traffic under an assignment. */
export function loads(s: Setup, a: Map<string, string | null>): Map<string, number> {
  const m = new Map<string, number>(s.regions.map((r) => [r.name, 0]))
  for (const c of s.cities) {
    const r = a.get(c.name)
    if (r) m.set(r, m.get(r)! + c.share)
  }
  return m
}

/** Each region is provisioned for its normal peak plus this much headroom. Illustrative. */
export const HEADROOM = 0.3
/** A region that serves nobody normally is a warm standby, sized for this share of peak. Illustrative. */
export const STANDBY = 0.3

// ---- Drawing ----------------------------------------------------------------------------------------------------------

const RADIUS = 2.4
/** Turn the globe so the project's users face the camera. */
const centre = (s: Setup) => s.cities.reduce((n, c) => n + c.lon * c.share, 0) / s.cities.reduce((n, c) => n + c.share, 0)

function onGlobe(p: Place, lon0: number, lift = 0): Vec3 {
  const rad = Math.PI / 180
  const r = RADIUS + lift
  const lat = p.lat * rad
  const lon = (p.lon - lon0) * rad
  return [r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon)]
}

/** A great-circle arc between two places, lifted off the surface in the middle so it reads as a link. */
function arc(a: Place, b: Place, lon0: number): Vec3[] {
  const [pa, pb] = [onGlobe(a, lon0), onGlobe(b, lon0)]
  const dot = (pa[0] * pb[0] + pa[1] * pb[1] + pa[2] * pb[2]) / (RADIUS * RADIUS)
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)))
  const n = 24
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const [wa, wb] = omega < 1e-6 ? [1 - t, t] : [Math.sin((1 - t) * omega) / Math.sin(omega), Math.sin(t * omega) / Math.sin(omega)]
    const v: Vec3 = [pa[0] * wa + pb[0] * wb, pa[1] * wa + pb[1] * wb, pa[2] * wa + pb[2] * wb]
    const len = Math.hypot(...v)
    const lift = RADIUS + 0.04 + Math.sin(Math.PI * t) * Math.min(0.5, omega * 0.6)
    return v.map((x) => (x / len) * lift) as Vec3
  })
}

/** Lines of latitude and longitude every 30°, just above the surface. */
function graticule(lon0: number): Segments {
  const pairs: [Vec3, Vec3][] = []
  const pt = (lat: number, lon: number) => onGlobe({ name: '', lat, lon }, lon0, 0.005)
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 6) pairs.push([pt(lat, lon), pt(lat, lon + 6)])
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -84; lat < 84; lat += 6) pairs.push([pt(lat, lon), pt(lat + 6, lon)])
  return { id: 'graticule', pairs, tone: 'muted', faded: true }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function globeSteps(project: ProjectId): SceneStep[] {
  const s = SETUPS[project]
  const lon0 = centre(s)
  const normal = assign(s, new Set())
  const after = assign(s, new Set([s.fails]))
  const before = loads(s, normal)
  const later = loads(s, after)
  const capacity = new Map([...before].map(([r, l]) => [r, l > 0 ? l * (1 + HEADROOM) : STANDBY]))
  const region = (name: string) => s.regions.find((r) => r.name === name)!
  const rttOf = (c: City, r: string | null) => (r ? rttMs(distanceKm(c, region(r))) : NaN)
  const avg = (a: Map<string, string | null>) => s.cities.reduce((n, c) => n + c.share * rttOf(c, a.get(c.name)!), 0)
  const overloaded = [...later].filter(([r, l]) => l > capacity.get(r)! && r !== s.fails)

  // Balls shrink with the zoom, so a close-up of one country does not fill with them.
  const zoomed = (() => {
    const all = [...s.cities, ...s.regions].map((p) => onGlobe(p, lon0))
    const spread = Math.max(...all.flatMap((a) => all.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))))
    return Math.max(1.6, Math.min(7.5, spread * 2.4 + 0.8))
  })()
  const k = Math.max(0.3, zoomed / 7.5)
  const regionPoints = (failed: boolean): PointView[] =>
    s.regions.map((r) => ({ id: `r-${r.name}`, at: onGlobe(r, lon0, 0.02), tone: (failed && r.name === s.fails ? 'bad' : 'accent') as Tone, r: 0.09 * k, label: `${r.name}${failed && r.name === s.fails ? ' (down)' : ''}` }))
  const cityPoints: PointView[] = s.cities.map((c) => ({ id: `c-${c.name}`, at: onGlobe(c, lon0, 0.02 * k), tone: 'ink', r: (0.03 + c.share * 0.12) * k }))
  const arcs = (a: Map<string, string | null>, changed?: Map<string, string | null>): Path[] =>
    s.cities.flatMap((c) => {
      const r = a.get(c.name)
      if (!r || r === c.name) return []
      const moved = changed && changed.get(c.name) !== r
      return [{ id: `a-${c.name}`, points: arc(c, region(r), lon0), tone: (moved ? 'signal' : 'accent') as Tone, solid: true, width: moved ? 2.5 : 1.5 }]
    })
  const table = (a: Map<string, string | null>, caption: string) => ({
    caption,
    head: ['City', 'Share of traffic', 'Served from', 'Distance', 'Round trip'],
    rows: s.cities.map((c) => {
      const r = a.get(c.name)
      return [c.name, pct(c.share), r ?? 'nowhere allowed', r ? `${Math.round(distanceKm(c, region(r)))} km` : '—', r ? `${Math.round(rttOf(c, r))} ms` : '—']
    }),
  })
  // Aim at the project's own places, and zoom to their spread: India's cities fit in a small patch of the globe.
  const all = [...s.cities, ...s.regions].map((p) => onGlobe(p, lon0))
  const mean = [0, 1, 2].map((k) => all.reduce((n, v) => n + v[k], 0) / all.length)
  const len = Math.hypot(...mean)
  const target = mean.map((v) => (v / len) * RADIUS) as Vec3
  const spread = Math.max(...all.flatMap((a) => all.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))))
  const base = { tensors: [], globe: { r: RADIUS }, segments: [graticule(lon0)], target, distance: Math.max(1.6, Math.min(7.5, spread * 2.4 + 0.8)) }

  const moved = s.cities.filter((c) => normal.get(c.name) !== after.get(c.name))
  const standby = moved.length ? after.get(moved[0].name) ?? null : null
  // Could the excess spill to a region with room, where every moved city is allowed to go?
  const spill = overloaded
    .map(([r, l]) => {
      const excess = l - capacity.get(r)!
      const movedHere = moved.filter((c) => after.get(c.name) === r)
      const options = s.regions.filter((x) => x.name !== s.fails && x.name !== r && movedHere.every((c) => !c.allowed || c.allowed.includes(x.name)))
      const room = options.map((x) => ({ x, spare: capacity.get(x.name)! - later.get(x.name)! })).filter((o) => o.spare > 0).sort((a, b) => b.spare - a.spare)[0]
      if (!room) return `Residency leaves ${r}'s overflow nowhere else to go.`
      return room.spare >= excess
        ? `Spilling the excess ${pct(excess)} to ${room.x.name}, which has room for ${pct(room.spare)} more, would cover it, at longer round trips for those users.`
        : `${room.x.name} has room for only ${pct(room.spare)} of the ${pct(excess)} excess.`
    })
    .join(' ')
  const loadRows = s.regions.map((r) => [r.name, pct(before.get(r.name)!), pct(capacity.get(r.name)!), r.name === s.fails ? 'down' : pct(later.get(r.name)!), r.name === s.fails ? '—' : pct(later.get(r.name)! / capacity.get(r.name)!)])

  return [
    {
      ...base,
      title: 'Users and regions',
      text: `${s.regions.length} regions (${s.regions.map((r) => r.name).join(', ')}) serve users in ${s.cities.length} cities; each city goes to the nearest region it is allowed to use. ${s.residency} The traffic-weighted round trip is about ${Math.round(avg(normal))} ms. Distances are real great-circle distances; round trips, shares and regions are illustrative.`,
      points: [...regionPoints(false), ...cityPoints],
      paths: arcs(normal),
      table: table(normal, 'Normal routing (round trips illustrative)'),
    },
    {
      ...base,
      title: `${s.fails} goes down`,
      text: `The ${s.fails} region fails. Health checks take it out of the global load balancer, and ${moved.map((c) => c.name).join(', ')} ${moved.length === 1 ? 'is' : 'are'} rerouted (orange) to ${[...new Set(moved.map((c) => after.get(c.name) ?? 'nowhere'))].join(' and ')}. The traffic-weighted round trip goes from about ${Math.round(avg(normal))} ms to ${Math.round(avg(after))} ms. Next to seconds of generation that is small: latency is rarely what breaks in a failover.`,
      points: [...regionPoints(true), ...cityPoints],
      paths: arcs(after, normal),
      table: table(after, `After ${s.fails} fails (round trips illustrative)`),
    },
    {
      ...base,
      title: 'Can the survivors take the load?',
      text: `What breaks is capacity. Each serving region was provisioned for its normal peak plus ${pct(HEADROOM)} headroom${s.regions.some((r) => before.get(r.name) === 0) ? `, and an idle region is a warm standby for ${pct(STANDBY)} of peak` : ''} (all illustrative). ${overloaded.length ? `After the failover ${overloaded.map(([r, l]) => `${r} carries ${pct(l)} of peak traffic against capacity for ${pct(capacity.get(r)!)}, ${pct(l / capacity.get(r)!)} of what it can serve`).join('; ')}. ${spill} GPUs cannot be added in minutes, so the plan is standing spare capacity (N+1), the degradation ladder of 15.6 (queue, shed low-priority work, switch to a smaller model, serve cached answers), or both.` : 'The survivors stay within capacity.'}`,
      points: [...regionPoints(true), ...cityPoints],
      paths: arcs(after, normal),
      table: { caption: 'Share of peak traffic per region (capacity illustrative)', head: ['Region', 'Normal load', 'Capacity', 'Load after failover', 'Utilisation'], rows: loadRows },
    },
    {
      ...base,
      title: 'And the data?',
      text: `The standby only helps if it has the data. Conversation state, audit logs and the vector index must already be replicated to ${standby ?? 'the survivor'}, within the RPO (for example 5 minutes of writes) and with an RTO the business accepts (for example 30 minutes). ${s.residency} Rehearse the whole failover, and the failback, on a schedule: an untested failover usually fails.`,
      points: [...regionPoints(true), ...cityPoints],
      paths: [
        ...arcs(after, normal),
        // Replication runs to the region that takes over, which residency allows.
        ...(standby ? [{ id: 'replication', points: arc(region(s.fails), region(standby), lon0), tone: 'sim' as Tone, width: 2, label: 'async replication' }] : []),
      ],
      table: table(after, `After ${s.fails} fails (round trips illustrative)`),
    },
  ]
}

