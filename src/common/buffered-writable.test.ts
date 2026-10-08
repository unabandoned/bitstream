import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { BufferedWritable } from "./buffered-writable";

describe('BufferedWritable', () => {
    it('appends written data onto its buffer', () => {
        let writable = new BufferedWritable();
        assert.strictEqual(writable.buffer.length, 0);
        writable.write(Buffer.alloc(3));
        assert.strictEqual(writable.buffer.length, 3);
        writable.write(Buffer.alloc(20));
        assert.strictEqual(writable.buffer.length, 23);
    });
});