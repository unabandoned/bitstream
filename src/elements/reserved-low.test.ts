import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { ReservedLow } from "./reserved-low";
import { BitstreamElement } from "./element";
import { Field } from "./field";

describe('@ReservedLow()', () => {
    it('always writes low bits', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) a : number;
            @ReservedLow(8) reserved : number;
            @Field(8) b : number;
        }

        let buf = new CustomElement().with({ a: 123, reserved: 111, b: 122 }).serialize();

        assert.deepStrictEqual(Array.from(buf), [ 123, 0, 122]);
    });
    it('supports determinants', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) a : number;
            @ReservedLow(i => 8) reserved : number;
            @Field(8) b : number;
        }

        let buf = new CustomElement().with({ a: 123, reserved: 111, b: 122 }).serialize();

        assert.deepStrictEqual(Array.from(buf), [ 123, 0, 122]);
    });
    it('is never read', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) a : number;
            @ReservedLow(8) reserved : number;
            @Field(8) b : number;
        }

        let element = CustomElement.deserialize(Buffer.from([ 123, 111, 122 ]));

        assert.strictEqual(element.a, 123);
        assert.strictEqual(element.reserved, undefined);
        assert.strictEqual(element.b, 122);
    });
});