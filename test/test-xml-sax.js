import { test } from "node:test";
import sax from "sax";
import { msg1, msg2 } from "./xml-string.js";

function parse(xml) {
    const parser = sax.parser(true, { xmlns: true });
    // const events = [];
    // parser.onopentag = (node) => events.push({ type: "open", name: node.name, attributes: node.attributes });
    // parser.ontext = (text) => {
    //     if (text.trim()) events.push({ type: "text", text });
    // };
    // parser.onclosetag = (name) => events.push({ type: "close", name });
    // parser.onerror = (err) => {
    //     throw err;
    // };
    // parser.write(xml).close();
    // return events;
    return parser.write(xml).close();
}

test("test parsing of msg1", async (t) => {
    console.log(msg1);
    console.dir(parse(msg1), { depth: null });
});

test("test parsing of msg2", async (t) => {
    console.log(msg2);
    console.dir(parse(msg2), { depth: null });
});
