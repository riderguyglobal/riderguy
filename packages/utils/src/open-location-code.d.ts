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
    static encode(latitude: number, longitude: number, codeLength?: number): string;
    static decode(code: string): CodeArea;
    static shorten(code: string, referenceLatitude: number, referenceLongitude: number): string;
    static recoverNearest(shortCode: string, referenceLatitude: number, referenceLongitude: number): string;
    static isValid(code: string): boolean;
    static isFull(code: string): boolean;
    static isShort(code: string): boolean;
  }
}
