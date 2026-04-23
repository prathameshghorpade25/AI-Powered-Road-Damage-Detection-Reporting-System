import { Fragment, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { DuplicateCluster, OpsCase } from '../mockOpsData';
import { severityColor } from '../mockOpsData';
import type { TrafficHotspot, TrafficZone } from '../opsTypes';

type Props = {
  cases: OpsCase[];
  clusters: DuplicateCluster[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  heatmap: boolean;
  light?: boolean;
  center?: [number, number];
  zoom?: number;
  showZoneOverlays?: boolean;
  trafficZones?: TrafficZone[];
  trafficHotspots?: TrafficHotspot[];
};

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const DEFAULT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function OpsMap({
  cases,
  clusters,
  selectedId,
  onSelect,
  heatmap,
  light = false,
  center = [19.878, 74.48],
  zoom = 13,
  showZoneOverlays = true,
  trafficZones = [],
  trafficHotspots = [],
}: Props) {
  const stroke = light ? '#ffffff' : '#0f172a';
  const zoneOverlays = useMemo(() => {
    const byZone = new Map<
      string,
      {
        count: number;
        latSum: number;
        lonSum: number;
        prioritySum: number;
        immediate: number;
        highTraffic: number;
      }
    >();
    for (const c of cases) {
      const key = c.zone || 'Unknown zone';
      const current = byZone.get(key) ?? {
        count: 0,
        latSum: 0,
        lonSum: 0,
        prioritySum: 0,
        immediate: 0,
        highTraffic: 0,
      };
      current.count += 1;
      current.latSum += c.lat;
      current.lonSum += c.lon;
      current.prioritySum += c.priorityScore ?? 45;
      if (c.priorityBand === 'immediate') current.immediate += 1;
      if (c.trafficLevel === 'high' || c.trafficLevel === 'very_high') current.highTraffic += 1;
      byZone.set(key, current);
    }
    return Array.from(byZone.entries()).map(([zone, v]) => {
      const avgPriority = v.prioritySum / Math.max(v.count, 1);
      const color = avgPriority >= 70 ? '#dc2626' : avgPriority >= 55 ? '#d97706' : '#2563eb';
      return {
        zone,
        count: v.count,
        center: [v.latSum / v.count, v.lonSum / v.count] as [number, number],
        radius: 350 + v.count * 120,
        color,
        avgPriority,
        immediate: v.immediate,
        highTraffic: v.highTraffic,
      };
    });
  }, [cases]);
  const zonesToRender = trafficZones.length > 0 ? trafficZones.map((z) => ({
    zone: z.name,
    count: z.hotspotCount,
    center: [z.centerLat, z.centerLon] as [number, number],
    radius: z.radiusM,
    color:
      z.trafficLevel === 'very_high'
        ? '#dc2626'
        : z.trafficLevel === 'high'
          ? '#d97706'
          : z.trafficLevel === 'medium'
            ? '#2563eb'
            : '#0f766e',
    avgPriority: z.trafficLevel === 'very_high' ? 80 : z.trafficLevel === 'high' ? 65 : z.trafficLevel === 'medium' ? 50 : 35,
    immediate: 0,
    highTraffic: z.trafficLevel === 'high' || z.trafficLevel === 'very_high' ? z.hotspotCount : 0,
    peakTime: z.peakTime,
    sampleLocations: z.sampleLocations,
  })) : zoneOverlays.map((z) => ({ ...z, peakTime: '', sampleLocations: [] as string[] }));

  return (
    <MapContainer center={center} zoom={zoom} className={`ops-map${light ? ' ops-map--light' : ''}`} scrollWheelZoom>
      <TileLayer
        attribution={light ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; OpenStreetMap'}
        url={light ? LIGHT_TILES : DEFAULT_TILES}
      />
      {showZoneOverlays &&
        zonesToRender.map((z) => (
          <Fragment key={`zone-group-${z.zone}`}>
            <Circle
              key={`zone-pulse-outer-${z.zone}`}
              center={z.center}
              radius={Math.round(z.radius * 1.12)}
              pathOptions={{
                color: z.color,
                fillColor: z.color,
                fillOpacity: 0.08,
                weight: 1,
                dashArray: '5 4',
                className: 'ops-zone-pulse-outer',
              }}
            />
            <Circle
              key={`zone-pulse-inner-${z.zone}`}
              center={z.center}
              radius={Math.round(z.radius * 0.9)}
              pathOptions={{
                color: z.color,
                fillColor: z.color,
                fillOpacity: 0.12,
                weight: 1.2,
                dashArray: '4 4',
                className: 'ops-zone-pulse-inner',
              }}
            />
            <Circle
              key={`zone-${z.zone}`}
              center={z.center}
              radius={z.radius}
              pathOptions={{
                color: z.color,
                fillColor: z.color,
                fillOpacity: 0.12,
                weight: 1.4,
                dashArray: '5 4',
              }}
            >
              <Tooltip direction="center" permanent opacity={0.92}>
                <div className="ops-zone-label">
                  <strong>{z.zone}</strong>
                  <span>{z.sampleLocations[0] ?? 'Traffic hotspot'}</span>
                </div>
              </Tooltip>
              <Popup>
                <strong>{z.zone}</strong>
                <br />
                Hotspots: {z.count}
                <br />
                Avg priority: {Math.round(z.avgPriority)}
                <br />
                Immediate dispatch: {z.immediate}
                <br />
                High-traffic cases: {z.highTraffic}
                {z.peakTime ? (
                  <>
                    <br />
                    Peak time: {z.peakTime}
                  </>
                ) : null}
                {z.sampleLocations.length ? (
                  <>
                    <br />
                    Addresses: {z.sampleLocations.slice(0, 3).join(' | ')}
                  </>
                ) : null}
              </Popup>
            </Circle>
          </Fragment>
        ))}
      {trafficHotspots.map((h) => {
        const color =
          h.trafficLevel === 'very_high'
            ? '#dc2626'
            : h.trafficLevel === 'high'
              ? '#d97706'
              : h.trafficLevel === 'medium'
                ? '#2563eb'
                : '#0f766e';
        return (
          <Circle
            key={`hotspot-${h.address}`}
            center={[h.lat, h.lon]}
            radius={h.radiusM}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.24,
              weight: 1.1,
              className: 'ops-hotspot-pulse',
            }}
          >
            <Tooltip direction="top" opacity={0.93}>
              <div className="ops-zone-label">
                <strong>{h.address}</strong>
                <span>{h.trafficLevel.replace('_', ' ')} · {h.zone}</span>
              </div>
            </Tooltip>
            <Popup>
              <strong>{h.address}</strong>
              <br />
              Zone: {h.zone}
              <br />
              Traffic: {h.trafficLevel.replace('_', ' ')}
              <br />
              Peak: {h.peakTime}
              <br />
              Entries in dataset: {h.occurrences}
            </Popup>
          </Circle>
        );
      })}
      {heatmap &&
        clusters.map((c) => (
          <Circle
            key={`heat-${c.id}`}
            center={[c.centerLat, c.centerLon]}
            radius={c.radiusM}
            pathOptions={{
              color: '#93c5fd',
              fillColor: '#3b82f6',
              fillOpacity: 0.08,
              weight: 1,
            }}
          />
        ))}
      {cases.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.lat, c.lon]}
          radius={selectedId === c.id ? 9 : 6}
          pathOptions={{
            color: stroke,
            weight: 2,
            fillColor: severityColor(c.severity),
            fillOpacity: 0.92,
          }}
          eventHandlers={{ click: () => onSelect(c.id) }}
        >
          <Popup>
            <strong>{c.id}</strong>
            <br />
            {c.severity} · {c.ward}
            <br />
            <button type="button" className="ops-map-popup-btn" onClick={() => onSelect(c.id)}>
              View
            </button>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
