import { WebSocketServer } from "ws";
import http from "node:http";
import parse from "@xmpp/xml/lib/parse.js";
import jid from "@xmpp/jid";
import mqtt from "mqtt";
// const { XMLParser } = require("fast-xml-parser");


const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 5443);
const wsPath = process.env.WS_PATH || '/ws';

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC = process.env.MQTT_TOPIC.split(",");

const sessions = new WeakMap();

// WebSocket server setup
const wsServer = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => protocols.has('xmpp') ? 'xmpp' : false,
});

const HANDSHAKE = Symbol("HANDSHAKE");
const AUTH = Symbol("AUTH");
const CONNECTED = Symbol("CONNECTED");
const FAILED = Symbol("FAILED");

// チャットメッセージを送信する関数
// socket: WebSocket接続
// from: 送信元JID (例: user@example.com/hoge -> moblinではhogeがユーザ名として表示される)
// to: 送信先JID
// type: メッセージタイプ (chatなど)
// id: メッセージID
// body: メッセージ本文
function sendMessage(socket, from, to, type, id, body) {
    socket.send(
        `<message xmlns="jabber:client" from="${from}" to="${to}" type="${type}" id="${id}">
            <body>${body}</body>
        </message>`
    );
}

function on_iq_recieved(msg, session, socket, remote) {
    let results = [];
    let id = msg.attrs?.id || '';
    for (let child of msg.getChildElements()) {
        switch (child.name) {
            case 'bind':
                if (!session.jid) {
                    session.jid = jid(`${session.username}@osp.dummy/RESOURCE`);
                }
                results.push(`
                        <bind>
                            <jid>${session.jid.toString()}</jid>
                        </bind>`);
                break;
            case 'session':
                break;
            default:
                console.log(`${remote} Unknown child element: ${child.name}`);
                break;
        }
    }

    socket.send(
        `<iq xmlns="jabber:client" type="result" id="${id}">
            ${results.join("\n")}
         </iq>`
    );
    console.log(`${remote} Sent IQ result for jid ${session.jid.toString()}`);
}

function on_presence_received(msg, session, socket, remote) {
    console.log(`${remote} Received presence message:`, msg.toString({ pretty: true }));
    // タスクを開始する
    socket.send(`<presence xmlns="jabber:client"/>`);

    if (!session.sendHandle) {
        console.log(`${remote} Creating MQTT client`);
        const client = mqtt.connect(MQTT_URL, {
            username: MQTT_USERNAME,
            password: MQTT_PASSWORD,
        });

        client.on("connect", () => {
            console.log(`${remote} Connected to MQTT broker`);
            client.subscribe(MQTT_TOPIC, (err) => {
                if (err) console.error(`${remote} subscribe error:`, err);
                else console.log(`${remote} subscribed: ${MQTT_TOPIC}`);
            });
        });

        client.on("message", (topic, payload) => {
            // 受信するメッセージ
            // {"body":"DEV名無しさん<><>2026/10/26(月) 14:58:10.20<>デバッグ用すれ<>デバッグ用/1","no":"1","bbsid":"tetsuyainfra","threadkey":"1792994290"}
            console.log(`${remote} Received MQTT message:`, payload.toString());
            let res = JSON.parse(payload.toString());
            let [name, mail , date_id, body, thread_name] = (res.body || "").split("<>");
            let bbsid = res["bbsid"];
            let thread_key = res["threadkey"];
            let no = res["no"];

            sendMessage(socket, `system@example.com/${no}`, session.jid.toString(), "chat", `${bbsid}_${thread_key}_${no}`, `${body}`);
        });
        session.mqttClient = client;

        sendMessage(socket, `system@example.com/system`, session.jid.toString(), "chat", `msg0`, `${session.username}さん！こんにちは`);
        let count = 1;
        session.sendHandle = setInterval(() => {
            sendMessage(socket, `system@example.com/id${count}`, session.jid.toString(), "chat", `msg${count}`, `やあ！${count}`);
            count++;
        }, 10000); // 10秒ごとにプレゼンスを送信
    }
}


// handler for processing messages after authentication
function handleMessage(msg, session, socket, remote) {
    switch (msg.name) {
        case 'open':
            //  <open xmlns='urn:ietf:params:xml:ns:xmpp-framing' from='chat.connectycube.com' id='e4b1d1be-45a9-4d1a-aea1-a5d17de4ecae' version='1.0' xml:lang='en' /> // こういうのが本来想定されている
            socket.send(`<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" from="osp.dummy" id="jpnkn-chat" version="1.0"/>`)
            socket.send(`<stream:features>
                            <bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"/>
                            <session xmlns="urn:ietf:params:xml:ns:xmpp-session"/>
                         </stream:features>`);
            console.log(`${remote} Sent open and stream:features`);
            break;
        case 'iq':
            // 情報の取得要請
            on_iq_recieved(msg, session, socket, remote);
            break;
        case 'presence':
            // オンライン状態の通知
            on_presence_received(msg, session, socket, remote);
            break;

        default:
            console.log(`${remote} Unknown message type:`, msg.toString({ pretty: true }));
    }
}

