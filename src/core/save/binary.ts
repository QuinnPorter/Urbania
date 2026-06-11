/** Minimal binary writer/reader with varints and length-prefixed strings. */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class BinaryWriter {
  private buf = new Uint8Array(1024);
  private pos = 0;

  private ensure(extra: number): void {
    if (this.pos + extra <= this.buf.length) return;
    const next = new Uint8Array(
      Math.max(this.buf.length * 2, this.pos + extra),
    );
    next.set(this.buf);
    this.buf = next;
  }

  u8(value: number): void {
    this.ensure(1);
    this.buf[this.pos++] = value & 0xff;
  }

  /** Unsigned LEB128. */
  varint(value: number): void {
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error(`varint expects a non-negative integer, got ${value}`);
    }
    do {
      let byte = value & 0x7f;
      value = Math.floor(value / 128);
      if (value > 0) byte |= 0x80;
      this.u8(byte);
    } while (value > 0);
  }

  string(value: string): void {
    const bytes = textEncoder.encode(value);
    this.varint(bytes.length);
    this.ensure(bytes.length);
    this.buf.set(bytes, this.pos);
    this.pos += bytes.length;
  }

  bytes(): Uint8Array {
    return this.buf.slice(0, this.pos);
  }
}

export class BinaryReader {
  private buf: Uint8Array;
  private pos = 0;

  constructor(buf: Uint8Array) {
    this.buf = buf;
  }

  get remaining(): number {
    return this.buf.length - this.pos;
  }

  u8(): number {
    if (this.pos >= this.buf.length) throw new Error("Unexpected end of data");
    return this.buf[this.pos++]!;
  }

  varint(): number {
    let result = 0;
    let shift = 1;
    for (;;) {
      const byte = this.u8();
      result += (byte & 0x7f) * shift;
      if ((byte & 0x80) === 0) return result;
      shift *= 128;
      if (shift > Number.MAX_SAFE_INTEGER / 128) {
        throw new Error("varint too long");
      }
    }
  }

  string(): string {
    const length = this.varint();
    if (this.pos + length > this.buf.length) {
      throw new Error("Unexpected end of data");
    }
    const value = textDecoder.decode(
      this.buf.subarray(this.pos, this.pos + length),
    );
    this.pos += length;
    return value;
  }
}
