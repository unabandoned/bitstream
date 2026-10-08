import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { BitstreamElement } from "./element";
import { Field } from "./field";
import { resolveLength } from "./resolve-length";

describe('resolveLength()', () => {
    class CustomElement extends BitstreamElement {
        @Field(8) a : number;
    }
    class ContainerElement extends BitstreamElement {
        @Field() custom : CustomElement;
    }

    const element = new CustomElement().with({ a: 32 });
    const container = new ContainerElement();

    element.parent = container;
    const aField = CustomElement.syntax.find(x => x.name === 'a');

    it('should execute the determinant and return its value', () => {
        assert.strictEqual(resolveLength(i => i.a, element, aField), 32);
    });
    it('should throw with determinant and no instance', () => {
        let caught;

        try {
            resolveLength(i => i.a, undefined, undefined);
        } catch (e) { caught = e; }

        assert.ok(caught != null);
    });
    it('should throw when determinant returns negative value', () => {
        const consoleT = console;

        try {
            (globalThis as any).console = { 
                log() { },
                error() { },
                dir() { }
            }

            let caught;
            try {
                resolveLength(i => -1, element, aField);
            } catch (e) { caught = e; }

            assert.ok(caught != null);
            assert.ok(caught.message.includes('Length determinant returned negative value'));

        } finally {
            (globalThis as any).console = consoleT;
        }
    });
    it('should recognize and return literal values', () => {
        assert.strictEqual(resolveLength(100, element, aField), 100);
    });
    it('should support literals even when no instance is available', () => {
        assert.strictEqual(resolveLength(100, undefined, undefined), 100);
    });
});