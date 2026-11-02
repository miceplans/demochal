// 구글 지도 JS API(@types/google.maps 미설치)에서 실제로 쓰는 객첼만 최소 타입으로 선언한다.
export interface GoogleLatLng {
  lat(): number;
  lng(): number;
}

export interface GoogleMapMouseEvent {
  latLng: GoogleLatLng | null;
}

export interface GoogleMap {
  setCenter(center: { lat: number; lng: number }): void;
  setZoom(zoom: number): void;
  addListener(event: string, handler: (event: GoogleMapMouseEvent) => void): { remove(): void };
}

export interface GoogleMarker {
  setPosition(position: { lat: number; lng: number } | null): void;
  setMap(map: GoogleMap | null): void;
  setVisible(visible: boolean): void;
  getPosition(): GoogleLatLng | null;
  addListener(event: string, handler: () => void): { remove(): void };
}

export interface GoogleGeocoderResult {
  geometry: { location: GoogleLatLng };
}

export interface GoogleGeocoder {
  geocode(
    request: { address: string },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ): void;
}

export interface GoogleMapsApi {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  Geocoder: new () => GoogleGeocoder;
}

declare global {
  interface Window {
    google?: { maps: GoogleMapsApi };
  }
}

export {};
