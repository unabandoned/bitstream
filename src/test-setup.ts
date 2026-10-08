// Loaded with `node --test --import` ahead of every test file. The library reads the
// global `Reflect` metadata API but never imports it; consumers install it.
import "reflect-metadata";

globalThis.BITSTREAM_TRACE = false;
