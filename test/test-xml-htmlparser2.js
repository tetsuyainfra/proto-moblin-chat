import { test } from "node:test";
import * as htmlparser2 from "htmlparser2";
import { msg1, msg2 } from "./xml-string.js";

function parse(xml) {
    // Node探索
    // const events = [];
    // const parser = new Parser(
    //     {
    //         onopentag: (name, attributes) => events.push({ type: "open", name, attributes }),
    //         ontext: (text) => {
    //             if (text.trim()) events.push({ type: "text", text });
    //         },
    //         // onclosetag: (name) => events.push({ type: "close", name }),
    //         onerror: (err) => {
    //             throw err;
    //         },
    //     },
    //     { xmlMode: true },
    // );
    // parser.write(xml);
    // parser.end();
    // return events;

    // DOM化
    const dom = htmlparser2.parseDocument(xml, {
        xmlMode: true,
        // withStartIndices: true
        lowerCaseTags: true,
        lowerCaseAttributeNames: true
    });

    return dom;
}

test("test parsing of msg1", async (t) => {
    console.log(msg1);
    console.dir(parse(msg1));
});

test("test parsing of msg2", async (t) => {
    console.log(msg2);
    console.dir(parse(msg2));
});
