import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import WebSocket from "ws";

const serverPath = fileURLToPath(new URL("../server.mjs", import.meta.url));

async function getAvailablePort() {
    const probe = createServer();
    await new Promise((resolve, reject) => {
        probe.once("error", reject);
        probe.listen(0, "127.0.0.1", resolve);
    });
    const { port } = probe.address();
    await new Promise((resolve, reject) => {
        probe.close((error) => error ? reject(error) : resolve());
    });
    return port;
}

function createMessageReader(socket) {
    const messages = [];
    const waiters = [];
    let failure = null;

    socket.on("message", (data) => {
        const waiter = waiters.shift();
        if (waiter) waiter.resolve(data.toString());
        else messages.push(data.toString());
    });
    socket.on("error", (error) => {
        failure = error;
        for (const waiter of waiters.splice(0)) waiter.reject(error);
    });

    return () => {
        if (messages.length) return Promise.resolve(messages.shift());
        if (failure) return Promise.reject(failure);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Timed out waiting for WebSocket message"));
            }, 3000);
            waiters.push({
                resolve: (message) => {
                    clearTimeout(timeout);
                    resolve(message);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
            });
        });
    };
}

test("server exposes HTTP health endpoints and an authenticated XMPP WebSocket", async (t) => {
    const port = await getAvailablePort();
    const child = spawn(process.execPath, [serverPath], {
        env: {
            ...process.env,
            HOST: "127.0.0.1",
            PORT: String(port),
            MQTT_TOPIC: "test/topic",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => output += chunk);
    child.stderr.setEncoding("utf8").on("data", (chunk) => output += chunk);

    t.after(async () => {
        if (child.exitCode === null) {
            const exited = once(child, "exit");
            child.kill("SIGTERM");
            await exited;
        }
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 5000;
    let ready = false;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Server exited before becoming ready:\n${output}`);
        }
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.ok) {
                ready = true;
                break;
            }
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
    }
    assert.equal(ready, true, `Server did not become ready:\n${output}`);

    const rootResponse = await fetch(baseUrl);
    assert.equal(rootResponse.status, 200);
    assert.equal(await rootResponse.text(), "HTTP OK\n");

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal(await healthResponse.text(), "OK");

    const missingResponse = await fetch(`${baseUrl}/missing`);
    assert.equal(missingResponse.status, 404);
    assert.equal(await missingResponse.text(), "Not Found");

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, "xmpp");
    await once(socket, "open");
    const nextMessage = createMessageReader(socket);
    try {
        let response = nextMessage();
        socket.send('<open xmlns="urn:ietf:params:xml:ns:xmpp-framing"/>');
        assert.match(await response, /<open .*from="osp\.dummy"/);

        response = nextMessage();
        assert.match(await response, /mechanism>PLAIN<\/mechanism>/);

        response = nextMessage();
        socket.send(`<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">${Buffer.from("\0moblin\0test-password").toString("base64")}</auth>`);
        assert.match(await response, /<success /);

        response = nextMessage();
        socket.send('<open xmlns="urn:ietf:params:xml:ns:xmpp-framing"/>');
        assert.match(await response, /<open .*version="1\.0"/);

        response = nextMessage();
        assert.match(await response, /<stream:features>/);

        response = nextMessage();
        socket.send('<iq id="bind-1" type="set"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"/></iq>');
        response = await response;
        assert.match(response, /type="result" id="bind-1"/);
        assert.match(response, /<jid>moblin@osp\.dummy\/RESOURCE<\/jid>/);
    } finally {
        if (socket.readyState === WebSocket.OPEN) {
            const closed = once(socket, "close");
            socket.close();
            await closed;
        }
    }
});