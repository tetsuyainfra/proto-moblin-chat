# iPhone用アプリ Moblin向けチャットサーバー

iPhone用配信アプリ [Moblin](https://github.com/eerimoq/moblin) の Open Streaming Platform（OSP）チャット接続を試すためのプロトタイプです。XMPPをWebSocket上で受け付け、接続中のクライアントへMQTTメッセージをチャットとして転送します。

## 動作概要

1. Moblinなどのクライアントが `xmpp` サブプロトコルを指定してWebSocketに接続します。
2. サーバーはXMPP SASL PLAIN認証を処理します。現在はユーザー名 `moblin` のみを受け入れ、パスワードは検証しません。
   (moblinのクライアントがこのようにプログラムされています)
3. クライアントがXMPPのpresenceを送ると、その接続用のMQTTクライアントを作成して指定トピックを購読します。
4. MQTTメッセージを受信すると、JSONの内容からチャット本文を取り出し、接続中のクライアントへXMPPメッセージとして送ります。

HTTPの投稿APIは実装していません。メッセージの入力元はMQTTブローカーです。
またMQTTブローカーはJPNKN固定となっています。

## 必要条件

- Node.js 26以降
- MQTTブローカーへの接続情報

## セットアップと起動

```sh
npm install
MQTT_URL='mqtt://localhost:1883' MQTT_USERNAME=FOO MQTT_PASSWORD=FOOPASS MQTT_TOPIC='chat/messages' npm start

# miseを使う場合
# 必要に応じて mise.local.toml を編集してください
cp mise.local.toml-example mise.local.toml
npm start
```

環境変数は次のとおりです。

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | HTTP/WebSocketサーバーの待受ホスト |
| `PORT` | `5443` | HTTP/WebSocketサーバーの待受ポート |
| `WS_PATH` | `/ws` | XMPP WebSocketのパス |
| `MQTT_URL` | なし | MQTTブローカーの接続URL（必須） |
| `MQTT_USERNAME` | なし | MQTTユーザー名 |
| `MQTT_PASSWORD` | なし | MQTTパスワード |
| `MQTT_TOPIC` | なし | 購読するトピック。複数指定する場合はカンマ区切り |

`MQTT_TOPIC` は必須です。起動時にカンマ区切りのトピック一覧として読み込みます。認証情報をシェル履歴やログに残さないよう、実運用環境では環境変数の管理方法に注意してください。

## エンドポイント

| エンドポイント | 説明 |
| --- | --- |
| `GET /` | `HTTP OK` を返す簡易応答 |
| `GET /health` | `OK` を返すヘルスチェック |
| `ws://<host>:<port><WS_PATH>` | `xmpp` サブプロトコルを使うXMPP over WebSocket接続 |

WebSocket接続後、クライアントはXMPPのopen、SASL認証、再open、bindの順でハンドシェイクします。`curl` はこのXMPP over WebSocketの会話を直接行うクライアントではないため、MoblinまたはXMPP over WebSocketに対応したクライアントを使ってください。

## MQTTメッセージ形式

購読トピックには、次のJSON形式のメッセージをpublishします。

```json
{
	"body": "投稿者<>メール欄<>日時<>チャット本文<>スレッド名/番号",
	"no": "123",
	"bbsid": "example",
	"threadkey": "1792994290"
}
```

サーバーは `body` を `<>` で分割し、4番目の値をチャット本文として送信します。メッセージIDは `bbsid_threadkey_no`、送信元JIDのリソースは `no` から生成します。

## テスト

```sh
npm test
```

Node.js標準のテストランナーを使い、HTTPヘルスチェックとXMPP WebSocketの接続・認証・JID bind、およびXMLパーサーの確認を実行します。

## 制約と注意事項

- 試作段階の実装です。認証はユーザー名だけで判定され、パスワード検証やユーザーごとの認可はありません。
- サーバーのログには認証情報が出力されます。信頼できないネットワークや本番環境では使用しないでください。
- MQTT接続はクライアントがpresenceを送った時点で開始します。接続が切れると、そのクライアント用のMQTT接続とテスト用定期メッセージ送信を停止します。
- 配信操作や完全なOSP/XMPP機能は実装していません。

## MEMO

curlでXMPP over WebSocket接続を試す例です。

```
echo <> |  \
	curl --verbose --no-buffer -T - -H 'sec-websocket-protocol: xmpp' ws://localhost:5443/ws
```



## 参考資料

- [RFC 7395: XMPP over WebSocket](https://www.rfc-editor.org/rfc/rfc7395)
- [RFC 6120: XMPP Core](https://www.rfc-editor.org/rfc/rfc6120)
- [Moblin OpenStreamingPlatformChat.swift](https://github.com/eerimoq/moblin/blob/056bd01b53bb5a6003629c21944c12b23ebc8723/Moblin/StreamingPlatforms/OpenStreamingPlatform/OpenStreamingPlatformChat.swift)
