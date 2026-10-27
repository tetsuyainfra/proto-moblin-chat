export let msg1 = `<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" from="osp.dummy" id="jpnkn-chat" version="1.0"/>`;

export let msg2 = `
<stream:features xmlns:stream="http://etherx.jabber.org/streams">
   <mechanisms xmlns="urn:ietf:params:xml:ns:xmpp-sasl">
       <mechanism>CHALLANGE</mechanism>
       <mechanism>PLAIN</mechanism>
   </mechanisms>
</stream:features>
`;