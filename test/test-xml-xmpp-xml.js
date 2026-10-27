import { test } from "node:test";
import parse from "@xmpp/xml/lib/parse.js";
import { msg1, msg2 } from "./xml-string.js";

test("test parsing of msg1", async (t) => {
    console.log(msg1);
    console.log(parse(msg1));
});


test("test parsing of msg2", async (t) => {
    console.log(msg2);
    console.log(parse(msg2.trimStart()));
});