import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { BitstreamElement } from "./element";
import { Field } from "./field";
import { Reserved } from "./reserved";

describe('@Reserved()', () => {
    it('always writes high bits', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) a : number;
            @Reserved(8) reserved : number;
            @Field(8) b : number;
        }

        let buf = new CustomElement().with({ a: 123, reserved: 111, b: 122 }).serialize();

        assert.deepStrictEqual(Array.from(buf), [ 123, 255, 122]);
    });
    it('supports determinants', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) a : number;
            @Reserved(i => 8) reserved : number;
            @Field(8) b : number;
        }

        let buf = new CustomElement().with({ a: 123, reserved: 111, b: 122 }).serialize();

        assert.deepStrictEqual(Array.from(buf), [ 123, 255, 122]);
    });
    it('is never read', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) a : number;
            @Reserved(8) reserved : number;
            @Field(8) b : number;
        }

        let element = CustomElement.deserialize(Buffer.from([ 123, 111, 122 ]));

        assert.strictEqual(element.a, 123);
        assert.strictEqual(element.reserved, undefined);
        assert.strictEqual(element.b, 122);
    });
});