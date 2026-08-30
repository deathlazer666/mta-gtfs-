// Minimal protobuf wire-format reader tuned for the GTFS-RT / MTA extension feeds.
// Encoding: varint fields, length-delimited (strings/bytes/messages), fixed32/fixed64,
// zigzag for sint. This covers everything in the GTFS-RT spec.

export class Reader {
  private buf: Uint8Array;
  private view: DataView;
  private pos: number;

  constructor(data: Uint8Array | ArrayBuffer) {
    this.buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.view = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
    this.pos = 0;
  }

  get ended(): boolean {
    return this.pos >= this.buf.length;
  }

  private need(n: number): void {
    if (this.pos + n > this.buf.length) throw new Error("protobuf read past end");
  }

  varint(): number {
    let lo = 0;
    let hi = 0;
    let shift = 0;
    while (true) {
      this.need(1);
      const byte = this.buf[this.pos++];
      if (shift < 32) lo |= (byte & 0x7f) << shift;
      else hi |= (byte & 0x7f) << (shift - 32);
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift > 63) throw new Error("varint too long");
    }
    // Combine into a signed JS number. lo/hi are 32-bit masks; convert to double carefully.
    const unsigned = hi * 4294967296 + lo;
    return hi & 0x80000000 ? unsigned - 18446744073709551616 : unsigned;
  }

  int64(): number {
    return this.varint();
  }

  bytes(): Uint8Array {
    const len = this.varint();
    this.need(len);
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  string(): string {
    return new TextDecoder().decode(this.bytes());
  }

  /** Read the current field's bytes as a sub-reader (must be LEN-delimited). */
  sub(): Reader {
    return new Reader(this.bytes());
  }

  skip(wireType: number): void {
    switch (wireType) {
      case 0: this.varint(); break;
      case 1: this.need(8); this.pos += 8; break;
      case 2: { const n = this.varint(); this.need(n); this.pos += n; break; }
      case 5: this.need(4); this.pos += 4; break;
      default: throw new Error(`unsupported wire type ${wireType}`);
    }
  }

  float32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  float64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  /** Iterate fields: callback(fieldNo, wireType) while fields remain. */
  fields(cb: (fieldNo: number, wireType: number) => void): void {
    while (!this.ended) {
      this.need(1);
      const tag = this.varint();
      const fieldNo = tag >>> 3;
      const wireType = tag & 7;
      // Fields are 1..536870911. Skip unknown/invalid defensively.
      if (fieldNo === 0) throw new Error("invalid field number 0");
      cb(fieldNo, wireType);
    }
  }
}

export interface Field {
  fieldNo: number;
  wireType: number;
}

export function varintToSigned(u: number): number {
  return (u >>> 1) ^ -(u & 1); // zigzag
}