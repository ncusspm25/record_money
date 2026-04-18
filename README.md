# 口袋記帳

一個不用上架、可以直接在手機瀏覽器打開的個人記帳 PWA。

## 功能

- 收入 / 支出記錄
- 月份摘要與支出分類圖
- 篩選、編輯、刪除
- 資料保存在瀏覽器 `localStorage`
- 匯出 JSON / CSV、匯入 JSON
- 支援安裝到主畫面與離線使用

## 使用方式

### 直接開啟

把整個資料夾放到任何可提供靜態網頁的地方即可，例如：

```powershell
cd d:\AI_dev\記帳
python -m http.server 4173
```

然後用手機開 `http://你的電腦IP:4173`。

### 做成隨時可開的網址

最推薦用 `GitHub Pages`，因為這個專案是純前端靜態網站，不需要後端。

#### 步驟 1：建立 GitHub repository

到 GitHub 建一個新的 repository，例如叫 `ledger-app`。

#### 步驟 2：把專案上傳到 GitHub

在 PowerShell 執行：

```powershell
cd "d:\AI_dev\記帳"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的帳號/ledger-app.git
git push -u origin main
```

如果你的電腦還沒安裝 Git，要先安裝 Git 再執行上面指令。

#### 步驟 3：開啟 GitHub Pages

1. 打開你的 repository
2. 進入 `Settings`
3. 左側找到 `Pages`
4. 在 `Build and deployment`：
   `Source` 選 `Deploy from a branch`
5. `Branch` 選 `main`，資料夾選 `/ (root)`
6. 按 `Save`

幾十秒到幾分鐘後，GitHub 會給你一個網址，通常會像：

```text
https://你的帳號.github.io/ledger-app/
```

之後手機直接打開這個網址就能用。

#### 步驟 4：加到手機主畫面

- Android Chrome：右上角選單 -> `安裝應用程式` 或 `加入主畫面`
- iPhone Safari：分享 -> `加入主畫面`

這樣看起來就會像一個獨立 App，而且因為是 `https`，安裝與離線支援也會比較完整。

### 安裝成像 App 的方式

- Android Chrome: 開網頁後使用「加入主畫面」或按畫面上的「安裝到主畫面」
- iPhone Safari: 分享 -> 加入主畫面

## 注意

- 如果只是用 `http://你的電腦IP:4173` 在手機上開，基本記帳功能通常可以用，但「安裝提示」與離線快取在部分瀏覽器上可能不完整
- 想要最穩定的安裝與離線體驗，建議把這個資料夾放到有 `https` 的靜態空間，例如 GitHub Pages 或 Cloudflare Pages，一樣不用上 App Store

## 備份提醒

資料預設只存在開啟這個 App 的瀏覽器裡，清除瀏覽器資料會一起刪掉，所以建議定期匯出 JSON 備份。
