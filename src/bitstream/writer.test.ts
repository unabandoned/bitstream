import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { BitstreamWriter } from "./writer";

describe('BitstreamWriter', () => {
    it('works for bit writes', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);
        writer.write(1, 0b1);
        writer.write(1, 0b0);
        writer.write(1, 0b0);
        writer.write(1, 0b1);
        writer.write(1, 0b1);
        writer.write(1, 0b0);
        writer.write(1, 0b0);
        writer.write(1, 0b1);
        writer.write(1, 0b0);
        writer.write(1, 0b1);
        writer.write(1, 0b1);
        writer.write(1, 0b0);
        writer.write(1, 0b0);
        writer.write(1, 0b1);
        writer.write(1, 0b1);
        writer.write(1, 0b0);
        assert.strictEqual(bufs.length, 2);
        assert.strictEqual(bufs[0][0], 0b10011001);
        assert.strictEqual(bufs[1][0], 0b01100110);
    });
    it('works for short writes', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);
        writer.write(3, 0b010);
        writer.write(3, 0b101);
        writer.write(2, 0b11);
        assert.strictEqual(bufs.length, 1);
        assert.strictEqual(bufs[0][0], 0b01010111);
    });
    it('works for full-byte writes', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);
        writer.write(8, 0b01010111);
        assert.strictEqual(bufs.length, 1);
        assert.strictEqual(bufs[0][0], 0b01010111);
    });
    it('works for offset full-byte writes', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);
        writer.write(4, 0b1111);
        writer.write(8, 0b01010111);
        writer.write(4, 0b1111);
        assert.strictEqual(bufs.length, 2);
        assert.strictEqual(bufs[0][0], 0b11110101);
        assert.strictEqual(bufs[1][0], 0b01111111);
    });
    it('works for large writes (1)', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);
        writer.write(16, 0b1111111100000000);
        assert.strictEqual(bufs.length, 2);
        assert.strictEqual(bufs[0][0], 0b11111111);
        assert.strictEqual(bufs[1][0], 0b00000000);
    });
    it('works for large writes (2)', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);
        writer.write(16, 0b0101010110101010);
        assert.strictEqual(bufs.length, 2);
        assert.strictEqual(bufs[0][0], 0b01010101);
        assert.strictEqual(bufs[1][0], 0b10101010);
    });
    it('works for offset large writes', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);
        writer.write(4, 0b1111);
        writer.write(16, 0b0101010110101010);
        writer.write(4, 0b1111);

        assert.strictEqual(bufs.length, 3);
        assert.strictEqual(bufs[0][0], 0b11110101);
        assert.strictEqual(bufs[1][0], 0b01011010);
        assert.strictEqual(bufs[2][0], 0b10101111);
    });
    it('respects configured buffer size', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 2);
        writer.write(8, 0b11111100);
        assert.strictEqual(bufs.length, 0);
        writer.write(8, 0b11111101);
        assert.strictEqual(bufs.length, 1);
        writer.write(8, 0b11111110);
        assert.strictEqual(bufs.length, 1);
        writer.write(8, 0b11111111);
        assert.strictEqual(bufs.length, 2);

        assert.strictEqual(bufs[0].length, 2);
        assert.strictEqual(bufs[1].length, 2);
        assert.strictEqual(bufs[0][0], 0b11111100);
        assert.strictEqual(bufs[0][1], 0b11111101);
        assert.strictEqual(bufs[1][0], 0b11111110);
        assert.strictEqual(bufs[1][1], 0b11111111);
    });
    it('throws when writing NaN as an unsigned integer', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 2);

        let caught;

        try {
            writer.write(8, NaN);
        } catch (e) { caught = e; }

        assert.ok(caught != null, `Expected write(8, NaN) to throw an exception`);
    });
    it('throws when writing Infinity as an unsigned integer', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 2);

        let caught;
        try {
            writer.write(8, Infinity);
        } catch (e) { caught = e; }

        assert.ok(caught != null, `Expected write(8, Infinity) to throw an exception`);
    });
    it('throws when writing NaN as a signed integer', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 2);

        let caught;
        try {
            writer.writeSigned(8, NaN);
        } catch (e) { caught = e; }

        assert.ok(caught != null, `Expected write(8, NaN) to throw an exception`);
    });
    it('throws when writing values outside of range', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 2);

        writer.writeSigned(8, 0);
        writer.writeSigned(8, 127);
        writer.writeSigned(8, -128);

        let caught;
        try {
            writer.writeSigned(8, 200);
        } catch (e) { caught = e; }
        
        assert.ok(caught != null, `Expected writeSigned(8, 200) to throw an exception`);
        caught = undefined;

        try {
            writer.writeSigned(8, 128);
        } catch (e) { caught = e; }
        
        assert.ok(caught != null, `Expected writeSigned(8, 128) to throw an exception`);
        caught = undefined;

        try {
            writer.writeSigned(8, -129);
        } catch (e) { caught = e; }

        assert.ok(caught != null, `Expected writeSigned(8, -129) to throw an exception`);
        caught = undefined;

        try {
            writer.writeSigned(16, 999999);
        } catch (e) { caught = e; }
        
        assert.ok(caught != null, `Expected writeSigned(8, 200) to throw an exception`);
        caught = undefined;

        try {
            writer.writeSigned(16, -999999);
        } catch (e) { caught = e; }

        assert.ok(caught != null, `Expected writeSigned(8, 128) to throw an exception`);
        caught = undefined;
    });
    it('throws when writing Infinity as a signed integer', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 2);

        let caught;
        try {
            writer.writeSigned(8, Infinity);
        } catch (e) { caught = e; }

        assert.ok(caught != null, `Expected write(8, Infinity) to throw an exception`);
    });
    it('writes undefined as zero when unsigned', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 1);

        writer.write(8, undefined);
        assert.strictEqual(bufs[0][0], 0);
    });
    it('writes null as zero when unsigned', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 1);

        writer.write(8, null);
        assert.strictEqual(bufs[0][0], 0);
    });
    it('writes undefined as zero when signed', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 1);

        writer.writeSigned(8, undefined);
        assert.strictEqual(bufs[0][0], 0);
    });
    it('writes null as zero when signed', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 1);

        writer.writeSigned(8, null);
        assert.strictEqual(bufs[0][0], 0);
    });
    it('correctly handles signed integers', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream);

        writer.writeSigned(8, -5); assert.strictEqual(bufs[0][0], 0xFB);
        writer.writeSigned(8, 5); assert.strictEqual(bufs[1][0], 5);
        writer.writeSigned(8, 0); assert.strictEqual(bufs[2][0], 0);

        bufs = [];
        writer = new BitstreamWriter(fakeStream, 2);

        writer.writeSigned(16, -1014); assert.deepStrictEqual(Array.from(bufs[0]), [0xFC, 0x0A]);
        writer.writeSigned(16, 1014); assert.deepStrictEqual(Array.from(bufs[1]), [0x03, 0xF6]);
        writer.writeSigned(16, 0); assert.deepStrictEqual(Array.from(bufs[2]), [0, 0]);

        bufs = [];
        writer = new BitstreamWriter(fakeStream, 4);

        writer.writeSigned(32, -102336); assert.deepStrictEqual(Array.from(bufs[0]), [0xFF, 0xFE, 0x70, 0x40]);
        writer.writeSigned(32, 102336); assert.deepStrictEqual(Array.from(bufs[1]), [0x00, 0x01, 0x8F, 0xC0]);
        writer.writeSigned(32, 0); assert.deepStrictEqual(Array.from(bufs[2]), [0, 0, 0, 0]);

    });
    it('correctly handles floats', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 4);

        writer.writeFloat(32, 102.5); assert.deepStrictEqual(Array.from(bufs[0]), [0x42, 0xCD, 0x00, 0x00]);
        writer.writeFloat(32, -436); assert.deepStrictEqual(Array.from(bufs[1]), [0xC3, 0xDA, 0x00, 0x00]);
        writer.writeFloat(32, 0); assert.deepStrictEqual(Array.from(bufs[2]), [0,0,0,0]);

        bufs = [];
        writer = new BitstreamWriter(fakeStream, 8);

        writer.writeFloat(64, 8745291.56);
        assert.deepStrictEqual(Array.from(bufs[0]), [0x41, 0x60, 0xae, 0x29, 0x71, 0xeb, 0x85, 0x1f]);

        writer.writeFloat(64, -327721.17);
        assert.deepStrictEqual(Array.from(bufs[1]), [0xc1, 0x14, 0x00, 0xa4, 0xae, 0x14, 0x7a, 0xe1]);

        writer.writeFloat(64, 0);
        assert.deepStrictEqual(Array.from(bufs[2]), [0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('.writeFloat() throws for lengths other than 32 and 64', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 4);

        let caught;
        try {
            writer.writeFloat(13, 123);
        } catch (e) { caught = e; }

        assert.ok(caught != null);
    });

    it('correctly handles NaN', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 4);

        writer.writeFloat(32, NaN); assert.deepStrictEqual(Array.from(bufs[0]), [0x7F, 0xC0, 0x00, 0x00]);
        
        bufs = [];
        writer = new BitstreamWriter(fakeStream, 8);

        writer.writeFloat(64, NaN); 
        assert.deepStrictEqual(Array.from(bufs[0]), [ 0x7f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]);
    });

    it('correctly handles Infinity', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 4);

        writer.writeFloat(32, Infinity); assert.deepStrictEqual(Array.from(bufs[0]), [ 0x7f, 0x80, 0x00, 0x00 ]);
        
        bufs = [];
        writer = new BitstreamWriter(fakeStream, 8);

        writer.writeFloat(64, Infinity); 
        assert.deepStrictEqual(Array.from(bufs[0]), [ 0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]);
    });
    it('.end() flushes full bytes', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 4);

        writer.write(8, 44);
        assert.strictEqual(bufs.length, 0);
        writer.end();
        assert.strictEqual(bufs.length, 1);
        assert.strictEqual(bufs[0].length, 1);
        assert.strictEqual(bufs[0][0], 44);
    });
    it('.end() flushes partial bytes', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 4);

        writer.write(4, 0b1111);
        assert.strictEqual(bufs.length, 0);
        writer.end();
        assert.strictEqual(bufs.length, 1);
        assert.strictEqual(bufs[0].length, 1);
        assert.strictEqual(bufs[0][0], 0b11110000);
    });
    it('.writeString() writes utf-8 strings correctly', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 5);

        writer.writeString(5, 'hello', 'utf-8');
        assert.strictEqual(bufs.length, 1);

        let buf = Buffer.from(bufs[0]);

        assert.strictEqual(buf.length, 5);
        assert.strictEqual(buf.toString('utf-8'), 'hello');
    });
    it('.writeString() writes utf16le strings correctly', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 10);

        writer.writeString(10, 'hello', 'utf16le');

        let buf = Buffer.from(bufs[0]);

        assert.strictEqual(buf.toString('utf16le'), 'hello');
    });
    it('.writeString() throws when any encoding other than utf-8 is used and Buffer is not available', () => {
        const BufferT = Buffer;
        (globalThis as any).Buffer = undefined;

        try {
            let bufs : Buffer[] = [];
            let fakeStream : any = { write(buf) { bufs.push(buf); } }
            let writer = new BitstreamWriter(fakeStream, 10);

            let caught;

            try {
                writer.writeString(10, 'hello', 'utf16le');
            } catch (e) { caught = e; }

            assert.ok(caught != null);
        } finally {
            (globalThis as any).Buffer = BufferT;
        }
    });
    it('.writeBuffer() works correctly', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 2);

        let buf = Buffer.from([ 12, 34, 56, 78 ]);
        writer.writeBuffer(buf);

        assert.strictEqual(bufs.length, 2);
        assert.strictEqual(bufs[0][0], 12);
        assert.strictEqual(bufs[0][1], 34);
        assert.strictEqual(bufs[1][0], 56);
        assert.strictEqual(bufs[1][1], 78);
    });
    it('.writeBuffer() works even when not byte-aligned', () => {
        let bufs : Buffer[] = [];
        let fakeStream : any = { write(buf) { bufs.push(buf); } }
        let writer = new BitstreamWriter(fakeStream, 5);

        let buf = Buffer.from([ 12, 34, 56, 78 ]);
        writer.write(4, 0);
        writer.writeBuffer(buf);
        writer.write(4, 0);

        assert.strictEqual(bufs.length, 1);
        assert.strictEqual(bufs[0].length, 5);
        assert.strictEqual(bufs[0][0], 0);
        assert.strictEqual(bufs[0][1], 194);
        assert.strictEqual(bufs[0][2], 35);
        assert.strictEqual(bufs[0][3], 132);
        assert.strictEqual(bufs[0][4], 224);
    });
});