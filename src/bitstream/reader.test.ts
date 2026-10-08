import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { BitstreamReader } from "./reader";

describe('BitstreamReader', () => {
    it('can read a byte-aligned byte', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 123 ]));

        assert.strictEqual(bitstream.readSync(8), 123);
    });

    it('bufferIndex is always zero when retainBuffers=false', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123, 123 ]));
        bitstream.addBuffer(Buffer.from([ 123 ]));

        assert.strictEqual(bitstream.bufferIndex, 0);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 0);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 0);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 0);
    });
    it('.clean() causes buffers to be discarded when retainBuffers=true', () => {
        let bitstream = new BitstreamReader();
        bitstream.retainBuffers = true;
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123, 123 ]));
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 1);
        assert.strictEqual(bitstream.offset, 8);
        bitstream.clean();
        assert.strictEqual(bitstream.bufferIndex, 0);
        assert.strictEqual(bitstream.offset, 8);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 0);
        assert.strictEqual(bitstream.offset, 16);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 1);
        assert.strictEqual(bitstream.offset, 24);
        bitstream.readSync(8);
        bitstream.clean();
        assert.strictEqual(bitstream.bufferIndex, 0);
        assert.strictEqual(bitstream.offset, 32);
    });
    it('.clean() frees only the number of requested buffers', () => {
        let bitstream = new BitstreamReader();
        bitstream.retainBuffers = true;
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123, 123 ]));
        
        bitstream.readSync(8);
        bitstream.readSync(8);
        bitstream.readSync(8);
        
        assert.strictEqual(bitstream.bufferIndex, 3);
        bitstream.clean(1);
        assert.strictEqual(bitstream.bufferIndex, 2);
        bitstream.clean(1);
        assert.strictEqual(bitstream.bufferIndex, 1);
        bitstream.clean(1);
        assert.strictEqual(bitstream.bufferIndex, 0);
    });
    it('spentBufferSize tracks read bits properly', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123, 123 ]));
        bitstream.addBuffer(Buffer.from([ 123 ]));

        assert.strictEqual(bitstream.spentBufferSize, 0);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.spentBufferSize, 8);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.spentBufferSize, 8);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.spentBufferSize, 24);
    });
    it('offset should start at zero', () => {
        let bitstream = new BitstreamReader();
        assert.strictEqual(bitstream.offset, 0);
        bitstream.addBuffer(Buffer.from([ 1, 2, 3, 4, 5, 6 ]));
        assert.strictEqual(bitstream.offset, 0);
    });
    it('offset should not move as buffers are added', () => {
        let bitstream = new BitstreamReader();
        assert.strictEqual(bitstream.offset, 0);
        bitstream.addBuffer(Buffer.from([ 1, 2, 3, 4, 5, 6 ]));
        assert.strictEqual(bitstream.offset, 0);
        bitstream.readSync(8);
        bitstream.addBuffer(Buffer.from([ 1, 2, 3, 4, 5, 6 ]));
        assert.strictEqual(bitstream.offset, 8);
    });
    it('setting offset allows seeking within current buffer', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 1, 2, 3, 4, 5, 6 ]));

        assert.strictEqual(bitstream.readSync(8), 1);
        assert.strictEqual(bitstream.readSync(8), 2);
        assert.strictEqual(bitstream.readSync(8), 3);

        bitstream.offset = 0;
        assert.strictEqual(bitstream.readSync(8), 1);
        assert.strictEqual(bitstream.readSync(8), 2);
        assert.strictEqual(bitstream.readSync(8), 3);

        bitstream.offset = 8;
        assert.strictEqual(bitstream.readSync(8), 2);
        assert.strictEqual(bitstream.readSync(8), 3);
        assert.strictEqual(bitstream.readSync(8), 4);

        bitstream.offset = 0;
        assert.strictEqual(bitstream.readSync(8), 1);
        assert.strictEqual(bitstream.readSync(8), 2);
        assert.strictEqual(bitstream.readSync(8), 3);
    });
    it('setting offset allows seeking into previous buffers when retainBuffers=true', () => {
        let bitstream = new BitstreamReader();
        bitstream.retainBuffers = true;
        bitstream.addBuffer(Buffer.from([ 1, 2, 3 ]));
        bitstream.addBuffer(Buffer.from([ 4, 5, 6 ]));

        assert.strictEqual(bitstream.readSync(8), 1);
        assert.strictEqual(bitstream.readSync(8), 2);
        assert.strictEqual(bitstream.readSync(8), 3);
        assert.strictEqual(bitstream.readSync(8), 4);
        assert.strictEqual(bitstream.readSync(8), 5);
        assert.strictEqual(bitstream.readSync(8), 6);

        bitstream.offset = 8*3;
        assert.strictEqual(bitstream.readSync(8), 4);
        assert.strictEqual(bitstream.readSync(8), 5);
        assert.strictEqual(bitstream.readSync(8), 6);

        bitstream.offset = 0;
        assert.strictEqual(bitstream.readSync(8), 1);
        assert.strictEqual(bitstream.readSync(8), 2);
        assert.strictEqual(bitstream.readSync(8), 3);
    });
    it('setting offset into discarded buffers should throw when retainBuffers=false', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 1, 2, 3 ]));
        bitstream.addBuffer(Buffer.from([ 4, 5, 6 ]));

        assert.strictEqual(bitstream.readSync(8), 1);
        assert.strictEqual(bitstream.readSync(8), 2);
        assert.strictEqual(bitstream.readSync(8), 3);
        assert.strictEqual(bitstream.readSync(8), 4);
        assert.strictEqual(bitstream.readSync(8), 5);
        assert.strictEqual(bitstream.readSync(8), 6);

        let caught;
        try {
            bitstream.offset = 0;
        } catch (e) { caught = e; } 

        assert.ok(caught != null);
    });
    it('offset is always increasing even when retainBuffers=false', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123, 123 ]));
        bitstream.addBuffer(Buffer.from([ 123 ]));

        assert.strictEqual(bitstream.offset, 0);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.offset, 8);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.offset, 16);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.offset, 24);
    });
    it('bufferIndex grows when retainBuffers=true', () => {
        let bitstream = new BitstreamReader();
        bitstream.retainBuffers = true;
        bitstream.addBuffer(Buffer.from([ 123 ]));
        bitstream.addBuffer(Buffer.from([ 123, 123 ]));
        bitstream.addBuffer(Buffer.from([ 123 ]));

        assert.strictEqual(bitstream.bufferIndex, 0);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 1);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 1);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 2);
    });
    it('can correctly deserialize a simple example from a single buffer', () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(Buffer.from([
            0b11001000,
            0b01010100,
            0b11101001,

            0b01100100,
            0b10001110
        ]));

        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(3), 0b100);
        assert.strictEqual(bitstream.readSync(5), 0b10000);

        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(5), 0b01010);
        assert.strictEqual(bitstream.readSync(1), 0b0);

        assert.strictEqual(bitstream.readSync(8), 0b11101001);

        assert.strictEqual(bitstream.readSync(11), 0b01100100100);
        assert.strictEqual(bitstream.readSync(5), 0b01110);
    });
    it('can correctly deserialize a simple example from multiple buffers', () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(Buffer.from([ 0b11001000, 0b01010100 ]));
        bitstream.addBuffer(Buffer.from([ 0b11101001, 0b01100100, 0b10001110 ]));

        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(3), 0b100);
        assert.strictEqual(bitstream.readSync(4), 0b1000);

        assert.strictEqual(bitstream.readSync(2), 0b01);
        assert.strictEqual(bitstream.readSync(5), 0b01010);
        assert.strictEqual(bitstream.readSync(2), 0b01);

        assert.strictEqual(bitstream.readSync(7), 0b1101001);

        assert.strictEqual(bitstream.readSync(11), 0b01100100100);
        assert.strictEqual(bitstream.readSync(5), 0b01110);
    });

    it('can read fixed length UTF-8 strings', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from('hello', 'utf-8'));
        let str = bitstream.readStringSync(5);
        assert.strictEqual(str, 'hello');
    });

    it('can read null-terminated fixed length UTF-8 strings', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(5, 0);
        Buffer.from('hi', 'utf-8').copy(buf);

        bitstream.addBuffer(buf);
        let str = bitstream.readStringSync(5);
        assert.strictEqual(str, 'hi');
    });

    it('respects nullTerminated=false when reading strings', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(5, 0);
        Buffer.from('hi', 'utf-8').copy(buf);

        bitstream.addBuffer(buf);
        let str = bitstream.readStringSync(5, { nullTerminated: false });
        assert.strictEqual(str, 'hi\u0000\u0000\u0000');
    });

    it('correctly handles intra-byte skips', () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(Buffer.from([ 0b11001010, 0b01010100 ]));
        bitstream.addBuffer(Buffer.from([ 0b11101001, 0b01100100, 0b10001110 ]));

        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(3), 0b100);
        bitstream.skip(1);
        assert.strictEqual(bitstream.readSync(3), 0b010);

        bitstream.skip(2);
        assert.strictEqual(bitstream.readSync(5), 0b01010);
        assert.strictEqual(bitstream.readSync(2), 0b01);

        bitstream.skip(1);
        assert.strictEqual(bitstream.readSync(6), 0b101001);

        assert.strictEqual(bitstream.readSync(10), 0b0110010010);
        bitstream.skip(1);
        assert.strictEqual(bitstream.readSync(5), 0b01110);
    });
    it('correctly handles inter-byte skips', () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(Buffer.from([ 0b11001010, 0b01010100 ]));
        bitstream.addBuffer(Buffer.from([ 0b11101001, 0b01100100, 0b10001110 ]));

        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(3), 0b100);
        bitstream.skip(1);
        assert.strictEqual(bitstream.readSync(1), 0b0);

        bitstream.skip(4);
        assert.strictEqual(bitstream.readSync(5), 0b01010);
        assert.strictEqual(bitstream.readSync(2), 0b01);

        bitstream.skip(1);
        assert.strictEqual(bitstream.readSync(6), 0b101001);

        assert.strictEqual(bitstream.readSync(10), 0b0110010010);
        bitstream.skip(1);
        assert.strictEqual(bitstream.readSync(5), 0b01110);
    });
    it('correctly handles large inter-byte skips', () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(Buffer.from([ 0b11001010, 0b01010100 ]));
        bitstream.addBuffer(Buffer.from([ 0b11101001, 0b01100100, 0b10001110 ]));

        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(3), 0b100);
        bitstream.skip(14);
        assert.strictEqual(bitstream.readSync(6), 0b101001);
        assert.strictEqual(bitstream.readSync(10), 0b0110010010);
        bitstream.skip(1);
        assert.strictEqual(bitstream.readSync(5), 0b01110);
    });
    it('peeks correctly', () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(Buffer.from([ 0b11001010, 0b01010100 ]));

        assert.strictEqual(bitstream.peekSync(4), 0b1100);
        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(3), 0b100);
        assert.strictEqual(bitstream.peekSync(8), 0b10100101);
        assert.strictEqual(bitstream.readSync(1), 0b1);
        assert.strictEqual(bitstream.readSync(3), 0b010);
        assert.strictEqual(bitstream.peekSync(2), 0b01);
        assert.strictEqual(bitstream.readSync(4), 0b0101);
        assert.strictEqual(bitstream.readSync(4), 0b0100);
    });

    it('.readSignedSync() correctly handles signed integers', () => {
        let bitstream = new BitstreamReader();
        
        bitstream.addBuffer(Buffer.from([ 0xFB ])); assert.strictEqual(bitstream.readSignedSync(8), -5);
        bitstream.addBuffer(Buffer.from([ 5 ])); assert.strictEqual(bitstream.readSignedSync(8), 5);
        bitstream.addBuffer(Buffer.from([ 0 ])); assert.strictEqual(bitstream.readSignedSync(8), 0);

        bitstream.addBuffer(Buffer.from([ 0xFC, 0x0A ])); assert.strictEqual(bitstream.readSignedSync(16), -1014);
        bitstream.addBuffer(Buffer.from([ 0x03, 0xF6 ])); assert.strictEqual(bitstream.readSignedSync(16), 1014);
        bitstream.addBuffer(Buffer.from([ 0, 0 ])); assert.strictEqual(bitstream.readSignedSync(16), 0);

        bitstream.addBuffer(Buffer.from([ 0xFF, 0xFE, 0x70, 0x40 ])); assert.strictEqual(bitstream.readSignedSync(32), -102336);
        bitstream.addBuffer(Buffer.from([ 0x00, 0x01, 0x8F, 0xC0 ])); assert.strictEqual(bitstream.readSignedSync(32), 102336);
        bitstream.addBuffer(Buffer.from([ 0, 0, 0, 0 ])); assert.strictEqual(bitstream.readSignedSync(32), 0);
    });
    it('.readSigned() correctly handles signed integers', async () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 0xFB ])); assert.strictEqual(await bitstream.readSigned(8), -5);
        bitstream.addBuffer(Buffer.from([ 5 ])); assert.strictEqual(await bitstream.readSigned(8), 5);
        bitstream.addBuffer(Buffer.from([ 0 ])); assert.strictEqual(await bitstream.readSigned(8), 0);

        bitstream.addBuffer(Buffer.from([ 0xFC, 0x0A ])); assert.strictEqual(await bitstream.readSigned(16), -1014);
        bitstream.addBuffer(Buffer.from([ 0x03, 0xF6 ])); assert.strictEqual(await bitstream.readSigned(16), 1014);
        bitstream.addBuffer(Buffer.from([ 0, 0 ])); assert.strictEqual(await bitstream.readSigned(16), 0);

        bitstream.addBuffer(Buffer.from([ 0xFF, 0xFE, 0x70, 0x40 ])); assert.strictEqual(await bitstream.readSigned(32), -102336);
        bitstream.addBuffer(Buffer.from([ 0x00, 0x01, 0x8F, 0xC0 ])); assert.strictEqual(await bitstream.readSigned(32), 102336);
        bitstream.addBuffer(Buffer.from([ 0, 0, 0, 0 ])); assert.strictEqual(await bitstream.readSigned(32), 0);
    });
    it('.readSigned() can wait until data is available', async () => {
        let bitstream = new BitstreamReader();
        setTimeout(() => bitstream.addBuffer(Buffer.from([ 0xFB ])), 10); 
        assert.strictEqual(await bitstream.readSigned(8), -5);
    });

    it('.readFloatSync() correctly handles floats', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 0x42, 0xCD, 0x00, 0x00 ])); assert.strictEqual(bitstream.readFloatSync(32), 102.5);
        bitstream.addBuffer(Buffer.from([ 0xC3, 0xDA, 0x00, 0x00 ])); assert.strictEqual(bitstream.readFloatSync(32), -436);
        bitstream.addBuffer(Buffer.from([ 0, 0, 0, 0 ])); assert.strictEqual(bitstream.readFloatSync(32), 0);
        
        bitstream.addBuffer(Buffer.from([ 0x41, 0x60, 0xae, 0x29, 0x71, 0xeb, 0x85, 0x1f ])); 
        assert.strictEqual(bitstream.readFloatSync(64), 8745291.56);

        bitstream.addBuffer(Buffer.from([ 0xc1, 0x14, 0x00, 0xa4, 0xae, 0x14, 0x7a, 0xe1 ])); 
        assert.strictEqual(bitstream.readFloatSync(64), -327721.17);

        bitstream.addBuffer(Buffer.from([ 0, 0, 0, 0, 0, 0, 0, 0 ])); 
        assert.strictEqual(bitstream.readFloatSync(64), 0);
    });

    it('.readFloat() correctly handles floats', async () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 0x42, 0xCD, 0x00, 0x00 ])); assert.strictEqual(await bitstream.readFloat(32), 102.5);
        bitstream.addBuffer(Buffer.from([ 0xC3, 0xDA, 0x00, 0x00 ])); assert.strictEqual(await bitstream.readFloat(32), -436);
        bitstream.addBuffer(Buffer.from([ 0, 0, 0, 0 ])); assert.strictEqual(await bitstream.readFloat(32), 0);
        
        bitstream.addBuffer(Buffer.from([ 0x41, 0x60, 0xae, 0x29, 0x71, 0xeb, 0x85, 0x1f ])); 
        assert.strictEqual(await bitstream.readFloat(64), 8745291.56);

        bitstream.addBuffer(Buffer.from([ 0xc1, 0x14, 0x00, 0xa4, 0xae, 0x14, 0x7a, 0xe1 ])); 
        assert.strictEqual(await bitstream.readFloat(64), -327721.17);

        bitstream.addBuffer(Buffer.from([ 0, 0, 0, 0, 0, 0, 0, 0 ])); 
        assert.strictEqual(await bitstream.readFloat(64), 0);
    });

    it('.readFloat() can wait until data is available', async () => {
        let bitstream = new BitstreamReader();
        setTimeout(() => bitstream.addBuffer(Buffer.from([ 0x42, 0xCD, 0x00, 0x00 ])), 10);
        assert.strictEqual(await bitstream.readFloat(32), 102.5);
    });

    it('.readFloatSync() throws when requesting lengths other than 32 or 64', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.alloc(32));

        let caught;
        try {
            bitstream.readFloatSync(13);
        } catch (e) { caught = e; }

        assert.ok(caught != null);
    });

    it('peek() reads an unsigned integer without consuming it', async () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 37 ]));

        assert.strictEqual(await bitstream.peek(8), 37);
        assert.strictEqual(bitstream.offset, 0);
        assert.strictEqual(await bitstream.peek(8), 37);
        assert.strictEqual(await bitstream.peek(8), 37);
        assert.strictEqual(await bitstream.peek(8), 37);
        assert.strictEqual(await bitstream.peek(8), 37);
        assert.strictEqual(await bitstream.peek(8), 37);
        assert.strictEqual(bitstream.offset, 0);
    });

    it('.readFloatSync() throws when not enough bits are available', () => {
        let bitstream = new BitstreamReader();

        let caught;
        try {
            bitstream.readFloatSync(32);
        } catch (e) { caught = e; }

        assert.ok(caught != null);
    });

    it('readSync() throws when not enough bits are available', () => {
        let bitstream = new BitstreamReader();
        let caught;

        try {
            bitstream.readSync(32);
        } catch (e) { caught = e; }

        assert.ok(caught != null);
    });

    it('.readSignedSync() throws when not enough bits are available', () => {
        let bitstream = new BitstreamReader();
        let caught;

        try {
            bitstream.readSignedSync(32);
        } catch (e) { caught = e; }

        assert.ok(caught != null);
    });

    it('.read() fast paths when enough bits are available', async () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.alloc(1));

        let promise = bitstream.read(8);
        assert.strictEqual(bitstream['blockedRequest'], null);
        assert.strictEqual(await promise, 0);
    });

    it('.read() can wait until enough bits are available', async () => {
        let bitstream = new BitstreamReader();
        setTimeout(() => bitstream.addBuffer(Buffer.from([12])), 10);
        assert.strictEqual(await bitstream.read(8), 12);
    });

    it('correctly handles NaN', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 0x7F, 0xC0, 0x00, 0x00 ])); assert.ok(Number.isNaN(bitstream.readFloatSync(32)));
        
        bitstream.addBuffer(Buffer.from([ 0x7f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ])); 
        assert.ok(Number.isNaN(bitstream.readFloatSync(64)));
    });

    it('correctly handles Infinity', () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(Buffer.from([ 0x7f, 0x80, 0x00, 0x00 ])); 
        assert.ok(!Number.isFinite(bitstream.readFloatSync(32)));
        
        bitstream.addBuffer(Buffer.from([ 0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ])); 
        assert.ok(!Number.isFinite(bitstream.readFloatSync(64)));
    });
    it('.read() allows only one async read at a time', async () => {
        let bitstream = new BitstreamReader();
        bitstream.read(8);

        let caught;
        try {
            await bitstream.read(8);
        } catch (e) { caught = e; }
        
        assert.ok(caught != null, `Expected read() to throw`);
    });
    it('.assure() allows only one async call at a time', async () => {
        let bitstream = new BitstreamReader();
        bitstream.assure(8);

        let caught;
        try {
            await bitstream.assure(8);
        } catch (e) { caught = e; }
        
        assert.ok(caught != null, `Expected assure() to throw`);
    });
    it('.readStringSync() reads a string correctly', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(10);
        buf.write('hello', 'utf-8');

        bitstream.addBuffer(buf);
        assert.strictEqual(bitstream.readStringSync(10), 'hello');
    });
    it('.readStringSync() reads a non-null-terminated string correctly', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(10);
        buf.write('hello', 'utf-8');

        bitstream.addBuffer(buf);
        assert.strictEqual(bitstream.readStringSync(10, { nullTerminated: false }), "hello\0\0\0\0\0");
    });
    it('.readStringSync() reads an ASCII string correctly', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(10);
        buf.write('hello', 'ascii');
        bitstream.addBuffer(buf);
        assert.strictEqual(bitstream.readStringSync(10), "hello");
    });
    it('.readStringSync() reads utf16le correctly', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(32);
        buf.write('hello', 'utf16le');
        bitstream.addBuffer(buf);
        assert.strictEqual(bitstream.readStringSync(16, { encoding: 'utf16le' }), "hello");
    });
    it('.readStringSync() reads ucs-2 correctly', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(32);
        buf.write('hello', 'ucs-2');
        bitstream.addBuffer(buf);
        assert.strictEqual(bitstream.readStringSync(16, { encoding: 'ucs-2' }), "hello");
    });
    it('.readStringSync() detects string terminator even when half the last character is missing', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(32);
        buf.write('hello', 'ucs-2');
        bitstream.addBuffer(buf);
        assert.strictEqual(bitstream.readStringSync(11, { encoding: 'ucs-2' }), "hello");
    });
    it('.readStringSync() throws with an invalid encoding', () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(32);
        buf.write('hello', 'ucs-2');
        bitstream.addBuffer(buf);

        let caught;
        try {
            bitstream.readStringSync(16, { encoding: 'not-a-real-encoding' });
        } catch (e) { caught = e; }

        assert.ok(caught != null);
    });
    it('.readStringSync() throws with any encoding other than utf-8 when Buffer is not available', () => {

        let buf = Buffer.alloc(32);
        const BufferT = Buffer;
        (globalThis as any).Buffer = undefined;
        try {
            let bitstream = new BitstreamReader();
            buf.write('hello', 'utf16le');
            bitstream.addBuffer(buf);

            let caught;
            try {
                bitstream.readStringSync(16, { encoding: 'utf16le' });
            } catch (e) { caught = e; }

            assert.ok(caught != null);
        } finally {
            (globalThis as any).Buffer = BufferT;
        }
    });
    it('.readStringSync() supports utf-8 even when Buffer is not present', () => {

        let buf = Buffer.alloc(32);
        const BufferT = Buffer;
        (globalThis as any).Buffer = undefined;
        try {
            let bitstream = new BitstreamReader();
            buf.write('hello', 'utf-8');
            bitstream.addBuffer(buf);
            assert.strictEqual(bitstream.readStringSync(16, { encoding: 'utf-8' }), 'hello');
        } finally {
            (globalThis as any).Buffer = BufferT;
        }
    });
    it('.readString() reads a string correctly when the data is already available', async () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(10);
        buf.write('hello', 'utf-8');

        bitstream.addBuffer(buf);
        assert.strictEqual(await bitstream.readString(10), 'hello');
    });
    it('.readString() reads a string correctly when the data is not yet available', async () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.alloc(10);
        buf.write('hello', 'utf-8');

        setTimeout(() => bitstream.addBuffer(buf), 10);
        assert.strictEqual(await bitstream.readString(10), 'hello');
    });
    it('.readBytes() reads a buffer correctly when the data is already available', async () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.from([ 12, 42, 15 ]);
        bitstream.addBuffer(buf);

        let buf2 = Buffer.alloc(3);
        await bitstream.readBytesBlocking(buf2);
        assert.deepStrictEqual(Array.from(buf2), [ 12, 42, 15 ]);
    });
    it('.readBytes() reads a buffer correctly when the data is already available', async () => {
        let bitstream = new BitstreamReader();
        let buf = Buffer.from([ 12, 42, 15 ]);
        setTimeout(() => bitstream.addBuffer(buf), 10);

        let buf2 = Buffer.alloc(3);
        await bitstream.readBytesBlocking(buf2);
        assert.deepStrictEqual(Array.from(buf2), [ 12, 42, 15 ]);
    });
    it('.addBuffer() throws when called on an ended stream', async () => {
        let bitstream = new BitstreamReader();
        assert.doesNotThrow(() => bitstream.addBuffer(new Uint8Array(1)));
        bitstream.end();
        assert.throws(() => bitstream.addBuffer(new Uint8Array(1)));
    });
    it('.simulate() restores offset after execution', async () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(new Uint8Array(2));
        bitstream.readSync(4);

        await bitstream.simulate(async () => {
            bitstream.readSync(4);
            assert.strictEqual(bitstream.offset, 8);
        });

        assert.strictEqual(bitstream.offset, 4);
    });
    it('.simulateSync() can be nested', async () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(new Uint8Array(8));
        bitstream.readSync(4);

        await bitstream.simulate(async () => {
            bitstream.readSync(4);
            assert.strictEqual(bitstream.offset, 8);
            await bitstream.simulateSync(async () => {
                bitstream.readSync(4);
                assert.strictEqual(bitstream.offset, 12);
            });
            assert.strictEqual(bitstream.offset, 8);
        });
        assert.strictEqual(bitstream.offset, 4);
    });
    it('.simulateSync() restores offset after execution', async () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(new Uint8Array(2));
        bitstream.readSync(4);

        bitstream.simulateSync(() => {
            bitstream.readSync(4);
            assert.strictEqual(bitstream.offset, 8);
        });

        assert.strictEqual(bitstream.offset, 4);
    });
    it('.simulateSync() can be nested', async () => {
        let bitstream = new BitstreamReader();

        bitstream.addBuffer(new Uint8Array(8));
        bitstream.readSync(4);

        bitstream.simulateSync(() => {
            bitstream.readSync(4);
            assert.strictEqual(bitstream.offset, 8);
            bitstream.simulateSync(() => {
                bitstream.readSync(4);
                assert.strictEqual(bitstream.offset, 12);
            });
            assert.strictEqual(bitstream.offset, 8);
        });
        assert.strictEqual(bitstream.offset, 4);
    });
    it('.end() markes stream as ended', async () => {
        let bitstream = new BitstreamReader();
        assert.strictEqual(bitstream.ended, false);
        bitstream.end();
        assert.strictEqual(bitstream.ended, true);
    });
    it('.end() causes pending assure() to reject', async () => {
        let bitstream = new BitstreamReader();
        let thrown = bitstream.assure(8).then(() => false).catch(() => true);
        bitstream.end();
        assert.strictEqual(await thrown, true);
    });
    it('.end() causes pending read() to reject', async () => {
        let bitstream = new BitstreamReader();
        let thrown = bitstream.read(8).then(() => false).catch(() => true);
        bitstream.end();
        assert.strictEqual(await thrown, true);
    });
    it('.end() does not cause a pending optional assure() to reject', async () => {
        let bitstream = new BitstreamReader();
        let thrown = bitstream.assure(8, true).then(() => false).catch(() => true);
        bitstream.end();
        assert.strictEqual(await thrown, false);
    });
    it('.reset() throws if there is a pending operation', async () => {
        let bitstream = new BitstreamReader();
        let thrown = bitstream.assure(8, true).then(() => false).catch(() => true);
        assert.throws(() => bitstream.reset());
    });
    it('.reset() does not throw if there is no pending operation', async () => {
        let bitstream = new BitstreamReader();
        assert.doesNotThrow(() => bitstream.reset());
    });
    it('.reset() unmarks a stream as ended', async () => {
        let bitstream = new BitstreamReader();
        assert.doesNotThrow(() => bitstream.addBuffer(new Uint8Array(1)));
        bitstream.end();
        assert.strictEqual(bitstream.ended, true);
        assert.throws(() => bitstream.addBuffer(new Uint8Array(1)));
        bitstream.reset();
        assert.strictEqual(bitstream.ended, false);
        assert.doesNotThrow(() => bitstream.addBuffer(new Uint8Array(1)));
    });
    it('.reset() clears buffers and resets read head to zero', async () => {
        let bitstream = new BitstreamReader();
        bitstream.addBuffer(new Uint8Array(1));
        bitstream.addBuffer(new Uint8Array(1));
        bitstream.addBuffer(new Uint8Array(1));

        // --

        bitstream.retainBuffers = true;
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 1);
        bitstream.readSync(8);
        assert.strictEqual(bitstream.bufferIndex, 2);
        assert.strictEqual(bitstream.offset, 16);
        assert.strictEqual(bitstream.available, 8);
        
        bitstream.reset();

        assert.strictEqual(bitstream.bufferIndex, 0);
        assert.strictEqual(bitstream.offset, 0);
        assert.strictEqual(bitstream.available, 0);
    });
});

