import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { Variant } from "./variant";
import { BitstreamReader, BitstreamWriter } from "../bitstream";
import { BitstreamElement } from "./element";
import { Field } from "./field";
import { BufferedWritable } from "../common";
import { DefaultVariant, Reserved, VariantMarker } from ".";

describe('BitstreamElement', () => {
    describe(': Casting', () => {
        it('as() allows correct casts', () => {
            class CustomElement extends BitstreamElement {}
            class ChildElement extends CustomElement {}
            let element : CustomElement = new ChildElement();
            assert.strictEqual(element.as(ChildElement), element);
        });
        it('as() throws on invalid casts', () => {
            class CustomElement extends BitstreamElement {}
            class ChildElement extends CustomElement {}
            let element : CustomElement = new CustomElement();
            let caught;

            try {
                element.as(ChildElement)
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
        });
        it('is() tells the truth', () => {
            class CustomElement extends BitstreamElement {}
            class ChildElement extends CustomElement {}
            let element : CustomElement = new ChildElement();
            
            assert.strictEqual(element.is(BitstreamElement), true);
            assert.strictEqual(element.is(CustomElement), true);
            assert.strictEqual(element.is(ChildElement), true);

            element = new CustomElement();
            
            assert.strictEqual(element.is(BitstreamElement), true);
            assert.strictEqual(element.is(CustomElement), true);
            assert.strictEqual(element.is(ChildElement), false);

            element = new BitstreamElement();

            assert.strictEqual(element.is(BitstreamElement), true);
            assert.strictEqual(element.is(CustomElement), false);
            assert.strictEqual(element.is(ChildElement), false);

            if (element.is(ChildElement)) {
                // This is a meta-test to ensure that is() returns type `this is T` to allow for type inferencing.
                // If you receive a Typescript compilation error here, it is because is() no longer has the correct
                // semantics.

                let child : ChildElement = element;
            }
        });

    });
    describe(': Cloning', () => {
        it('behaves correctly', () => {
            class CustomElement extends BitstreamElement {
                @Field() a : number;
                @Field() b : number;
                @Field() c : number;
            }
    
            let element = new CustomElement().with({ a: 123, b: 456, c: 789 });
            let clone = element.clone();
    
            assert.notStrictEqual(clone, element);
            assert.strictEqual(clone.a, 123);
            assert.strictEqual(clone.b, 456);
            assert.strictEqual(clone.c, 789);
        });
        it('works only for @Field() properties', () => {
            class CustomElement extends BitstreamElement {
                @Field() a : number;
                @Field() b : number;
                @Field() c : number;
                d : number;
                e : number;
            }
    
            let element = new CustomElement().with({ a: 123, b: 456, c: 789, d: 888, e: 999 });
            let clone = element.clone();
    
            assert.notStrictEqual(clone, element);
            assert.strictEqual(clone.a, 123);
            assert.strictEqual(clone.b, 456);
            assert.strictEqual(clone.c, 789);
            assert.strictEqual(clone.d, undefined);
            assert.strictEqual(clone.e, undefined);
        })
    });

    describe('.readBlocking()', () => {
        it('can wait for more data', async () => {
            class CustomElement extends BitstreamElement {
                @Field(8) byte1 : number;
                @Field(8) byte2 : number;
            }

            let reader = new BitstreamReader();
            reader.addBuffer(Buffer.from([ 123 ]));
            setTimeout(() => reader.addBuffer(Buffer.from([ 124 ])), 10);

            let result = await CustomElement.readBlocking(reader);

            assert.strictEqual(result.byte1, 123);
            assert.strictEqual(result.byte2, 124);
        });
    });

    it('can handle private fields', async () => {
        class CustomElement extends BitstreamElement {
            @Field(8) private byte1 : number;
            @Field(8) private byte2 : number;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 123, 124 ]));

        let result = await CustomElement.readBlocking(reader);

        assert.strictEqual((result as any).byte1, 123);
        assert.strictEqual((result as any).byte2, 124);
    });

    it('@Reserved() avoids reused name mistakes', () => {
        class A extends BitstreamElement {
            @Reserved(8) reserved: number;
            @Field(8) field1: number;
        }

        class B extends A {
            @Reserved(16) reserved: number;
            @Field(8) field2: number;
        }

        let b = B.deserialize(Buffer.from([ 0xFF, 1, 0xFF, 0XFF, 2 ]));

        assert.strictEqual(b.field1, 1);
        assert.strictEqual(b.field2, 2);
    });

    it('@Field() accepts single options when length is inferred', async () => {
        class CustomElement2 extends BitstreamElement {
            @Field(8) byte2: number;
        }
        class CustomElement extends BitstreamElement {
            @Field(8) byte1 : number;
            @Field({}) sub : CustomElement2;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 123, 124 ]));

        let result = await CustomElement.readBlocking(reader);

        assert.strictEqual(result.byte1, 123);
        assert.strictEqual(result.sub.byte2, 124);
    });

    it('can read ahead and make field presence decisions based on what\'s upcoming', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) byte1 : number;
            @Field(8, {
                readAhead: {
                    length: 8,
                    presentWhen: reader => reader.readSync(8) === 111
                }
            }) 
            lucky : number;
            @Field(8) byte3 : number;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 123, 111, 124 ]));

        let result = CustomElement.readSync(reader);

        assert.strictEqual(result.byte1, 123);
        assert.strictEqual(result.lucky, 111);
        assert.strictEqual(result.byte3, 124);

        reader.addBuffer(Buffer.from([ 123, 124 ]));
        result = CustomElement.readSync(reader);
        assert.strictEqual(result.byte1, 123);
        assert.strictEqual(result.lucky, undefined);
        assert.strictEqual(result.byte3, 124);
    });

    it('can read ahead and make field exclusion decisions based on what\'s upcoming', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) byte1 : number;
            @Field(8, {
                readAhead: {
                    length: 8,
                    excludedWhen: reader => reader.readSync(8) !== 111
                }
            }) 
            lucky : number;
            @Field(8) byte3 : number;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 123, 111, 124 ]));

        let result = CustomElement.readSync(reader);

        assert.strictEqual(result.byte1, 123);
        assert.strictEqual(result.lucky, 111);
        assert.strictEqual(result.byte3, 124);
        
        reader.addBuffer(Buffer.from([ 123, 124 ]));
        result = CustomElement.readSync(reader);
        assert.strictEqual(result.byte1, 123);
        assert.strictEqual(result.lucky, undefined);
        assert.strictEqual(result.byte3, 124);
    });

    it('end of stream does not cause read-ahead to fail', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) byte1 : number;
            @Field(8, {
                readAhead: {
                    length: 8,
                    presentWhen: reader => reader.available >= 8
                }
            }) 
            lucky : number;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 1, 2 ]));
        
        let result = CustomElement.readSync(reader);
        assert.strictEqual(result.byte1, 1);
        assert.strictEqual(result.lucky, 2);

        reader.addBuffer(Buffer.from([ 1 ]));
        reader.end();

        result = CustomElement.readSync(reader);
        assert.strictEqual(result.byte1, 1);
        assert.strictEqual(result.lucky, undefined);
    });
    it('blind read-ahead when faced with end of stream throws', () => {
        class CustomElement extends BitstreamElement {
            @Field(8) byte1 : number;
            @Field(8, {
                readAhead: {
                    length: 8,
                    presentWhen: reader => reader.readSync(8) === 2
                }
            }) 
            lucky : number;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 1, 2 ]));
        
        let result = CustomElement.readSync(reader);
        assert.strictEqual(result.byte1, 1);
        assert.strictEqual(result.lucky, 2);

        reader.addBuffer(Buffer.from([ 1 ]));
        reader.end();

        assert.throws(() => CustomElement.readSync(reader));
    });
    
    it('(async) end of stream does not cause read-ahead to fail', async () => {
        class CustomElement extends BitstreamElement {
            @Field(8) byte1 : number;
            @Field(8, {
                readAhead: {
                    length: 8,
                    presentWhen: reader => reader.available >= 8
                }
            }) 
            lucky : number;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 1, 2 ]));
        
        let result = await CustomElement.readBlocking(reader);
        assert.strictEqual(result.byte1, 1);
        assert.strictEqual(result.lucky, 2);

        reader.addBuffer(Buffer.from([ 1 ]));
        reader.end();

        result = await CustomElement.readBlocking(reader);
        assert.strictEqual(result.byte1, 1);
        assert.strictEqual(result.lucky, undefined);
    });
    it('(async) blind read-ahead when faced with end of stream throws', async () => {
        class CustomElement extends BitstreamElement {
            @Field(8) byte1 : number;
            @Field(8, {
                readAhead: {
                    length: 8,
                    presentWhen: reader => reader.readSync(8) === 2
                }
            }) 
            lucky : number;
        }

        let reader = new BitstreamReader();
        reader.addBuffer(Buffer.from([ 1, 2 ]));
        
        let result = await CustomElement.readBlocking(reader);
        assert.strictEqual(result.byte1, 1);
        assert.strictEqual(result.lucky, 2);

        reader.addBuffer(Buffer.from([ 1 ]));
        reader.end();

        let thrown = await CustomElement.readBlocking(reader).then(() => false).catch(() => true);

        assert.strictEqual(thrown, true);
    });
    describe(': Inheritance', () => {
        it('ownSyntax should be an empty array on a child element with no syntax of its own', () => {
            class CustomElement extends BitstreamElement { @Field(8) byte; }
            class CustomElement2 extends CustomElement { }
            assert.deepStrictEqual(CustomElement2.ownSyntax, []);
        })
        it('ownSyntax should not contain syntax from parent class', () => {
            class CustomElement extends BitstreamElement { @Field(8) byte; }
            class CustomElement2 extends CustomElement { @Field(8) byte2; }
            assert.deepStrictEqual(CustomElement2.ownSyntax.length, 1);
            assert.deepStrictEqual(CustomElement2.ownSyntax[0].name, 'byte2');
        })
        it('ownSyntax should not contain syntax from child class', () => {
            class CustomElement extends BitstreamElement { @Field(8) byte; }
            class CustomElement2 extends CustomElement { @Field(8) byte2; }
            assert.deepStrictEqual(CustomElement.ownSyntax.length, 1);
            assert.deepStrictEqual(CustomElement.ownSyntax[0].name, 'byte');
        })
        it('correctly deserializes a basic element in synchronous mode', async () => {
            class ExampleElement extends BitstreamElement {
                @Field(2) a;
                @Field(3) b;
                @Field(4) c;
                @Field(5) d;
                @Field(6) e;
            }
    
            //            |-|--|---|----|-----X-----
            let value = 0b10010110101011000010000000000000;
            let buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value);
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(buffer);
    
            let element = await ExampleElement.readBlocking(bitstream);
    
            assert.strictEqual(element.a, 0b10);
            assert.strictEqual(element.b, 0b010);
            assert.strictEqual(element.c, 0b1101);
            assert.strictEqual(element.d, 0b01011);
            assert.strictEqual(element.e, 0b000010);
        });
        it('correctly deserializes nested elements', async () => {
    
            class PartElement extends BitstreamElement {
                @Field(3) c;
                @Field(4) d;
            }
    
            class WholeElement extends BitstreamElement {
                @Field(1) a;
                @Field(2) b;
                @Field(0) part : PartElement;
                @Field(5) e;
                @Field(6) f;
            }
    
            //            ||-|--|---|----|-----X-----
            let value = 0b11010110101011000010100000000000;
            let buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value);
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(buffer);
    
            let element = await WholeElement.readBlocking(bitstream);
    
            assert.strictEqual(element.a, 0b1);
            assert.strictEqual(element.b, 0b10);
            assert.strictEqual(element.part.c, 0b101);
            assert.strictEqual(element.part.d, 0b1010);
            assert.strictEqual(element.e, 0b10110);
            assert.strictEqual(element.f, 0b000101);
        });
        it('correctly deserializes inherited fields', async () => {
            
            class BaseElement extends BitstreamElement {
                @Field(1) a;
                @Field(2) b;
            }

            class ExtendedElement extends BaseElement {
                @Field(3) c;
                @Field(4) d;
                @Field(5) e;
                @Field(6) f;
            }

            //            ||-|--|---|----|-----X-----
            let value = 0b11010110101011000010100000000000;
            let buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value);

            let bitstream = new BitstreamReader();
            bitstream.addBuffer(buffer);

            let element = await ExtendedElement.readBlocking(bitstream);

            assert.strictEqual(element.a, 0b1);
            assert.strictEqual(element.b, 0b10);
            assert.strictEqual(element.c, 0b101);
            assert.strictEqual(element.d, 0b1010);
            assert.strictEqual(element.e, 0b10110);
            assert.strictEqual(element.f, 0b000101);

        });
    });
    describe(': Numbers', () => {
        it('reads unsigned integers', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
            }

            let element = CustomElement.deserialize(Buffer.from([126, 72]));

            assert.strictEqual(element.a, 126);
            assert.strictEqual(element.b, 72);
        });
        it('writes unsigned integers', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
            }

            let buf = new CustomElement().with({ a: 126, b: 72 }).serialize();
            assert.deepStrictEqual(Array.from(buf), [ 126, 72 ]);
        });
        it('reads signed integers', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { number: { format: 'signed' }}) a : number;
                @Field(8, { number: { format: 'signed' }}) b : number;
                @Field(8, { number: { format: 'signed' }}) c : number;
            }

            let element = CustomElement.deserialize(Buffer.from([0xFB, 5, 0]));

            assert.strictEqual(element.a, -5);
            assert.strictEqual(element.b, 5);
            assert.strictEqual(element.c, 0);
        });
        it('writes signed integers', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { number: { format: 'signed' }}) a : number;
                @Field(8, { number: { format: 'signed' }}) b : number;
                @Field(8, { number: { format: 'signed' }}) c : number;
            }

            let buf = new CustomElement().with({ a: -5, b: 5, c: 0 }).serialize();
            assert.deepStrictEqual(Array.from(buf), [ 0xFB, 5, 0 ]);
        });
        it('reads floats', () => {
            class CustomElement extends BitstreamElement {
                @Field(32, { number: { format: 'float' }}) a : number;
                @Field(32, { number: { format: 'float' }}) b : number;
                @Field(32, { number: { format: 'float' }}) c : number;
            }

            let element = CustomElement.deserialize(Buffer.from([
                0x42, 0xCD, 0x00, 0x00,
                0xC3, 0xDA, 0x00, 0x00,
                0,0,0,0
            ]));

            assert.strictEqual(element.a, 102.5);
            assert.strictEqual(element.b, -436);
            assert.strictEqual(element.c, 0);
        });
        it('writes floats', () => {
            class CustomElement extends BitstreamElement {
                @Field(32, { number: { format: 'float' }}) a : number;
                @Field(32, { number: { format: 'float' }}) b : number;
                @Field(32, { number: { format: 'float' }}) c : number;
            }

            let buf = new CustomElement().with({ a: 102.5, b: -436, c: 0 }).serialize();
            assert.deepStrictEqual(Array.from(buf), [
                0x42, 0xCD, 0x00, 0x00,
                0xC3, 0xDA, 0x00, 0x00,
                0,0,0,0
            ]);
        });
        it('throws with an invalid format while reading', () => {
            class CustomElement extends BitstreamElement {
                @Field(32, { number: { format: <any>'invalid' }}) a : number;
                @Field(32, { number: { format: <any>'invalid' }}) b : number;
                @Field(32, { number: { format: <any>'invalid' }}) c : number;
            }

            let caught;
            try {
                CustomElement.deserialize(Buffer.from([
                    0x42, 0xCD, 0x00, 0x00,
                    0xC3, 0xDA, 0x00, 0x00,
                    0,0,0,0
                ]));
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
        });
        it('throws with an invalid format while writing', () => {
            class CustomElement extends BitstreamElement {
                @Field(32, { number: { format: <any>'invalid' }}) a : number;
                @Field(32, { number: { format: <any>'invalid' }}) b : number;
                @Field(32, { number: { format: <any>'invalid' }}) c : number;
            }

            let caught;
            try {
                new CustomElement().with({ a: 0, b: 0, c: 0 }).serialize();
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
        });
        it('throws when the length determinant throws while reading', () => {
            class CustomElement extends BitstreamElement {
                @Field(i => { throw new Error('uh oh'); }) a : number;
            }

            let caught;
            try {
                CustomElement.deserialize(Buffer.from([]));
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
            assert.ok(caught.message.includes('uh oh'));
        });
        it('throws when the length determinant throws while writing', () => {
            class CustomElement extends BitstreamElement {
                @Field(i => { throw new Error('uh oh'); }) a : number;
            }

            let caught;
            try {
                new CustomElement().with({ a: 123 }).serialize();
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
            assert.ok(caught.message.includes('uh oh'));
        });
        it('writes undefined as zero', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a = 123;
                @Field(8) b : number;
                @Field(8) c = 22;
            }

            let buf = new CustomElement().with({ b: undefined }).serialize();

            assert.deepStrictEqual(Array.from(buf), [ 123, 0, 22 ]);
        });
        it('writes null as zero', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a = 123;
                @Field(8) b : number;
                @Field(8) c = 22;
            }

            let buf = new CustomElement().with({ b: null }).serialize();

            assert.deepStrictEqual(Array.from(buf), [ 123, 0, 22 ]);
        });
    });
    describe(': Booleans', () => {
        it('has the correct default behavior while reading', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : boolean;
                @Field(8) b : boolean;
                @Field(8) c : boolean;
                @Field(8) d : boolean;
            }

            let element = CustomElement.deserialize(Buffer.from([ 0, 1, 2, 0 ]));

            assert.strictEqual(element.a, false);
            assert.strictEqual(element.b, true);
            assert.strictEqual(element.c, true);
            assert.strictEqual(element.d, false);
        });
        it('respects the chosen true/false values when reading with default mode', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { boolean: { true: 0, false: 1 }}) a : boolean;
                @Field(8, { boolean: { true: 0, false: 1 }}) b : boolean;
                @Field(8, { boolean: { true: 0, false: 1 }}) c : boolean;
                @Field(8, { boolean: { true: 0, false: 1 }}) d : boolean;
            }

            let element = CustomElement.deserialize(Buffer.from([ 0, 1, 2, 0 ]));

            assert.strictEqual(element.a, true);
            assert.strictEqual(element.b, false);
            assert.strictEqual(element.c, true);
            assert.strictEqual(element.d, true);
        });
        it('respects the chosen true/false values when reading with mode=false-unless', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { boolean: { true: 0, false: 1, mode: 'false-unless' }}) a : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'false-unless' }}) b : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'false-unless' }}) c : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'false-unless' }}) d : boolean;
            }

            let element = CustomElement.deserialize(Buffer.from([ 0, 1, 2, 0 ]));

            assert.strictEqual(element.a, true);
            assert.strictEqual(element.b, false);
            assert.strictEqual(element.c, false);
            assert.strictEqual(element.d, true);
        });
        it('respects the chosen true/false values when reading with mode=true-unless', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { boolean: { true: 0, false: 1, mode: 'true-unless' }}) a : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'true-unless' }}) b : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'true-unless' }}) c : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'true-unless' }}) d : boolean;
            }

            let element = CustomElement.deserialize(Buffer.from([ 0, 1, 2, 0 ]));

            assert.strictEqual(element.a, true);
            assert.strictEqual(element.b, false);
            assert.strictEqual(element.c, true);
            assert.strictEqual(element.d, true);
        });
        it('respects the chosen true/false values when reading with mode=undefined', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { boolean: { true: 0, false: 1, mode: 'undefined' }}) a : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'undefined' }}) b : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'undefined' }}) c : boolean;
                @Field(8, { boolean: { true: 0, false: 1, mode: 'undefined' }}) d : boolean;
            }

            let element = CustomElement.deserialize(Buffer.from([ 0, 1, 2, 0 ]));

            assert.strictEqual(element.a, true);
            assert.strictEqual(element.b, false);
            assert.strictEqual(element.c, undefined);
            assert.strictEqual(element.d, true);
        });
        it('behaves correctly with mode=undefined', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { boolean: { mode: 'undefined' }}) a : boolean;
                @Field(8, { boolean: { mode: 'undefined' }}) b : boolean;
                @Field(8, { boolean: { mode: 'undefined' }}) c : boolean;
                @Field(8, { boolean: { mode: 'undefined' }}) d : boolean;
            }

            let element = CustomElement.deserialize(Buffer.from([ 0, 1, 2, 0 ]));

            assert.strictEqual(element.a, false);
            assert.strictEqual(element.b, true);
            assert.strictEqual(element.c, undefined);
            assert.strictEqual(element.d, false);
        });
        it('has the correct default behavior while writing', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : boolean;
                @Field(8) b : boolean;
                @Field(8) c : boolean;
                @Field(8) d : boolean;
            }

            let buffer = new CustomElement().with({ a: true, b: false, c: true, d: false }).serialize();
            assert.deepStrictEqual(Array.from(buffer), [ 1, 0, 1, 0 ]);
        });
        it('respects the chosen undefined value while writing', () => {
            class CustomElement extends BitstreamElement {
                @Field(8, { boolean: { undefined: 99 }}) a : boolean;
                @Field(8, { boolean: { undefined: 99 }}) b : boolean;
                @Field(8, { boolean: { undefined: 99 }}) c : boolean;
                @Field(8, { boolean: { undefined: 99 }}) d : boolean;
            }

            let buffer = new CustomElement().with({ a: true, b: false, c: undefined, d: false }).serialize();
            assert.deepStrictEqual(Array.from(buffer), [ 1, 0, 99, 0 ]);
        });
    });
    describe(': Byte Arrays', () => {
        it('understands Buffer when length is a multiple of 8', async () => {
            class CustomElement extends BitstreamElement {
                @Field(4) a;
                @Field(4) b;
                @Field(16) c : Buffer;
            }
    
            //            |---|---|---------------X
            let value = 0b11010110101011000010100000000000;
            let buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value);
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(buffer);
    
            let element = await CustomElement.readBlocking(bitstream);
    
            assert.strictEqual(element.a, 0b1101);
            assert.strictEqual(element.b, 0b0110);
            assert.strictEqual(element.c.length, 2);
            assert.strictEqual(element.c[0], 0b10101100);
            assert.strictEqual(element.c[1], 0b00101000);
        });
        it('uses Uint8Array when requested even if Buffer is available', async () => {
            class CustomElement extends BitstreamElement {
                @Field(4) a;
                @Field(4) b;
                @Field(16) c : Uint8Array;
            }
    
            //            |---|---|---------------X
            let value = 0b11010110101011000010100000000000;
            let buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value);
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(buffer);
    
            let element = await CustomElement.readBlocking(bitstream);

            assert.strictEqual(element.a, 0b1101);
            assert.strictEqual(element.b, 0b0110);
            assert.ok(element.c instanceof Uint8Array);
            assert.strictEqual(element.c.length, 2);
            assert.strictEqual(element.c[0], 0b10101100);
            assert.strictEqual(element.c[1], 0b00101000);
        });
        it('uses Uint8Array when Buffer is not available', async () => {

            const BufferT = Buffer;

            (globalThis as any).Buffer = undefined;

            try {
                class CustomElement extends BitstreamElement {
                    @Field(4) a;
                    @Field(4) b;
                    @Field(16) c : Uint8Array;
                }
        
                //            |---|---|---------------X
                let value = 0b11010110101011000010100000000000;
                let buffer = new ArrayBuffer(4);
                let view = new DataView(buffer);
                view.setUint32(0, value);
        
                let bitstream = new BitstreamReader();
                bitstream.addBuffer(new Uint8Array(buffer));
        
                let element = await CustomElement.readBlocking(bitstream);

                assert.strictEqual(element.a, 0b1101);
                assert.strictEqual(element.b, 0b0110);
                assert.ok(element.c instanceof Uint8Array);
                assert.strictEqual(element.c.length, 2);
                assert.strictEqual(element.c[0], 0b10101100);
                assert.strictEqual(element.c[1], 0b00101000);
            } finally {
                (globalThis as any).Buffer = BufferT;
            }
        });
        it('writes fixed size Buffer correctly', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*4) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4])}).write(writer);

            assert.strictEqual(writable.buffer.length, 4);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4]);
        });
        it('respects writtenValue', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*4, { writtenValue: () => Buffer.from([1,2,3,4]) }) 
                buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([4,3,2,1])}).write(writer);

            assert.strictEqual(writable.buffer.length, 4);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4]);
        });
        it('truncates Buffer to fixed length by default', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(4*8) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4,5,6,7,8])}).write(writer);

            assert.strictEqual(writable.buffer.length, 4);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4]);
        });
        it('does not truncate Buffer when larger than fixed length and truncate=false', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*4, { buffer: { truncate: false }}) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4,5,6,7,8])}).write(writer);

            assert.strictEqual(writable.buffer.length, 8);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4,5,6,7,8]);
        });
        it('does not truncate Buffer when larger than fixed length and truncate=false', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*4, { buffer: { truncate: false }}) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4,5,6,7,8])}).write(writer);

            assert.strictEqual(writable.buffer.length, 8);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4,5,6,7,8]);
        });
        it('writes full declared size when Buffer is shorter', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*8) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4])}).write(writer);

            assert.strictEqual(writable.buffer.length, 8);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4,0,0,0,0]);
        });
        it('does not write full declared size when Buffer is shorter and truncate=false', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*8, { buffer: { truncate: false }}) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4])}).write(writer);

            assert.strictEqual(writable.buffer.length, 4);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4]);
        });
        it('uses the specified `fill` value when Buffer is shorter', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*8, { buffer: { fill: 135 }}) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4])}).write(writer);

            assert.strictEqual(writable.buffer.length, 8);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4,135,135,135,135]);
        });
        it('uses the specified `fill` value when Buffer is shorter and truncate=false', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(8*8, { buffer: { truncate: false, fill: 135 }}) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4])}).write(writer);

            assert.strictEqual(writable.buffer.length, 8);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4,135,135,135,135]);
        });
        it('still truncates the buffer length when `fill` is set but `truncate` is true (as default)', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(4*8, { buffer: { fill: 135 }}) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4,5,6,7,8])}).write(writer);

            assert.strictEqual(writable.buffer.length, 4);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4]);
        });
        it('still truncates the buffer length when `fill` is set but `truncate` is true (explicitly)', () => {
            let writable = new BufferedWritable();
            let writer = new BitstreamWriter(writable);
            class Element extends BitstreamElement {
                @Field(4*8, { buffer: { truncate: true, fill: 135 }}) buffer : Buffer;
            }

            new Element().with({ buffer: Buffer.from([1,2,3,4,5,6,7,8])}).write(writer);

            assert.strictEqual(writable.buffer.length, 4);
            assert.deepStrictEqual(Array.from(writable.buffer), [1,2,3,4]);
        });
        it('fails when Buffer field has non multiple-of-8 length', () => {
            let caught : Error;
    
            try {
                class CustomElement extends BitstreamElement {
                    @Field(4) a;
                    @Field(4) b;
                    @Field(7) c : Buffer;
                }
            } catch (e) {
                caught = e;
            }
    
            assert.ok(caught != null, 'should have thrown an error');
        });
        it('throws when length determinant throws during read', () => {
            let caught : Error;
    
            try {
                class CustomElement extends BitstreamElement {
                    @Field(4) a;
                    @Field(4) b;
                    @Field(i => { throw new Error('uh oh'); }) c : Buffer;
                }

                CustomElement.deserialize(Buffer.alloc(16));

            } catch (e) {
                caught = e;
            }
    
            assert.ok(caught != null, 'should have thrown an error');
            assert.ok(caught.message.includes('uh oh'));
        });
        it('throws when length determinant throws during write', () => {
            let caught : Error;
    
            try {
                class CustomElement extends BitstreamElement {
                    @Field(4) a;
                    @Field(4) b;
                    @Field(i => { throw new Error('uh oh'); }) c : Buffer;
                }

                new CustomElement().with({ a: 0, b: 1, c: Buffer.alloc(1) }).serialize();

            } catch (e) {
                caught = e;
            }
    
            assert.ok(caught != null, 'should have thrown an error');
            assert.ok(caught.message.includes('uh oh'));
        });
    });
    describe(': Strings', () => {
        it('are read correctly', async () => {
            class CustomElement extends BitstreamElement {
                @Field(4) a;
                @Field(4) b;
                @Field(5) c : string;
            }
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(Buffer.from([ 0b11010110 ]));
            bitstream.addBuffer(Buffer.from('hello', 'utf-8'));
    
            let element = await CustomElement.readBlocking(bitstream);
    
            assert.strictEqual(element.a, 0b1101);
            assert.strictEqual(element.b, 0b0110);
            assert.strictEqual(element.c, 'hello');
        });
        it('are written correctly', async () => {
            class CustomElement extends BitstreamElement {
                @Field(5) c : string;
            }
    
            let buf = Buffer.from(new CustomElement().with({ c: 'hello' }).serialize());
            
            assert.strictEqual(buf.toString('utf-8'), 'hello');
        });
        it('are written correctly (utf16le)', async () => {
            class CustomElement extends BitstreamElement {
                @Field(10, { string: { encoding: 'utf16le' }}) c : string;
            }
    
            let buf = Buffer.from(new CustomElement().with({ c: 'hello' }).serialize());
            
            assert.strictEqual(buf.toString('utf16le'), 'hello');
        });
    });
    describe(': Fields', () => {
        it('understands determinants', async () => {
            class CustomElement extends BitstreamElement {
                @Field(8) charCount;
                @Field(i => i.charCount) str : string;
                @Field(8) afterwards;
            }
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(Buffer.from([ 5 ]));
            bitstream.addBuffer(Buffer.from('hello', 'utf-8'));
            bitstream.addBuffer(Buffer.from([ 123 ]));
    
            let element = await CustomElement.readBlocking(bitstream);
    
            assert.strictEqual(element.charCount, 5);
            assert.strictEqual(element.str, 'hello');
            assert.strictEqual(element.afterwards, 123);
        });
        it('should throw when result of a length determinant is not a number', async () => {
            
            let caught;
            class CustomElement extends BitstreamElement {
                @Field(8) charCount;
                @Field(i => <any>'foo') str : string;
                @Field(8) afterwards;
            }
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(Buffer.from([ 5 ]));
            bitstream.addBuffer(Buffer.from('hello', 'utf-8'));
            bitstream.addBuffer(Buffer.from([ 123 ]));
    
            try {
                await CustomElement.readBlocking(bitstream);
            } catch (e) {
                caught = e;
            }
    
            assert.ok(caught != null);
        });
        it('should throw when result of a length determinant is undefined', async () => {
            
            let caught;
            class CustomElement extends BitstreamElement {
                @Field(8) charCount;
                @Field(i => undefined) str : string;
                @Field(8) afterwards;
            }
    
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(Buffer.from([ 5 ]));
            bitstream.addBuffer(Buffer.from('hello', 'utf-8'));
            bitstream.addBuffer(Buffer.from([ 123 ]));
    
            try {
                await CustomElement.readBlocking(bitstream);
            } catch (e) {
                caught = e;
            }
    
            assert.ok(caught != null);
        });
    });
    describe(': Element Fields', () => {
        it('reads nested element fields correctly', () => {
            class Child2Element extends BitstreamElement {
                @Field(8) byte;
            }
            class ChildElement extends BitstreamElement {
                @Field() child : Child2Element;
            }
            class CustomElement extends BitstreamElement {
                @Field() child : ChildElement;
            }

            let element = CustomElement.deserialize(Buffer.from([ 8 ]));

            assert.ok(element.child instanceof ChildElement);
            assert.ok(element.child.child instanceof Child2Element);
            assert.strictEqual(element.child.child.byte, 8);
        });
        it('writes nested element fields correctly', () => {
            class Child2Element extends BitstreamElement {
                @Field(8) byte;
            }
            class ChildElement extends BitstreamElement {
                @Field() child : Child2Element;
            }
            class CustomElement extends BitstreamElement {
                @Field() child : ChildElement;
            }

            let buf = new CustomElement().with({ 
                child: new ChildElement().with({ 
                    child: new Child2Element().with({ 
                        byte: 101 
                    })
                })
            }).serialize();

            assert.strictEqual(buf.length, 1);
            assert.strictEqual(buf[0], 101);
        });
        it('throws when nested element is null', () => {
            class Child2Element extends BitstreamElement {
                @Field(8) byte;
            }
            class ChildElement extends BitstreamElement {
                @Field() child : Child2Element;
            }
            class CustomElement extends BitstreamElement {
                @Field() child : ChildElement;
            }

            let caught;
            try {
                new CustomElement().with({ 
                    child: null
                }).serialize();
            } catch (e) { caught = e; }

            assert.ok(caught != null);
        });
        it('throws when nested element is undefined', () => {
            class Child2Element extends BitstreamElement {
                @Field(8) byte;
            }
            class ChildElement extends BitstreamElement {
                @Field() child : Child2Element;
            }
            class CustomElement extends BitstreamElement {
                @Field() child : ChildElement;
            }

            let caught;
            try {
                new CustomElement().with({ 
                    child: undefined
                }).serialize();
            } catch (e) { caught = e; }

            assert.ok(caught != null);
        });
        it('throws when nested element is the wrong type of object', () => {
            class Child2Element extends BitstreamElement {
                @Field(8) byte;
            }
            class ChildElement extends BitstreamElement {
                @Field() child : Child2Element;
            }
            class CustomElement extends BitstreamElement {
                @Field() child : ChildElement;
            }

            let caught;
            try {
                new CustomElement().with({ 
                    child: <any>{ }
                }).serialize();
            } catch (e) { caught = e; }

            assert.ok(caught != null);
        });
        it('throws when nested element is a string', () => {
            class Child2Element extends BitstreamElement {
                @Field(8) byte;
            }
            class ChildElement extends BitstreamElement {
                @Field() child : Child2Element;
            }
            class CustomElement extends BitstreamElement {
                @Field() child : ChildElement;
            }

            let caught;
            try {
                new CustomElement().with({ 
                    child: <any>'hello'
                }).serialize();
            } catch (e) { caught = e; }

            assert.ok(caught != null);
        });
    });
    describe(': Arrays', () => {
        it('should throw when used without specifying array: { type }', () => {
            
            let caught;
            try {
                class CustomElement extends BitstreamElement {
                    @Field(8) before;
                    @Field(0, { array: { countFieldLength: 8 } }) items : any[];
                    @Field(8) afterwards;
                }
            } catch (e) {
                caught = e;
            }
    
            assert.ok(caught != null);
        });
        it('should correctly read an array with a static count determinant', async () => {
            class CustomElement extends BitstreamElement {
                @Field(8) before;
                @Field(0, { array: { type: Number, count: 3, elementLength: 10 } }) items : number[];
            }
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(Buffer.from([ 123, 0b10011001, 0b10100110, 0b01011011, 0b00111010, 0b10111001 ]));
    
            let element = await CustomElement.readBlocking(bitstream);
    
            assert.strictEqual(element.before, 123);
            assert.strictEqual(element.items.length, 3);
            assert.strictEqual(element.items[0], 0b1001100110);
            assert.strictEqual(element.items[1], 0b1001100101);
            assert.strictEqual(element.items[2], 0b1011001110);
        });
        it('should correctly write an array with a static count determinant', async () => {
            class CustomElement extends BitstreamElement {
                @Field(8) before;
                @Field(0, { array: { type: Number, count: 3, elementLength: 8 } }) items : number[];
            }

            let buf = new CustomElement().with({ before: 122, items: [ 3, 4, 5 ]}).serialize();
            assert.deepStrictEqual(Array.from(buf), [ 122, 3, 4, 5]);
        });
        it('should understand a dynamic count determinant', async () => {
            class CustomElement extends BitstreamElement {
                @Field(8) count;
                @Field(8) before;
                @Field(0, { array: { type: Number, count: i => i.count, elementLength: 10 } }) items : number[];
            }
            let bitstream = new BitstreamReader();
            bitstream.addBuffer(Buffer.from([ 3, 123, 0b10011001, 0b10100110, 0b01011011, 0b00111010, 0b10111001 ]));
    
            let element = await CustomElement.readBlocking(bitstream);
    
            assert.strictEqual(element.before, 123);
            assert.strictEqual(element.items.length, 3);
            assert.strictEqual(element.items[0], 0b1001100110);
            assert.strictEqual(element.items[1], 0b1001100101);
            assert.strictEqual(element.items[2], 0b1011001110);
        });
        it('should throw when dynamic count determinant throws', async () => {
            class CustomElement extends BitstreamElement {
                @Field(8) before;
                @Field(0, { array: { type: Number, count: i => { throw new Error('uh oh'); }, elementLength: 8 } }) items : number[];
            }

            let caught;
            try {
                new CustomElement().with({ before: 122, items: [ 3, 4, 5 ]}).serialize();
            } catch (e) { 
                caught = e; 
            }
            assert.ok(caught != null);
        });
        describe(': { array: { hasMore } }', () => {
            it('when hasMore throws serialization should fail', async () => {
                let throwable = new Error('uh oh');
                class CustomElement extends BitstreamElement {
                    @Field(0, { array: { type: Number, elementLength: 8, hasMore: a => { throw throwable } }, number: { format: 'signed' } }) 
                    items : number[];
                }
                let bitstream = new BitstreamReader();
                bitstream.addBuffer(Buffer.from([ 12, 34, 56, 78, 0 ]));
        
                let caught;

                try {
                    await CustomElement.readBlocking(bitstream);
                } catch (e) { 
                    caught = e;
                }
                
                assert.ok(caught != null);
                assert.ok(caught.message.includes('uh oh'));
            });
            it('hasMore should be able to observe the array being built', async () => {
                class CustomElement extends BitstreamElement {
                    @Field(0, { array: { type: Number, elementLength: 8, hasMore: a => a[a.length - 1] !== 0 }, number: { format: 'signed' } }) 
                    items : number[];
                }
                let bitstream = new BitstreamReader();
                bitstream.addBuffer(Buffer.from([ 12, 34, 56, 78, 0 ]));
        
                let element = await CustomElement.readBlocking(bitstream);
        
                assert.strictEqual(element.items.length, 5);
                assert.strictEqual(element.items[0], 12);
                assert.strictEqual(element.items[1], 34);
                assert.strictEqual(element.items[2], 56);
                assert.strictEqual(element.items[3], 78);
                assert.strictEqual(element.items[4], 0);
            });
        });
        describe('of numbers', () => {
            it('should throw when number type is unknown', async () => {
                class CustomElement extends BitstreamElement {
                    @Field(3, { array: { type: Number, elementLength: 32 }, number: { format: <any>'not-real' } }) 
                    items : number[];
                }
                let bitstream = new BitstreamReader();
                bitstream.addBuffer(Buffer.from([ 
                    0x42, 0xCD, 0x00, 0x00,
                    0xC3, 0xDA, 0x00, 0x00,
                    0,0,0,0
                ]));
        
                let caught;
                try {
                    await CustomElement.readBlocking(bitstream);
                } catch (e) { caught = e; }

                assert.ok(caught != null);
            });
            it(': unsigned integers', async () => {
                class CustomElement extends BitstreamElement {
                    @Field(8) before;
                    @Field(0, { array: { type: Number, countFieldLength: 8, elementLength: 10 } }) items : number[];
                }

                let element = await CustomElement.deserialize(Buffer.from([ 
                    123, 3, 0b10011001, 0b10100110, 0b01011011, 0b00111010, 0b10111001 
                ]));

                assert.strictEqual(element.before, 123);
                assert.strictEqual(element.items.length, 3);
                assert.strictEqual(element.items[0], 0b1001100110);
                assert.strictEqual(element.items[1], 0b1001100101);
                assert.strictEqual(element.items[2], 0b1011001110);

                class CustomElement2 extends BitstreamElement {
                    @Field(8) before;
                    @Field(0, { array: { type: Number, countFieldLength: 8, elementLength: 8 } }) items : number[];
                }
                let buf = new CustomElement2().with({ before: 123, items: [ 7, 8, 9]}).serialize();

                assert.deepStrictEqual(Array.from(buf), [
                    123, 3, 7, 8, 9
                ])
            });
            it(': unsigned integers: hasMore', async () => {
                class CustomElement extends BitstreamElement {
                    @Field(0, { array: { type: Number, elementLength: 8, hasMore: a => a[a.length - 1] !== 0 } }) 
                    items : number[];
                }
                let bitstream = new BitstreamReader();
                bitstream.addBuffer(Buffer.from([ 12, 34, 56, 78, 0 ]));
        
                let element = await CustomElement.readBlocking(bitstream);
        
                assert.strictEqual(element.items.length, 5);
                assert.strictEqual(element.items[0], 12);
                assert.strictEqual(element.items[1], 34);
                assert.strictEqual(element.items[2], 56);
                assert.strictEqual(element.items[3], 78);
                assert.strictEqual(element.items[4], 0);
            });
            it(': signed integers', async () => {
                class CustomElement extends BitstreamElement {
                    @Field(3, { array: { type: Number, elementLength: 8 }, number: { format: 'signed' } }) 
                    items : number[];
                }
                
                let element = await CustomElement.deserialize(Buffer.from([ 0xFB, 5, 0 ]));

                assert.strictEqual(element.items.length, 3);
                assert.strictEqual(element.items[0], -5);
                assert.strictEqual(element.items[1], 5);
                assert.strictEqual(element.items[2], 0);

                let buf = new CustomElement().with({ items: [ -5, 5, 0]}).serialize();
                assert.deepStrictEqual(Array.from(buf), [0xFB, 5, 0]);
            });
            it(': floats', async () => {
                class CustomElement extends BitstreamElement {
                    @Field(3, { array: { type: Number, elementLength: 32 }, number: { format: 'float' } }) 
                    items : number[];
                }

                let bin = [ 
                    0x42, 0xCD, 0x00, 0x00,
                    0xC3, 0xDA, 0x00, 0x00,
                    0,0,0,0
                ];
                let element = await CustomElement.deserialize(Buffer.from(bin));
        
                assert.strictEqual(element.items.length, 3);
                assert.strictEqual(element.items[0], 102.5);
                assert.strictEqual(element.items[1], -436);
                assert.strictEqual(element.items[2], 0);

                let buf = new CustomElement().with({ items: [ 102.5, -436, 0]}).serialize();
                assert.deepStrictEqual(Array.from(buf), bin);
            });
        });
        describe('of elements', () => {
            it('should correctly parse elements', async () => {
                class ItemElement extends BitstreamElement {
                    @Field(8) a;
                    @Field(8) b;
                }
                class CustomElement extends BitstreamElement {
                    @Field(8) before;
                    @Field(0, { array: { type: ItemElement, countFieldLength: 8 } }) items : ItemElement[];
                    @Field(8) afterwards;
                }
        
                let bitstream = new BitstreamReader();
                bitstream.addBuffer(Buffer.from([ 123, 3, 1, 2, 11, 12, 21, 22, 123 ]));
        
                let element = await CustomElement.readBlocking(bitstream);
        
                assert.strictEqual(element.before, 123);
                assert.strictEqual(element.items.length, 3);
                
                assert.strictEqual(element.items[0].a, 1);
                assert.strictEqual(element.items[0].b, 2);
                assert.strictEqual(element.items[1].a, 11);
                assert.strictEqual(element.items[1].b, 12);
                assert.strictEqual(element.items[2].a, 21);
                assert.strictEqual(element.items[2].b, 22);
                assert.strictEqual(element.afterwards, 123);
            });
            it('should understand hasMore discriminant', async () => {
                class CustomItem extends BitstreamElement {
                    @Field(8) byte;
                }
        
                class CustomElement extends BitstreamElement {
                    @Field(0, { array: { type: CustomItem, hasMore: a => a.length === 0 || a[a.length - 1].byte !== 0 } })
                    items : CustomItem[];
                }
                let bitstream = new BitstreamReader();
                bitstream.addBuffer(Buffer.from([ 12, 34, 56, 78, 0 ]));
        
                let element = await CustomElement.readBlocking(bitstream);
        
                assert.strictEqual(element.items.length, 5);
                assert.strictEqual(element.items[0].byte, 12);
                assert.strictEqual(element.items[1].byte, 34);
                assert.strictEqual(element.items[2].byte, 56);
                assert.strictEqual(element.items[3].byte, 78);
                assert.strictEqual(element.items[4].byte, 0);
            });
        });
    });
    describe(': Lifecycle Events', () => {
        it(': should call onParseStarted when parsing begins', () => {
            let called = 0;
    
            class CustomElement extends BitstreamElement {
                onParseStarted() {
                    called += 1;
                }
    
                @Field(8) byte;
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(called, 1);
        });
        it(': should call onParseFinished when parsing is completed', () => {
            let called = 0;
    
            class CustomElement extends BitstreamElement {
                onParseFinished() { called += 1; }
    
                @Field(8) byte;
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(called, 1);
        });
        it(': should call onParseFinished on variant after variation', () => {
            let called = 0;
    
            class CustomElement extends BitstreamElement {
                @Field(8) byte;
            }
    
            @Variant(i => true)
            class CustomElement2 extends CustomElement {
                onParseFinished() { called += 1; }
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(called, 1);
        });
        it(': should not call onParseFinished on original after variation', () => {
            let called = 0;
            let subCalled = 0;
    
            class CustomElement extends BitstreamElement {
                onParseFinished() { called += 1; }
    
                @Field(8) byte : number;
            }
    
            @Variant(i => true)
            class CustomElement2 extends CustomElement {
                onParseFinished() { subCalled += 1; }
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(called, 0);
            assert.strictEqual(subCalled, 1);
        });
        it(': should call onParseStarted on both original and variant during variation', () => {
            let called = 0;
    
            class CustomElement extends BitstreamElement {
                onParseStarted() { called += 1; }
    
                @Field(8) byte;
            }
    
            @Variant(i => true)
            class CustomElement2 extends CustomElement {
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(called, 2);
        });
        it(': should call onVariationTo on original, but not the variant', () => {
            let called = 0;
    
            class CustomElement extends BitstreamElement {
                onVariationTo() { called += 1; }
    
                @Field(8) byte;
            }
    
            @Variant(i => true)
            class CustomElement2 extends CustomElement {
                onVariationTo() { throw new Error("Should not be called"); }
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(called, 1);
        });
        it(': should call onVariationFrom on variant, but not the original', () => {
            let called = 0;
    
            class CustomElement extends BitstreamElement {
                onVariationFrom() { throw new Error("Should not be called"); }
    
                @Field(8) byte;
            }
    
            @Variant(i => true)
            class CustomElement2 extends CustomElement {
                onVariationFrom() { called += 1; }
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(called, 1);
        });
        it(': should pass the original to the variant during onVariationFrom', () => {
            let passed;
    
            class CustomElement extends BitstreamElement {
                @Field(8) byte;
    
                whoAmI() { return 'original'; }
            }
    
            @Variant(i => true)
            class CustomElement2 extends CustomElement {
    
                whoAmI() { return 'variant'; }
                onVariationFrom(original) { passed = original; }
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(passed.whoAmI(), 'original');
        });
        it(': should pass the variant to the original during onVariationTo', () => {
            let passed;
    
            class CustomElement extends BitstreamElement {
                @Field(8) byte;
    
                whoAmI() { return 'original'; }
                onVariationTo(variant) { passed = variant; }
            }
    
            @Variant(i => true)
            class CustomElement2 extends CustomElement {
    
                whoAmI() { return 'variant'; }
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(passed.whoAmI(), 'variant');
        });
    });
    describe(': Variation', () => {
        it('corrects the select tail variant while reading', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
            }

            @Variant(i => i.type === 1)
            class Type1 extends CustomElement {
                @Field(8) value : number;
            }

            @Variant(i => i.type === 2)
            class Type2 extends CustomElement {
                @Field(8) value : number;
            }

            let element : CustomElement;
            
            element = CustomElement.deserialize(Buffer.from([ 1, 123 ]));
            assert.ok(element instanceof Type1);
            assert.strictEqual(element.as(Type1).value, 123);

            element = CustomElement.deserialize(Buffer.from([ 2, 34 ]));
            assert.ok(element instanceof Type2);
            assert.strictEqual(element.as(Type2).value, 34);
        });
        it('corrects the select marker variant while reading', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @VariantMarker() $variantMarker;
                @Field(8) suffix : number;
            }

            @Variant(i => i.type === 1)
            class Type1 extends CustomElement {
                @Field(8) value : number;
            }

            @Variant(i => i.type === 2)
            class Type2 extends CustomElement {
                @Field(8) value : number;
            }

            let element : CustomElement;
            
            element = CustomElement.deserialize(Buffer.from([ 1, 123, 111 ]));
            assert.ok(element instanceof Type1);
            assert.strictEqual(element.as(Type1).value, 123);
            assert.strictEqual(element.as(Type1).suffix, 111);

            element = CustomElement.deserialize(Buffer.from([ 2, 22, 112 ]));
            assert.ok(element instanceof Type2);
            assert.strictEqual(element.as(Type2).value, 22);
            assert.strictEqual(element.as(Type2).suffix, 112);
        });
        it('respects the priority option', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @VariantMarker() $variantMarker;
                @Field(8) suffix : number;
            }

            @Variant(i => true, { priority: 1 })
            class Type1 extends CustomElement {
                @Field(8) value : number;
            }

            @Variant(i => true, { priority: 0 })
            class Type2 extends CustomElement {
                @Field(8) value : number;
            }

            let element : CustomElement;
            
            element = CustomElement.deserialize(Buffer.from([ 2, 22, 112 ]));
            assert.ok(element instanceof Type2);
            assert.strictEqual(element.as(Type2).value, 22);
            assert.strictEqual(element.as(Type2).suffix, 112);
        });
        it('uses @DefaultVariant() as a last resort', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @VariantMarker() $variantMarker;
                @Field(8) suffix : number;
            }

            @DefaultVariant()
            class Type1 extends CustomElement {
                @Field(8) value : number;
            }

            @Variant(i => i.type === 2, { priority: 0 })
            class Type2 extends CustomElement {
                @Field(8) value : number;
            }

            let element : CustomElement;
            
            element = CustomElement.deserialize(Buffer.from([ 2, 22, 112 ]));
            assert.ok(element instanceof Type2);
            assert.strictEqual(element.as(Type2).value, 22);
            assert.strictEqual(element.as(Type2).suffix, 112);

            element = CustomElement.deserialize(Buffer.from([ 1, 22, 112 ]));
            assert.ok(element instanceof Type1);
            assert.strictEqual(element.as(Type1).value, 22);
            assert.strictEqual(element.as(Type1).suffix, 112);
        });
    });
    describe(': Serialization', () => {
        it('supports partial serialization', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let buf = new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize('b', 'c');
            assert.deepStrictEqual(Array.from(buf), [ 2, 3 ]);

            buf = new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize('a', 'c');
            assert.deepStrictEqual(Array.from(buf), [ 1, 2, 3 ]);
        });
        it('throws when deserializing and buffer is exhausted', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let caught;
            try {
                CustomElement.deserialize(Buffer.from([ 7, 8 ]));
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);

        });
        it('partial serialization respects presentWhen', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8, { presentWhen: i => false }) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let buf = new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize('a', 'c');
            assert.deepStrictEqual(Array.from(buf), [ 1, 3 ]);

            buf = new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize('a', 'd');
            assert.deepStrictEqual(Array.from(buf), [ 1, 3, 4 ]);
        });
        it('throws when requesting an invalid partial serialization', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let caught;
            try {
                new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize('c', 'b');
            } catch (e) {
                caught = e;
            }
            assert.ok(caught != null);
            caught = undefined;
            
            try {
                new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize('c', 'a');
            } catch (e) {
                caught = e;
            }
            assert.ok(caught != null);
        });
        it('throws when element is not byte aligned and autoPad=false', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(7) d : number;
            }

            let caught;
            try {
                new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize();
            } catch (e) {
                caught = e;
            }
            assert.ok(caught != null);
            caught = undefined;
            
            try {
                new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize();
            } catch (e) {
                caught = e;
            }
            assert.ok(caught != null);
        });
        it('correctly pads when element is not byte aligned and autoPad=true', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(7) d : number;
            }

            let buf = new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize(undefined, undefined, true);

            assert.deepStrictEqual(Array.from(buf), [1,2,3,4 << 1]);
        });
        it('partial serialization supports type-safe references', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let buf = new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize(i => i.b, i => i.c);
            assert.deepStrictEqual(Array.from(buf), [ 2, 3 ]);

            buf = new CustomElement().with({ a: 1, b: 2, c: 3, d: 4 }).serialize(i => i.a, i => i.c);
            assert.deepStrictEqual(Array.from(buf), [ 1, 2, 3 ]);
        });
        it('can read an element synchronously if enough bits are available', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let reader = new BitstreamReader();
            reader.addBuffer(Buffer.from([ 1, 2, 3, 4]));

            let result = CustomElement.readSync(reader);

            assert.strictEqual(result.a, 1);
            assert.strictEqual(result.b, 2);
            assert.strictEqual(result.c, 3);
            assert.strictEqual(result.d, 4);
        });
        it('can try to read an element synchronously', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let reader = new BitstreamReader();
            reader.addBuffer(Buffer.from([ 1, 2, 3]));

            let result = CustomElement.tryRead(reader); assert.strictEqual(result, undefined);
            result = CustomElement.tryRead(reader); assert.strictEqual(result, undefined);
            result = CustomElement.tryRead(reader); assert.strictEqual(result, undefined);
            result = CustomElement.tryRead(reader); assert.strictEqual(result, undefined);
            reader.addBuffer(Buffer.from([ 4 ]));
            result = CustomElement.tryRead(reader); assert.notStrictEqual(result, undefined);

            assert.strictEqual(result.a, 1);
            assert.strictEqual(result.b, 2);
            assert.strictEqual(result.c, 3);
            assert.strictEqual(result.d, 4);
        });
        it('trying to read an element that throws during parsing should throw', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(i => { throw new Error('uh oh')}) d : number;
            }

            let reader = new BitstreamReader();
            reader.addBuffer(Buffer.from([ 1, 2, 3]));

            let caught;
            try {
                CustomElement.tryRead(reader);
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
        });
        it('when trying to read an element throws, the reader offset should be left where it is', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(i => { throw new Error('uh oh')}) d : number;
            }

            let reader = new BitstreamReader();
            reader.addBuffer(Buffer.from([ 0, 1, 2, 3]));

            reader.readSync(8);

            let offset = reader.offset;

            let caught;
            try {
                CustomElement.tryRead(reader);
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
            assert.strictEqual(reader.offset, offset);
        });
        it('throws when reading an element synchronously if enough bits are not available', () => {
            
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
                @Field(8) d : number;
            }

            let reader = new BitstreamReader();
            reader.addBuffer(Buffer.from([ 1, 2, 3 ]));
            let caught;
            try {
                CustomElement.readSync(reader);
            } catch (e) {
                caught = e;
            }

            assert.ok(caught != null);
        });
        it('the skip option skips particular fields during deserialization', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(8) c : number;
            }

            let element = CustomElement.deserialize(Buffer.from([ 22, 44 ]), { skip: [ 'b' ]});

            assert.strictEqual(element.a, 22);
            assert.strictEqual(element.b, undefined);
            assert.strictEqual(element.c, 44);
        });
    });
    describe(': Measurement', () => {
        it('can measure an element with static field sizes', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @Field(8) value : number;
                @Field(8) suffix : number;
            }

            assert.strictEqual(new CustomElement().measure(), 24);
        });
        it('can be used in a determinant', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) a : number;
                @Field(8) b : number;
                @Field(i => i.measure()) c : number;
                @Field(8) d : number;
            }

            let buf = new CustomElement().with({ a: 11, b: 22, c: 33, d: 44 }).serialize();

            assert.deepStrictEqual(Array.from(buf), [11, 22, 0, 33, 44]);

            let element = CustomElement.deserialize(Buffer.from([11, 22, 0, 33, 44]));

            assert.strictEqual(element.a, 11);
            assert.strictEqual(element.b, 22);
            assert.strictEqual(element.c, 33);
            assert.strictEqual(element.d, 44);
        });
        it('measureFrom() works as expected', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @Field(8) value : number;
                @Field(16) suffix : number;
            }

            assert.strictEqual(new CustomElement().measureFrom('value'), 24);
        });
        it('measureTo() works as expected', () => {
            class CustomElement extends BitstreamElement {
                @Field(16) type : number;
                @Field(8) value : number;
                @Field(8) suffix : number;
            }

            assert.strictEqual(new CustomElement().measureTo('value'), 24);
        });
        it('takes determinants into account', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @Field(i => i.type === 1 ? 8 : 16) value : number;
                @Field(8) suffix : number;
            }

            let element = new CustomElement().with({ type: 1, value: 123, suffix: 117});

            assert.strictEqual(element.measure(), 24);
            element.type = 2;
            assert.strictEqual(element.measure(), 32);
        });
        it('correctly computes partial measurements', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @Field(16) value : number;
                @Field(16) value2 : number;
                @Field(8) suffix : number;
            }

            let element = new CustomElement();

            assert.strictEqual(element.measure('type', 'value'), 24);
            assert.strictEqual(element.measure('value', 'value2'), 32);
            assert.strictEqual(element.measure('value', 'suffix'), 40);
            assert.strictEqual(element.measure('value2', 'suffix'), 24);
        });
        it('supports type-safe field references', () => {
            class CustomElement extends BitstreamElement {
                @Field(8) type : number;
                @Field(16) value : number;
                @Field(16) value2 : number;
                @Field(8) suffix : number;
            }

            let element = new CustomElement();

            assert.strictEqual(element.measure(i => i.type, i => i.value), 24);
            assert.strictEqual(element.measure(i => i.value, i => i.value2), 32);
            assert.strictEqual(element.measure(i => i.value, i => i.suffix), 40);
            assert.strictEqual(element.measure(i => i.value2, i => i.suffix), 24);
        });
    });
    describe(': Context', () => {
        it(': subelements have the same context object as the parent', () => {
            let subObserved;
            let parentObserved;
    
            class SubElement extends BitstreamElement {
                onParseStarted() { subObserved = this.context; }
                @Field(8) byte;
            }
    
            class CustomElement extends BitstreamElement {
                onParseStarted() { parentObserved = this.context; }
                @Field() subelement : SubElement;
            }
    
            CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(subObserved, parentObserved);
        });
        it(': sibling elements have the same context object as the parent', () => {
            let subObserved;
            let sub2Observed;
            let parentObserved;
    
            class SubElement extends BitstreamElement {
                onParseStarted() { subObserved = this.context; }
                @Field(8) byte;
            }
            class SubElement2 extends BitstreamElement {
                onParseStarted() { sub2Observed = this.context; }
                @Field(8) byte;
            }
    
            class CustomElement extends BitstreamElement {
                onParseStarted() { parentObserved = this.context; }
                @Field() subelement : SubElement;
                @Field() subelement2 : SubElement2;
            }
    
            CustomElement.deserialize(Buffer.alloc(2));
            assert.strictEqual(subObserved, parentObserved);
            assert.strictEqual(sub2Observed, parentObserved);
        });
        it(': passed context should be made available to element', () => {
            let observed;
    
            class CustomElement extends BitstreamElement {
                onParseStarted() { observed = this.context; }
                @Field(8) byte : number;
            }
    
            let context = {};
            CustomElement.deserialize(Buffer.alloc(1), { context });
            assert.strictEqual(observed, context);
        });
        it(': passed context should be made available to sibling subelements', () => {
            let subObserved;
            let sub2Observed;
            let parentObserved;
    
            class SubElement extends BitstreamElement {
                onParseStarted() { subObserved = this.context; }
                @Field(8) byte;
            }
            class SubElement2 extends BitstreamElement {
                onParseStarted() { sub2Observed = this.context; }
                @Field(8) byte;
            }
    
            class CustomElement extends BitstreamElement {
                onParseStarted() { parentObserved = this.context; }
                @Field() subelement : SubElement;
                @Field() subelement2 : SubElement2;
            }
    
            let context = {};
            CustomElement.deserialize(Buffer.alloc(2), { context });
            assert.strictEqual(parentObserved, context);
            assert.strictEqual(subObserved, context);
            assert.strictEqual(sub2Observed, context);
        });
        it(': context should be shared by parent and array field elements', () => {
            let subObserved;
            let parentObserved;
    
            class SubElement extends BitstreamElement {
                onParseStarted() { subObserved = this.context; }
                @Field(8) byte;
            }
    
            class CustomElement extends BitstreamElement {
                onParseStarted() { parentObserved = this.context; }
                @Field(1, { array: { type: SubElement } }) array : SubElement[];
            }
    
            let element = CustomElement.deserialize(Buffer.alloc(1));
            assert.strictEqual(element.array.length, 1);
    
            assert.strictEqual(subObserved, parentObserved);
        });
        it(': passed context should be made available to array elements', () => {
            let subObserved;
            let parentObserved;
    
            class SubElement extends BitstreamElement {
                onParseStarted() { subObserved = this.context; }
                @Field(8) byte;
            }
    
            class CustomElement extends BitstreamElement {
                onParseStarted() { parentObserved = this.context; }
                @Field(1, { array: { type: SubElement }}) array : SubElement[];
            }
    
            let context = {};
            let element = CustomElement.deserialize(Buffer.alloc(1), { context });
            assert.strictEqual(element.array.length, 1);
    
            assert.strictEqual(parentObserved, context);
            assert.strictEqual(subObserved, context);
        });
    });

    describe(': Advanced Serialization', () => {

        describe(': readGroup()', () => {
            it('supports simple grouping', () => {
                class CustomElement extends BitstreamElement {
                    @Field(8, { group: 'a' }) a1 : number;
                    @Field(8, { group: 'b' }) b1 : number;
                    @Field(8, { group: 'a' }) a2 : number;
                    @Field(8, { group: 'b' }) b2 : number;
                    @Field(8, { group: 'a' }) a3 : number;
                    @Field(8, { group: 'b' }) b3 : number;
                    @Field(8, { group: 'a' }) a4 : number;
                    @Field(8, { group: 'b' }) b4 : number;

                    static a(reader : BitstreamReader) {
                        let element = new CustomElement();
                        element.readGroup(reader, 'a').next();
                        return element;
                    }

                    static b(reader : BitstreamReader) {
                        let element = new CustomElement();
                        element.readGroup(reader, 'b').next();
                        return element;
                    }
                }
        
                let buf = Buffer.from([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
                let reader : BitstreamReader;
                let element : CustomElement;

                reader = new BitstreamReader();
                reader.addBuffer(buf);
                element = CustomElement.a(reader);
                assert.strictEqual(element.a1, 0);
                assert.strictEqual(element.a2, 1);
                assert.strictEqual(element.a3, 2);
                assert.strictEqual(element.a4, 3);
                assert.strictEqual(element.b1, undefined);
                assert.strictEqual(element.b2, undefined);
                assert.strictEqual(element.b3, undefined);
                assert.strictEqual(element.b4, undefined);

                reader = new BitstreamReader();
                reader.addBuffer(buf);
                element = CustomElement.b(reader);
                assert.strictEqual(element.b1, 0);
                assert.strictEqual(element.b2, 1);
                assert.strictEqual(element.b3, 2);
                assert.strictEqual(element.b4, 3);
                assert.strictEqual(element.a1, undefined);
                assert.strictEqual(element.a2, undefined);
                assert.strictEqual(element.a3, undefined);
                assert.strictEqual(element.a4, undefined);
            });
            it('supports "all" grouping', () => {
                class CustomElement extends BitstreamElement {
                    @Field(8, { group: 'a' }) a1 : number;
                    @Field(8, { group: 'b' }) b1 : number;
                    @Field(8, { group: 'a' }) a2 : number;
                    @Field(8, { group: 'b' }) b2 : number;
                    @Field(8, { group: 'a' }) a3 : number;
                    @Field(8, { group: 'b' }) b3 : number;
                    @Field(8, { group: 'a' }) a4 : number;
                    @Field(8, { group: 'b' }) b4 : number;

                    static custom(reader : BitstreamReader) {
                        let element = new CustomElement();
                        element.readGroup(reader, '*').next();
                        return element;
                    }
                }
        
                let buf = Buffer.from([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
                let reader : BitstreamReader;
                let element : CustomElement;

                reader = new BitstreamReader();
                reader.addBuffer(buf);
                element = CustomElement.custom(reader);
                assert.strictEqual(element.a1, 0);
                assert.strictEqual(element.a2, 2);
                assert.strictEqual(element.a3, 4);
                assert.strictEqual(element.a4, 6);
                assert.strictEqual(element.b1, 1);
                assert.strictEqual(element.b2, 3);
                assert.strictEqual(element.b3, 5);
                assert.strictEqual(element.b4, 7);
            });
            it('supports "own" grouping', () => {
                class CustomElement extends BitstreamElement {
                    @Field(8) a : number;
                }

                class CustomElement2 extends CustomElement {
                    @Field(8) b : number;

                    static own(reader : BitstreamReader) {
                        let element = new CustomElement2();
                        element.readGroup(reader, '$*').next();
                        return element;
                    }
                }
        
                let buf = Buffer.from([ 33, 1, 2, 3, 4, 5, 6, 7 ]);
                let reader : BitstreamReader;
                let element : CustomElement2;

                reader = new BitstreamReader();
                reader.addBuffer(buf);
                element = CustomElement2.own(reader);

                assert.strictEqual(element.a, undefined);
                assert.strictEqual(element.b, 33);
            })
        });
        describe('readOwn()', () => {
            it('reads all fields', () => {
                class CustomElement extends BitstreamElement {
                    @Field(8, { group: 'a' }) a1 : number;
                    @Field(8, { group: 'b' }) b1 : number;
                    @Field(8, { group: 'a' }) a2 : number;
                    @Field(8, { group: 'b' }) b2 : number;
                    @Field(8, { group: 'a' }) a3 : number;
                    @Field(8, { group: 'b' }) b3 : number;
                    @Field(8, { group: 'a' }) a4 : number;
                    @Field(8, { group: 'b' }) b4 : number;

                    static custom(reader : BitstreamReader) {
                        let element = new CustomElement();
                        element.readOwn(reader).next();
                        return element;
                    }
                }
        
                let buf = Buffer.from([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
                let reader : BitstreamReader;
                let element : CustomElement;

                reader = new BitstreamReader();
                reader.addBuffer(buf);
                element = CustomElement.custom(reader);
                assert.strictEqual(element.a1, 0);
                assert.strictEqual(element.a2, 2);
                assert.strictEqual(element.a3, 4);
                assert.strictEqual(element.a4, 6);
                assert.strictEqual(element.b1, 1);
                assert.strictEqual(element.b2, 3);
                assert.strictEqual(element.b3, 5);
                assert.strictEqual(element.b4, 7);
            });
        });
        it('supports allowing exhaustion when deserializing', () => {
            class ContainerElement extends BitstreamElement {
                @Field(8) byte : number;
            }

            class Container extends BitstreamElement {
                @Field(0, { array: { type: ContainerElement, hasMore: i => true }})
                elements : ContainerElement[];
            }

            let value = Container.deserialize(Buffer.from([0,1,2,3,4,5,6,7]), { allowExhaustion: true });

            assert.strictEqual(value.elements.length, 8);
            for (let i = 0, max = 8; i < max; ++i)
                assert.strictEqual(value.elements[i].byte, i, `value at index ${i} should be ${i}`);
        });
    });
})