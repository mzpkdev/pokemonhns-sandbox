/** Build an asset URL that works from both Vite and a relative static deployment. */
export function atlasUrl(path: string, baseUrl = import.meta.env.BASE_URL): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

export function catalogUrl(baseUrl?: string): string {
  return atlasUrl("catalog.json", baseUrl);
}

export function mapImageUrl(path: string, baseUrl?: string): string {
  return atlasUrl(path, baseUrl);
}

export type AtlasViewState = {
  center: [number, number];
  zoom: number;
};

export type AtlasUrlState = {
  region: string | null;
  selectedMap: string | null;
  view: AtlasViewState | null;
};

function parameter(url: URL, name: string): string | null {
  return url.searchParams.get(name)?.trim() || null;
}

function numberParameter(url: URL, name: string): number | null {
  const value = url.searchParams.get(name);
  const number = value === null ? Number.NaN : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseAtlasUrlState(href: string): AtlasUrlState {
  const url = new URL(href, window.location.origin);
  const x = numberParameter(url, "x");
  const y = numberParameter(url, "y");
  const zoom = numberParameter(url, "zoom");
  return {
    region: parameter(url, "region"),
    selectedMap: parameter(url, "map"),
    view: x === null || y === null || zoom === null ? null : { center: [x, y], zoom },
  };
}

export function atlasUrlWithState(href: string, state: AtlasUrlState): string {
  const url = new URL(href, window.location.origin);
  for (const name of ["region", "map", "x", "y", "zoom"]) {
    url.searchParams.delete(name);
  }
  if (state.region) url.searchParams.set("region", state.region);
  if (state.selectedMap) url.searchParams.set("map", state.selectedMap);
  if (state.view) {
    url.searchParams.set("x", String(Math.round(state.view.center[0] * 100) / 100));
    url.searchParams.set("y", String(Math.round(state.view.center[1] * 100) / 100));
    url.searchParams.set("zoom", String(Math.round(state.view.zoom * 100) / 100));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