wsServer.on("connection", (socket) => {
    let remote = socket._socket.remoteAddress + ':' + socket._socket.remotePort;
    console.log(`${remote} New WebSocket connection`);

    let state = HANDSHAKE;
    let session = {
        jid: null,
        mqttClient: null,
        sendHandle: null,
    };

    socket.on("close", (code) => {
        if (session.mqttClient) {
            session.mqttClient.end(true);
            session.mqttClient = null;
            console.log(`${remote} Disconnected MQTT client`);
        }
        if (session.sendHandle) {
            clearInterval(session.sendHandle);
            session.sendHandle = null;
            console.log(`${remote} Cleared sendHandle`);
        }
        console.log(`${remote} WebSocket connection closed:`, code);
    });

    socket.on("message", (message) => {
        let msg;

        try {
            msg = parse(message);
        } catch (err) {
            console.error("Failed to parse message:", err);
            socket.close(1002, "Failed to parse message");
            return;
        }
        console.log(`${remote} Parsed message:`, msg);

        switch (state) {
            case HANDSHAKE:
                if (msg.name === 'open') {
                    socket.send(`<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" from="osp.dummy" id="jpnkn-chat" version="1.0"/>`);
                    // ほんとうは<mechanism>ANONYMOUS</mechanism>を返していて適当に認証してたりしてね・・・
                    socket.send(`<stream:features xmlns:stream="http://etherx.jabber.org/streams">
                                    <mechanisms xmlns="urn:ietf:params:xml:ns:xmpp-sasl">
                                        <mechanism>PLAIN</mechanism>
                                    </mechanisms>
                                 </stream:features>`);
                    console.log(`${remote} Handshake completed`);
                    state = AUTH;
                } else {
                    console.log(`${remote} Unexpected message in HANDSHAKE state:`, msg);
                    socket.close(1002, "Unexpected message in HANDSHAKE state");
                    state = FAILED;
                }
                break;
            case AUTH:
                if (msg.name === 'auth') {
                    switch (msg.attrs?.mechanism) {
                        case 'PLAIN':
                            let base64Decoded = Buffer.from(msg.text() || '', 'base64').toString('utf-8');
                            let [authzid, authcid, password] = base64Decoded.split('\0');
                            console.log(`${remote} Authentication details:`, { authzid, authcid, password }); // moblinでは authcid がユーザー名、authzidは省略されているっぽい

                            // 認証
                            // moblinという名前ならおｋにする
                            if (authcid === 'moblin') {
                                console.log(`${remote} Authentication successful`);
                                state = CONNECTED;
                                session.username = authcid;
                                socket.send('<success xmlns="urn:ietf:params:xml:ns:xmpp-sasl"/>');
                            } else {
                                console.log(`${remote} Invalid authentication credentials`);
                                socket.send('<failure xmlns="urn:ietf:params:xml:ns:xmpp-sasl"><not-authorized/></failure>');
                                state = FAILED;
                                socket.close(1002, "Invalid authentication credentials");
                            }

                            break;
                        default:
                            console.log(`${remote} Unsupported authentication mechanism:`, msg.attrs?.mechanism);
                            state = FAILED;
                            socket.close(1002, "Unsupported authentication mechanism");
                            return;
                    }
                } else {
                    console.log(`${remote} Unexpected message in AUTH state:`, msg);
                    socket.close(1002, "Unexpected message in AUTH state");
                    state = FAILED;
                }
                break;
            case CONNECTED:
                handleMessage(msg, session, socket, remote);
                break;
            case FAILED:
                // Handle messages in the failed state
                console.log(`${remote} Received message in FAILED state:`, msg);
                socket.close(1002, "Connection failed");
                break;
        }
    });
});


// Http server setup
const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    if (request.method === "GET" && pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("HTTP OK\n");
        return;
    }

    if (pathname === '/health') {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('OK');
        return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not Found');
});

server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    if (pathname !== wsPath || !request.headers['sec-websocket-protocol']?.split(',').map((item) => item.trim()).includes('xmpp')) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }
    wsServer.handleUpgrade(request, socket, head, (websocket) => {
        console.log(`Remote: ${request.socket.remoteAddress}:${request.socket.remotePort}`)
        console.log(`Requested headers: ${JSON.stringify(request.headers, null, 2)}`);
        wsServer.emit('connection', websocket, request);
    });
});


// Server Start
server.listen(port, host, () => {
    console.log(`HTTP server listening on http://${host}:${port}`);
});

