# FocusFlow

> 集中と休息を、いいリズムで。

ポモドーロタイマー、作業記録、休憩リマインダー、通知抑制、会議前のデバイスチェックをひとつにまとめた、PC・iPhone向けの作業管理Webアプリです。

[▶ Live Demo — FocusFlowを試す](https://focusflow.0404taichi8.workers.dev/)

![FocusFlow preview](public/og.png)

## Overview

集中を支援するツールは、タイマー・タスク管理・実績記録などが別々のアプリに分かれがちです。FocusFlowでは「仕事を選ぶ」「集中する」「休む」「振り返る」「会議へ移る」という一日の流れを、ひとつの画面で完結させました。

情報量の多いダッシュボードでありながら、いま必要な操作が自然に目に入ることを重視しています。集中タイマーを画面の中心に置き、タスクやコンディション、次の会議をその周囲に配置しました。

## Features

### Focus Timer

- 15・25・45・60分のプリセットに対応
- 集中／休憩モードの切り替え
- 一時停止、リセット、5分延長
- 集中するタスクをセッションごとに選択
- セッション終了後、自動的に休憩へ移行

### Task Management

- 今日のタスクを追加・完了
- タスクごとの予定ポモドーロ数を表示
- タイマーとタスクを直接連携
- タスクと集中回数をブラウザへ自動保存

### Smart Break

- ページ内の操作状況から連続作業時間を推定
- 適切なタイミングで休憩カードを強調
- 5分休憩をその場で開始

### Notification Digest

- 集中時間中のアプリ内通知を一時保留
- 終了後にまとめて確認できる通知キュー
- 集中開始と通知抑制を連動

### Meeting Check

- マイクとカメラのアクセス確認
- スピーカーのテスト音再生
- 通信応答速度の確認
- 各項目を「OK／要確認」で一覧表示

### Insights

- 1週間の集中時間を棒グラフで可視化
- 今日の集中時間、完了タスク、集中スコアを表示
- PCではサイドバー、iPhoneでは下部ナビゲーションへ自動変更
- ホーム画面へ追加できるPWA設定

## Design Approach

### 集中状態だけが際立つ配色

通常時はオフホワイトとセージグリーンで刺激を抑え、開始ボタンや進捗など「いま行動する場所」にだけライムカラーを使用しました。長時間開いたままでも疲れにくく、集中状態が視覚的に伝わる設計です。

### 一画面で仕事の流れをつなぐ

タイマーを単独機能として扱わず、タスク選択、通知抑制、休憩、実績記録へ連続する体験として設計しました。機能間の移動を減らし、集中が途切れる要因を抑えています。

### モバイルでも迷わない操作性

タップ領域、カードの表示順、下部ナビゲーション、セーフエリアをiPhone向けに調整しています。画面幅が変わっても重要な機能の優先順位が崩れないレスポンシブ設計です。

## Technical Highlights

- **TypeScript / React 19** — 状態管理とインタラクション
- **Next.js 16 / vinext / Vite** — アプリケーション構成とビルド
- **CSS** — レスポンシブレイアウト、モーション、タイマー表現
- **LocalStorage** — タスクと集中実績の端末内保存
- **MediaDevices API** — マイク・カメラの会議前確認
- **Web Audio API** — スピーカーのテスト音
- **Web App Manifest** — iPhone・PCのホーム画面追加に対応
- **Cloudflare Workers compatible output** — エッジ環境へデプロイ

グラフやタイマー表示は外部UIライブラリに依存せず、ReactとCSSで実装しています。

## Browser Constraints

Webブラウザのセキュリティ制約により、OS全体の操作履歴や通知を直接制御することはできません。そのため、本作品では休憩判定をページ内の操作状況、通知抑制をアプリ内通知キューとして実装しています。マイク・カメラチェックでは、初回のみブラウザの利用許可が必要です。取得した映像や音声は保存・送信しません。

## Getting Started

Node.js 22.13以降が必要です。

```bash
npm install
npm run dev
```

本番ビルドの確認：

```bash
npm run build
```

## Deploy with GitHub and Cloudflare

このリポジトリはCloudflare Workersへデプロイできます。データベースは使用せず、タスク・実績・表示設定はアクセスした人それぞれのブラウザ内に保存されます。そのため、公開URLを誰でも利用できても、利用者同士のデータが混ざることはありません。

### CloudflareのGit連携を使う場合（推奨）

1. GitHubへこのプロジェクトをpush
2. Cloudflare Dashboardの **Workers & Pages** からGitHubリポジトリを接続
3. Build commandを `npm run build` に設定
4. Deploy commandを `npm run deploy -- --skip-build` に設定
5. Production branchを `main` に設定

以降は`main`へのpushごとに、自動でビルドと公開が行われます。

### GitHub Actionsを使う場合

同梱の`.github/workflows/deploy-cloudflare.yml`を利用できます。GitHubリポジトリのActions secretsに次の2項目を登録してください。

- `CLOUDFLARE_API_TOKEN` — Cloudflare Workersの編集権限を持つAPIトークン
- `CLOUDFLARE_ACCOUNT_ID` — 公開先CloudflareアカウントのID

設定後、`main`へのpushまたはActions画面の手動実行でデプロイされます。

## Project Structure

```text
app/
├── focus-dashboard.tsx  # タイマー、タスク、各種チェックのUIとロジック
├── globals.css          # デザインシステムとレスポンシブスタイル
├── layout.tsx           # メタデータ、PWA、SNS共有設定
└── page.tsx             # エントリーページ

public/
├── manifest.webmanifest # ホーム画面追加設定
├── offline.html         # オフライン時のフォールバック画面
├── sw.js                # PWA用Service Worker
└── og.png               # SNS共有用ビジュアル
```

## Future Improvements

- アカウント単位のクラウド同期
- カレンダーと実際の会議予定の連携
- OSネイティブ版でのシステム通知抑制
- 日・週・月単位の詳細分析とCSV出力
- 集中時間や休憩間隔のパーソナライズ

---

**FocusFlow** — 仕事量を増やすのではなく、集中と休息のリズムを整えるためのプロダクトです。
