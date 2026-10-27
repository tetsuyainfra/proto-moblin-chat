import { test } from "node:test";
import { XMLParser } from "fast-xml-parser";
import { msg1, msg2 } from "./xml-string.js";

const parser = new XMLParser({
    ignoreAttributes: false,
    ordered: true
});

test("test parsing of msg1", async (t) => {
    console.log(msg1);
    console.log(parser.parse(msg1));
});


test("test parsing of msg2", async (t) => {
    console.log(msg2);
    console.log(parser.parse(msg2));
});