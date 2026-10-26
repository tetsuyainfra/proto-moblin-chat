# iPhone用アプリ Moblin向けチャットサーバー

Moblinの「Open Streaming Platform」チャット接続と互換性のある、XMPP over WebSocketサーバーです。チャット投稿APIへメッセージを送信すると、該当ルームに接続しているMoblinへ配信します。

## 参考文献

## 起動

Node.js 26以降が必要です。


## テスト

```sh
npm test

# クライアントで手動で試す場合
echo <> |  \
	curl --verbose --no-buffer -T - -H 'sec-websocket-protocol: xmpp' ws://localhost:5443/ws
```
