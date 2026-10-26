import parse from "@xmpp/xml/lib/parse.js";

let msg1 = `<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" from="osp.dummy" id="jpnkn-chat" version="1.0"/>`;
console.log(msg1);
console.log(parse(msg1));
console.log("--------------------------------------------------------------------------------");

let msg2 = `
<stream:features xmlns:stream="http://etherx.jabber.org/streams">
   <mechanisms xmlns="urn:ietf:params:xml:ns:xmpp-sasl">
       <mechanism>PLAIN</mechanism>
   </mechanisms>
</stream:features>
`;
console.log(msg2);
console.log(parse(msg2.trimStart()));