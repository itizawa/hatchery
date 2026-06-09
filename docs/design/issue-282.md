# 設計書: チャンネルの新着メッセージをクライアント側で逐次表示（ドリップ） (#282)

## 1. 目的 / 背景

1回の生成で増えた複数メッセージを、一括ではなく時間差＋タイピングインジケータ付きで1件ずつタイムラインに表示することで、AI 社員の会話が「いま立ち上がっている」観戦感を出す。サーバ・生成・API は変更しない（client 内に閉じる）。

## 2. スコープ（やること / やらないこと）

### やること
- `ChannelView` で新着メッセージをドリップ表示（時間差・1件ずつ）
- 各メッセージ表示直前のタイピングインジケータ（「●●●」アニメーション）
- 初回ロード（過去ログ）は即時表示
- `prefers-reduced-motion` 時はドリップ無効化・即時表示
- 表示制御ロジックを `useDripMessages` hook に分離

### やらないこと
- サーバ・生成・API・OpenAPI スキーマ変更
- スレッドグルーピング（#250）
- SSE/WebSocket によるリアルタイムストリーミング
- 効果音

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. 新規に増えたメッセージ群は時間差で1件ずつ順に表示（ドリップ）。表示順は時系列を維持。
2. 各メッセージ表示直前に発言者のタイピングインジケータを短時間表示してから本文に切り替える。
3. 初回ロード時の既存メッセージは即時表示（ドリップしない）。リロードで過去ログが毎回ドリップ再生されない。
4. ドリップ間隔・タイピング表示時間は定数（`DRIP_TYPING_MS` / `DRIP_INTERVAL_MS`）で調整可能。`prefers-reduced-motion` 時は即時表示。
5. 表示制御ロジックを `useDripMessages` hook に分離しテスト可能にする。RTL + fake timers で検証。
6. サーバ・生成・API・OpenAPI スキーマは変更しない。追加 API コールなし。
7. `pnpm turbo run build test lint` が緑。client → common の一方向 import 境界を維持。

## 4. 設計方針

### アーキテクチャ

```
ChannelScene
  └─ ChannelView (presentational + drip state)
       └─ useDripMessages (hook: 新着検出・キュー管理・タイマー)
```

`ChannelView` は `useMediaQuery` で `prefers-reduced-motion` を検出し、`useDripMessages` に渡す。`useDripMessages` はタイマーを管理し、`{ visibleMessages, typingEmployeeId }` を返す。

### useDripMessages の状態機械

```
初回マウント時:
  seenIds ← allMessages の全 ID
  visibleMessages ← allMessages (全件即時表示)
  queue ← []

allMessages 変化時:
  newMsgs ← allMessages から seenIds にない ID だけ抽出
  seenIds.add(newMsgs の ID)
  if prefersReducedMotion: visibleMessages.push(...newMsgs); return
  queue.push(...newMsgs)
  if !isProcessing: processNext()

processNext():
  if queue.empty: isProcessing=false; return
  isProcessing=true
  next ← queue[0]
  typingEmployeeId ← next.createdEmployeeId
  setTimeout(DRIP_TYPING_MS) → {
    typingEmployeeId ← null
    visibleMessages.push(next)
    queue.shift()
    setTimeout(DRIP_INTERVAL_MS) → processNext()
  }
```

### 定数

| 定数 | 値 | 意味 |
|------|-----|------|
| `DRIP_TYPING_MS` | 700ms | タイピングインジケータ表示時間 |
| `DRIP_INTERVAL_MS` | 400ms | 次メッセージ表示開始までの待機時間 |

### タイピングインジケータ

`TypingIndicator` コンポーネント（`ChannelView.tsx` 内にインライン実装）：
- 発言者名 + 「●●●」アニメーション（CSS keyframes で点滅）
- `aria-label="入力中"` で支援技術に通知

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|----------|----------|
| `client/src/hooks/useDripMessages.ts` | 新規作成 |
| `client/src/components/ChannelView.tsx` | `useDripMessages` を使用するよう変更 |
| `client/src/components/ChannelView.test.tsx` | ドリップ系テストを追加 |

サーバ・common・OpenAPI スキーマは変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

### `ChannelView.test.tsx` に追加するテスト

**ドリップ表示（新着検出）**
- 初回ロード時の全メッセージが即時表示される（fake timer 不要）
- 新着メッセージが追加された直後は visible に含まれない（typing 中）
- `DRIP_TYPING_MS` 経過後に最初の新着メッセージが表示される
- 複数の新着が順番に（1件ずつ）表示される
- 初回ロードのメッセージはリロード後も即時表示（再ドリップしない）

**reduced-motion**
- `prefers-reduced-motion` 環境では新着が即時表示される

**タイピングインジケータ**
- 新着待ち中にタイピングインジケータが表示される
- メッセージ表示後にタイピングインジケータが消える

## 7. リスク・未決事項

- **React StrictMode での二重起動**: `useEffect` が開発時に2回実行されうる。`seenIds` ref の初期化は `useState` lazy initializer で行い冪等性を確保する。
- **キューへの同時追加**: 複数の新着がまとまって来た場合、`isProcessing` フラグでキュー処理の多重起動を防ぐ。
- **アンマウント時のリーク**: `timerId` ref に最後の `setTimeout` ID を保持し、クリーンアップ時に `clearTimeout` する。
