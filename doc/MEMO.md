
XMPP
- XMPP Core仕様
  - https://tex2e.github.io/rfc-translater/html/rfc6120.html
- XMPP over WebSocket (RFC 7395)
  https://tex2e.github.io/rfc-translater/html/rfc7395.html

OpenStreamingPlatform(以下 OSP)
- Backendにejabberdを使っている
  - 認証方式にはexternalとanonymousを使っている
    - https://docs.ejabberd.im/admin/configuration/authentication/#internal
- external - extaus_program を利用して認証を行う
    - https://github.com/Open-Streaming-Platform/open-streaming-platform/blob/c80df071906c50224e4579625d93438450841d39/installs/docker/Ejabberd/docker-files.d/auth_osp.py
        - 標準入力にCMD:...が与えられて, 
          認証結果を標準出力に書き込む。
          認証に成功した場合は "\x00\x02\x00\x01" を返し、失敗した場合は "\x00\x02\x00\x00" を返す
          CMD=authの場合、USER, SERVER, PASSWORDが続いて与えられ、それを利用してOSPへリクエストを送り認証している。
          CMD=isuserの場合、USER, SERVERが続いて与えられ、それを利用してOSPへリクエストを送りユーザーの存在を確認している。
        



Moblinの実装
- Chatのみ実装されている(配信操作などは未実装、カスタムURLでrtmpを送って配信する)
- Chatはここで実装されている
  https://github.com/eerimoq/moblin/blob/056bd01b53bb5a6003629c21944c12b23ebc8723/Moblin/StreamingPlatforms/OpenStreamingPlatform/OpenStreamingPlatformChat.swift 

  - Authメッセージはここで送られている
  https://github.com/eerimoq/moblin/blob/056bd01b53bb5a6003629c21944c12b23ebc8723/Moblin/StreamingPlatforms/OpenStreamingPlatform/OpenStreamingPlatformChat.swift#L313
    - 認証情報はこんな感じで送られる（本来は改行無し）
      ```
       <auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">
          AG1vYmxpbgBWeFdNRDFyZ0Q3MHp1ZzNLNG43K3YrTjJsTG5yODYwYXo5cEVGVHdnUW80bW1UNGlxSWZHNTZPWTJkMnhiQjhnbWZFdGFkOVhqRGtKakJMNEhtMGJwdz09
       </auth>
      ```
      要素のエンコーディングはBase64で行われていて次の通り
      https://github.com/eerimoq/moblin/blob/056bd01b53bb5a6003629c21944c12b23ebc8723/Moblin/StreamingPlatforms/OpenStreamingPlatform/OpenStreamingPlatformChat.swift#L337
      ```[NULL][USERNAME][NULL][PASSWORD]```
      どうもusername/passwordはmoblin/RANDOMで生成されている模様

      https://github.com/eerimoq/moblin/blob/056bd01b53bb5a6003629c21944c12b23ebc8723/Moblin/StreamingPlatforms/OpenStreamingPlatform/OpenStreamingPlatformChat.swift#L116
      - つまりID/パスは意味がない・・・
    - 成功すると
