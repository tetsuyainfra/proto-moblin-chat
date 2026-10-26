import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({
    ignoreAttributes: false
});

let msg1 = `<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" from="osp.dummy" id="jpnkn-chat" version="1.0"/>`;
console.log(msg1);
console.log(parser.parse(msg1));
console.log("--------------------------------------------------------------------------------");

let msg2 = `
<stream:features xmlns:stream="http://etherx.jabber.org/streams">
   <mechanisms xmlns="urn:ietf:params:xml:ns:xmpp-sasl">
       <mechanism>PLAIN</mechanism>
   </mechanisms>
</stream:features>
`;
console.log(msg2);
console.log(parser.parse(msg2));