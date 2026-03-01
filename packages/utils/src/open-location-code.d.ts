// Type declarations for open-location-code
// Ensures builds succeed without @types/open-location-code devDependency

declare module 'open-location-code' {
  interface CodeArea {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    latitudeCenter: number;
    longitudeCenter: number;
    codeLength: number;
  }

  class OpenLocationCode {
    constructor();
    encode(latitude: number, longitude: number, codeLength?: number): string;
    decode(code: string): CodeArea;
    shorten(code: string, referenceLatitude: number, referenceLongitude: number): string;
    recoverNearest(shortCode: string, referenceLatitude: number, referenceLongitude: number): string;
    isValid(code: string): boolean;
    isFull(code: string): boolean;
    isShort(code: string): boolean;
  }
}