describe('BitstreamReader (generated)', () => {
    for (let size = 1; size <= 52; ++size) {
        it(`reads ${size}bit values correctly`, async () => {
            let offset = 64 - size;
            let buf = new ArrayBuffer(8);
            let view = new DataView(buf);

            for (let i = 0; i < 10; ++i) {
                let num = Math.floor(Math.random() * 2**size);
                view.setBigUint64(0, BigInt(num), false);
                let reader = new BitstreamReader();
                reader.addBuffer(new Uint8Array(buf));
                reader.readSync(offset);
                assert.strictEqual(reader.readSync(size), num, `Test number #${i} (${num}) should have been read properly`);
            }
        });
    }

    for (let size = 1; size < 52; ++size) {
        it(`reads cross-byte ${size}bit values correctly [1-bit offset]`, async () => {
            let offset = 64 - size;
            let buf = new ArrayBuffer(8);
            let view = new DataView(buf);

            for (let i = 0; i < 10; ++i) {
                let num = Math.floor(Math.random() * 2**size);
                view.setBigUint64(0, BigInt(num) << BigInt(1), false);
                let reader = new BitstreamReader();
                reader.addBuffer(new Uint8Array(buf));
                reader.readSync(offset - 1);
                assert.strictEqual(reader.readSync(size), num, `Test number #${i} (${num}) should have been read properly`);
            }
        });
    }

    for (let size = 1; size < 49; ++size) {
        it(`reads cross-byte ${size}bit values correctly [4-bit offset]`, async () => {
            let offset = 64 - size;
            let buf = new ArrayBuffer(8);
            let view = new DataView(buf);

            for (let i = 0; i < 10; ++i) {
                let num = Math.floor(Math.random() * 2**size);
                view.setBigUint64(0, BigInt(num) << BigInt(4), false);
                let reader = new BitstreamReader();
                reader.addBuffer(new Uint8Array(buf));
                reader.readSync(offset - 4);
                assert.strictEqual(reader.readSync(size), num, `Test number #${i} (${num}) should have been read properly`);
            }
        });
    }
});