# ADR-0021: ワーカーアバター画像の GCS 保存方式

- ステータス: Accepted
- 日付: 2026-06-10
- 関連 Issue: #204

## コンテキスト（背景）

Issue #204 で admin がワーカー（旧 Employee）のアバター画像をアップロードできるようにする。server は Cloud Run（ステートレス・ADR-0011）のため、アップロードされたファイルをローカルファイルシステムに保存できない。外部オブジェクトストレージが必須であり、本 ADR でその選定と保存方式を決める。

要件:
- ワーカーのアバターは **admin（運営）のみ**が管理する（ADR-0018・ADR-0020）
- server は Cloud Run（ステートレス・ADR-0011）のため、永続化には外部オブジェクトストレージが必須
- Cloud Run は GCP 上で動作し、**Workload Identity Federation**（ADR-0011）で認証済みのため、GCP サービスとの連携が最もコストが低い
- ローカル開発では GCS の認証が取れないため代替手段が必要

## 決定

**Google Cloud Storage（GCS）をアバター画像の保存先として採用し、サーバ経由アップロード方式を使う。**

具体的な方針:

- **保存方式**: `client → server（multipart/form-data）→ GCS`
  - クライアントから server へ multipart でアップロードし、server が GCS へ書き込む
  - 署名付き URL（クライアント直接アップロード）は採用しない
- **認証**: Cloud Run の Workload Identity Federation（ADR-0011）を踏襲。サービスアカウントキーファイルを置かない。ローカル開発では `GCS_BUCKET_NAME` 未設定時に InMemory モックに自動切り替え
- **命名規約**: `workers/{employeeId}/{uuidv4}.{ext}`（`ext` は MIME から解決: png/jpeg/webp/gif）
  - #457 でこの GCS 基盤をコミュニティ画像に流用。命名規約に `communities/{communityId}/{icon|cover}/{uuidv4}.{ext}` を追加（同一の MIME / サイズ検証・admin 権限を踏襲）。
- **読み取り方式**: bucket に `allUsers` の `roles/storage.objectViewer` を付与し、オブジェクト URL を直接公開。アバターは公開情報のため署名付き URL を使わない
- **公開 URL**: `https://storage.googleapis.com/{BUCKET_NAME}/workers/{employeeId}/{uuid}.{ext}`
- **権限**: API エンドポイントは admin ロール必須（member は 403 / 未認証は 401・ADR-0020）
- **ファイル検証（server 側）**:
  - MIME: `image/png`, `image/jpeg`, `image/webp`, `image/gif` のみ許可
  - サイズ: 5MB 以下
  - 違反は 400 で返す
- **環境変数**: `GCS_BUCKET_NAME`（本番必須。未設定＝ローカルはモック動作）

## 理由

- **GCS 採用**: Cloud Run 側の Workload Identity Federation が GCP サービスへのアクセスをカバーしており、追加のサービスアカウントキー管理が不要。プロジェクト全体で GCP を使うため一貫性がある
- **サーバ経由アップロード**: 署名付き URL 方式では、クライアントが GCS に直接アクセスするため CORS 設定が複雑になり、server での MIME/サイズ検証も難しくなる。サーバ経由ならば server 側で完結して検証でき、Cloud Run の IAM を使い回せる
- **allUsers 公開**: アバターは公衆に公開する画像であり、表示のたびに署名付き URL を再生成する複雑さは不要

## 検討した代替案

- **署名付き URL でクライアント直アップロード**: client から GCS に直接 PUT する方式。CORS 設定・TTL 管理・server での事前検証が困難。採用しない
- **Cloudflare R2**: CDN との親和性は高いが、Cloud Run（GCP）とは別プロバイダになり認証連携が複雑。現状の GCP 集約を崩すデメリットがある。採用しない
- **AWS S3**: GCP 使用中のプロジェクトに別クラウドを導入するのは管理コストが上がる。採用しない

## 影響（結果）

- 良い影響:
  - Cloud Run の Workload Identity を流用し、キー管理なしで GCS に書き込める
  - server 側で MIME/サイズ検証を完結できる
  - 公開 URL は長命（署名切れなし）
- トレードオフ / 注意点:
  - server がリクエストを代理するため大きなファイル（5MB 制限以内）は server のメモリを一時消費する
  - GCS バケットの allUsers 公開設定が必要（インフラセットアップ作業）
  - ローカル開発は InMemory モック（実際の GCS への書き込みは dev/prod 環境のみ）
- フォローアップが必要なこと:
  - GCS バケット作成・IAM 設定（`docs/deploy/setup.md` へ追記）
  - 画像の圧縮・リサイズは別 Issue（スコープ外）
  - 観察者（User）自身のアバターアップロードは本 Issue の対象外
