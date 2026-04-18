# Firebase 設定步驟

這個專案現在已支援：

- Google 登入
- Firebase Authentication
- Cloud Firestore 雲端同步
- 未登入時的本機模式

正式網址：

```text
https://ncusspm25.github.io/record_money/
```

## 你要做的事情

### 1. 建立 Firebase 專案

到 Firebase Console：

```text
https://console.firebase.google.com/
```

建立一個新專案，或使用你現有的專案。

## 2. 新增 Web App

在 Firebase 專案首頁：

1. 點 `新增應用程式`
2. 選 `Web`
3. 註冊 Web App
4. 取得 Firebase config

你會看到一段像這樣的設定：

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};
```

把它貼到 [firebase-config.js](./firebase-config.js) 裡，取代目前的 placeholder。

## 3. 啟用 Google 登入

在 Firebase Console：

1. 進 `Authentication`
2. 進 `Sign-in method`
3. 啟用 `Google`
4. 按 `Save`

## 4. 加入授權網域

同樣在 `Authentication` 相關設定裡，確認 `Authorized domains` 有：

```text
ncusspm25.github.io
```

如果沒有，請加上。

如果你平常也會本機測試，可以順便保留：

```text
localhost
127.0.0.1
```

## 5. 建立 Firestore Database

在 Firebase Console：

1. 進 `Firestore Database`
2. 點 `Create database`
3. 可先選 `Production mode`
4. 選一個離你近的 region

## 6. 設定 Firestore Security Rules

把 [firestore.rules](./firestore.rules) 的內容貼到 Firestore Rules：

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/transactions/{transactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

這組規則的意思是：

- 必須先登入
- 使用者只能讀寫自己的資料
- 其他文件路徑全部拒絕

## 7. 推到 GitHub Pages

設定好 [firebase-config.js](./firebase-config.js) 後，重新提交並推上 GitHub：

```powershell
cd "d:\AI_dev\記帳"
git add .
git commit -m "Add Firebase auth and Firestore sync"
git push
```

幾分鐘後重新開：

```text
https://ncusspm25.github.io/record_money/
```

## 8. 第一次使用

1. 手機打開網站
2. 按 `Google 登入`
3. 登入你的 Google 帳號
4. 成功後畫面會切成 `雲端模式`
5. 之後新增、編輯、刪除都會同步到 Firestore

## 本機資料怎麼處理

如果你之前已經在同一台裝置用本機模式記過帳：

- 登入後畫面會出現 `把本機資料同步到雲端`
- 按下去就會把目前這台裝置的本機資料寫到你的 Firestore

## 很重要的觀念

Firebase config 會放在前端，這是正常的，不代表資料公開。

真正保護你資料的是：

- Firebase Authentication
- Firestore Security Rules

只要 Google 登入與 Rules 設好，就算網站網址是公開的，別人也不能直接看到你的個人資料。
