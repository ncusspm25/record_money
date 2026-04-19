# 元寶記帳

一個不用上架、可在手機上使用的個人記帳 PWA，現在同時支援：

- 本機模式：資料存在瀏覽器 `localStorage`
- 雲端模式：Google 登入後同步到 Firebase Firestore

## 主要功能

- 收入 / 支出記錄
- 月份摘要與支出分類圖
- 篩選、編輯、刪除
- 匯出 JSON / CSV、匯入 JSON
- 支援安裝到主畫面與離線使用
- Google 登入 + Firestore 雲端同步

## 正式網址

```text
https://ncusspm25.github.io/record_money/
```

## 文件

- [HOW_TO_USE.md](./HOW_TO_USE.md)：手機上怎麼使用
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)：Google 登入與 Firestore 設定步驟
- [firestore.rules](./firestore.rules)：建議的 Firestore 安全規則

## 本機開發

```powershell
cd "d:\AI_dev\記帳"
py -3 -m http.server 4173
```

然後開：

```text
http://127.0.0.1:4173
```

## Firebase 設定提醒

正式啟用 Google 登入前，請先完成：

1. 編輯 [firebase-config.js](./firebase-config.js)
2. 在 Firebase Console 啟用 Google provider
3. 建立 Firestore Database
4. 套用 [firestore.rules](./firestore.rules)
5. 將 `ncusspm25.github.io` 加入 Authentication 授權網域

## 備份提醒

不管你用本機模式還是 Firestore，同樣建議定期匯出 JSON 備份。
