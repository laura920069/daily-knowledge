# 每日知識庫：唯一工作手冊

> 任何維護或自動執行都**只讀這份檔案**，不需要也不應該依賴過去的對話紀錄。修改系統後，同步更新本檔。

## 1. 目的與讀者
- 站長 Laura（laura920069）＋最多 5 位朋友，**主要用手機閱讀**。
- 每天整理四個領域：AI、投資理財（台股／美股／ETF，入門；每週六出美股、台股週報）、健身（增肌、減脂、瑜珈柔軟度）、人資（準備研究所，**程度從零開始**；考科未定，暫以管理學、人資管理、組織行為、勞動法為範圍）。
- 網站：https://laura920069.github.io/daily-knowledge/ ｜ Repo：`laura920069/daily-knowledge`（Public，分支 `main`）

## 2. 系統架構
| 元件 | 角色 |
|---|---|
| Claude 排程「每日知識庫更新」 | 每天 07:31（台北）把任務送進專用工作階段「每日知識庫｜排程執行專用」→ 寫內容 → push main；週六加寫美股／台股週報（第 8-1 節），週日接著做每週整理（第 8-2 節） |
| 專用工作階段「每日知識庫｜排程執行專用」 | claude.ai/code 上已接上本 repo（Default 雲端環境）的工作階段，排程在這裡執行；**不可封存或刪除** |
| GitHub Actions `.github/workflows/deploy.yml` | push 後 build Quartz 4 → 複製 `site-extra/` → 裁切字型 → 部署 Pages |
| Google Apps Script（綁在 Laura 的試算表，原始碼不在 repo） | 每 10 分鐘讀 `/line/latest.json`，`date`＝今天且未推過 → multicast 給「好友名單」狀態「通過」者；處理加好友／退出事件與「今天／複習／說明」回覆 |
| LINE 官方帳號（免費輕用量，200 則／月） | 推播。每人每次算 1 則 → 每日 1 次最多 6 人 |
| Sveltia CMS `site-extra/admin/` | 網站後台 `/admin/`，用 GitHub fine-grained token 登入（只限此 repo、Contents 讀寫） |

## 3. 檔案地圖
```
CLAUDE.md                     本手冊（唯一規範）
content/                      所有內容（Obsidian 格式，[[雙向連結]]）
  index.md                    首頁（HTML 版面，勿由自動化修改）
  daily/YYYY-MM-DD.md         每日總覽（LINE 連結目標）
  ai/ invest/ fitness/ hr/    文章：YYYY-MM-DD-英文短代稱.md
                              （週報：invest/YYYY-MM-DD-us-weekly.md、invest/YYYY-MM-DD-tw-weekly.md）
  concepts/{hr,invest,fitness,ai}/概念名.md   概念卡
  path/index.md               學習路徑（勾選清單，依序推進）
  weekly/YYYY-Www.md          每週回顧
  notes/                      Laura 的筆記：自動化永遠不可修改或刪除
site-extra/line/latest.json   LINE 推播訊息
site-extra/admin/             後台（index.html、config.yml）
scripts/check_content.py      內容檢查（push 前必跑）
scripts/subset_fonts.py       源泉圓體裁切（Actions 使用）
quartz.config.ts / quartz.layout.ts / quartz/styles/custom.scss / quartz/components/SiteNav.tsx   外觀
```

## 4. 每日任務（排程執行）
1. cd 進 daily-knowledge repo → `git fetch origin main` → `git checkout -B main origin/main` → `git push --dry-run origin main` 測權限；被拒就不寫內容，回報完整錯誤＋推播後結束。
2. 若 `content/daily/今天.md` 已存在（以 origin/main 為準）→ 跳過 3–7（週六仍做第 8-1 節、週日仍做第 8-2 節）。
   - **週六**：第 3–6 步一併完成第 8-1 節的兩篇週報（同一個 commit），週報列進總覽頁與 `latest.json`。
3. 只讀：本檔、`content/path/index.md`、`ls content/concepts/*/`、最近 7 天 `content/daily/*.md`（避免重複）。不要通讀其他內容。
4. 研究（WebSearch 找網址，各領域分開，新聞以 24–72 小時內為主），遵守第 6 節。讀原文：WebFetch 失敗（ENOTFOUND）就改用 Bash `curl -sSL -A Mozilla/5.0 網址`；PubMed 用 `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=PMID&rettype=abstract&retmode=text`，文章仍附 PubMed 網址。Reuters、AP、OpenAI、The Verge 擋自動讀取，改用其他來源。
5. 依第 5、7 節寫文章、概念卡、總覽頁；勾選學習路徑；更新 `latest.json`。
6. `python3 scripts/check_content.py` 通過後 commit（`每日更新 YYYY-MM-DD`，結尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`）→ `git -c push.negotiate=true push origin main`；被拒就 fetch＋rebase 後重試一次。
7. 最後回覆簡報：各領域則數、新概念卡、路徑進度、總覽頁網址；任何失敗附完整錯誤訊息並 `PushNotification`。

## 5. 內容配額
| 領域 | 則數 | 內容 |
|---|---|---|
| AI | 1–3 | 模型／產品、產業、政策 |
| 投資 | 2（週六 3） | 台股／美股／ETF 市場事實 1 ＋ 路徑「投資入門」下一項 1。週六：美股週報＋台股週報取代市場事實（第 8-1 節）；平日市場事實寫單日消息，不寫整週回顧，避免和週報重複 |
| 健身 | 1–2 | 增肌／減脂／柔軟度輪替；路徑「健身入門」下一項 |
| 人資 | 2 | 路徑人資清單下一項（基礎概念）1 ＋ 時事（台灣法規政策或國際趨勢）1 |

- 路徑項目完成：建概念卡，並把清單項改成 `- [x] [[概念名]]`。
- 每天新增概念卡 2–5 張，寧缺勿濫。

## 6. 來源規則
- 每則至少一個一手來源（政府／官方、公司公告、原始研究、國際組織）；重大消息兩個獨立來源交叉確認。
- 禁止：內容農場、匿名社群、轉傳圖卡、未證實爆料、業配、薦股／帶單、無出處網站。
- 只放實際讀過的網址，絕不編造。標示可信度：官方／學術／國際組織／主流媒體／專業作者。
- 優先：AI＝各公司官方部落格、arXiv、Reuters、AP、MIT Tech Review；投資＝央行、主計總處、金管會、證交所、櫃買、投信公告、Fed、Reuters、Bloomberg、中央社（美股另見第 8-1 節來源表）；健身＝PubMed、ACSM、NSCA、WHO、Harvard Health、Mayo Clinic、Stronger By Science；人資＝勞動部、全國法規資料庫、勞保局、ILO、OECD、SHRM、CIPD、HBR。
- 自己的話改寫；引用一句以內且少於 15 字。

## 7. 寫作規則與範本
- 繁體中文（台灣用語）、短句、手機好讀；文章重點 50–100 字。
- `[[ ]]` 只連到**存在的**概念卡；新卡的「相關概念」要連回既有卡。
- 投資不給買賣建議；健身涉及飲食／疾病提醒諮詢專業。

文章（`ai|invest|fitness|hr/YYYY-MM-DD-slug.md`）：
```markdown
---
title: 標題（20 字內）
date: YYYY-MM-DD
tags: [領域, 子主題]
領域: AI | 投資理財 | 健身 | 人資
類型: 新聞 | 觀念 | 基礎概念
author: claude
---
重點 50–100 字（含 [[概念]]）

> [!info] 來源
> - [標題](https://…)｜官方

> [!tip] 📝 考點　（僅人資）
> 可能考法與相關理論

相關概念：[[A]]、[[B]]
```

概念卡（`concepts/領域/概念名.md`）：frontmatter 同上但 `類型: 概念卡`、加 `aliases: [英文, 縮寫]`；段落依序：`## 一句話定義`、`## 重點`、`## 常見考法`（人資）或 `## 實際應用`、`## 相關概念`、`## 延伸閱讀`。

每日總覽（`daily/YYYY-MM-DD.md`）：`title: 📅 YYYY/MM/DD 每日知識`、`tags: [每日推播]`、`author: claude`；分 `## 🤖 AI`、`## 💰 投資理財`、`## 🏋️ 健身`、`## 📚 人資`，每則 `- [[檔名|標題]]：一句摘要`；最後 `## 🔁 今日複習卡`：挑 2／7／30 天前建立的概念卡一張（沒有就挑最舊的），附一個自我測驗問題。

`site-extra/line/latest.json`：
```json
{"date":"YYYY-MM-DD","url":"https://laura920069.github.io/daily-knowledge/daily/YYYY-MM-DD","text":"…"}
```
text 純文字（不用 Markdown）、800 字元內：
```
📅 每日知識 MM/DD

🤖 AI｜標題、標題
💰 投資｜標題
🏋️ 健身｜標題
📚 人資｜標題
🔁 複習｜概念名

👉 完整內容
（url）
```
週六在「💰 投資」下面加兩行：`🇺🇸 美股週報｜一句話`、`🇹🇼 台股週報｜一句話`。

## 8. 週末任務（併入每日排程）

### 8-1 週六：美股週報＋台股週報
- 由每日任務在週六一併完成（第 4 節第 2 步）；即使當天其他內容失敗也要嘗試。該篇檔案已存在就跳過。
- 期間：本週一到週五。美股週五收盤＝台北週六清晨，07:31 執行時已有收盤數據。
- **兩篇分開寫**，美股先寫（台股週報會提到美股的影響）：
  - `invest/YYYY-MM-DD-us-weekly.md`（日期＝週六），tags `[投資, 美股, 美股週報]`
  - `invest/YYYY-MM-DD-tw-weekly.md`，tags `[投資, 台股, 台股週報]`
- `類型: 週報`；不受「重點 50–100 字」限制，每篇約 800–1500 字，短段落、表格，手機好讀。
- 讀者是完全新手：術語第一次出現用括號白話解釋；有概念卡的就連 `[[ ]]`。
- **不薦股**：焦點股依規則挑選並在文中註明「依規則挑選，不是推薦」。
  - 美股：S&P 500 市值前 15 大，挑本週漲跌幅最大或新聞最多的 3–4 支。
  - 台股：台灣 50 前 15 大成分股，同樣挑 3–4 支。
  - 只寫「新手觀察」（要注意什麼），不寫買賣、目標價、追高或攤平。
- **不寫個人持股、金額、月度規劃**（repo 公開）。結尾固定一句：「想討論自己的配置，請私下問 Claude，不要寫進本站。」
- 📘 本週小知識＝當天完成的路徑「投資入門」下一項：連到那張新概念卡，並用本週實例說明一次。
- 數字規則：指數點位、漲跌幅、法人買賣超都要來自讀過的原文；指數用一手來源，或兩家媒體核對一致。查不到就寫「資料未公布」，不要估。

美股週報範本：
```markdown
---
title: 美股週報｜MM/DD–MM/DD
date: YYYY-MM-DD
tags: [投資, 美股, 美股週報]
領域: 投資理財
類型: 週報
author: claude
---
> [!warning] 本文整理市場事實供學習，不構成投資建議。

## 一句話看懂這週
S&P 500 收在＿點，週漲跌＿%；主因是＿＿。

## 四大指數
| 指數 | 週五收盤 | 週漲跌 % |
|---|---|---|
| S&P 500（美國 500 大企業） | | |
| 那斯達克綜合（科技股多） | | |
| 道瓊工業（30 家老牌大公司） | | |
| 費城半導體（和台股連動最高） | | |

## 本週 2–3 個趨勢
### 趨勢名：一句話
- **發生什麼事：**
- **為什麼重要：**
- **跟台股有關嗎：**（有才寫）

## 本週焦點股（依規則挑選，不是推薦）
| 公司（代號） | 週漲跌 % | 一句話原因 |
|---|---|---|

### 1. 公司名（代號）：標題
- **發生什麼事：**
- **為什麼漲／跌：**
- **新手觀察：**

## 總經溫度計
- 利率：Fed 聯邦基金利率目標區間＿；10 年期美債殖利率＿%
- 本週公布的數據（CPI、非農就業、GDP 等，有才寫）

## 下週要注意
- MM/DD（星期）：事件（Fed 會議、CPI、非農、大型財報）

## 📘 本週小知識：[[概念]]
白話說明＋本週實例＋👉 新手重點

> [!info] 來源
> - [標題（日期）](https://…)｜官方／主流媒體

> [!warning] 再次提醒
> 本文為資訊整理與教學，不構成投資建議。想討論自己的配置，請私下問 Claude，不要寫進本站。
```

台股週報範本：同上格式，以下段落不同：
- `## 一句話看懂這週`：加權指數收盤、週漲跌點數與 %、2–3 個主因。
- `## 大盤數據`：表格列加權指數、櫃買指數、台灣 50 指數（週五收盤、週漲跌 %）＋三大法人本週合計買賣超（外資、投信、自營商）。
- `## 本週焦點股（依規則挑選，不是推薦）`：表格＋每支「發生什麼事／為什麼漲跌／新手觀察」。
- `## 美股怎麼影響這週台股`：2–3 句，連到同日的美股週報 `[[YYYY-MM-DD-us-weekly|美股週報]]`。
- `## 下週要注意`：月營收公布（每月 10 日前）、央行理監事會、法說會、除息等。
- `## 📘 本週小知識`、來源、結尾提醒同美股。

來源表（優先一手；媒體標「主流媒體」）：
| 用途 | 美股 | 台股 |
|---|---|---|
| 指數收盤、漲跌 | S&P Dow Jones Indices、Nasdaq 官網；CNBC、Yahoo Finance、中央社國際財經 | 證交所（每日收盤、週報）、櫃買中心；中央社、經濟日報 |
| 法人／資金 | — | 證交所「三大法人買賣金額統計」 |
| 公司消息、財報 | SEC EDGAR、公司 IR 新聞稿 | 公開資訊觀測站（月營收、重大訊息）、公司新聞稿 |
| 利率、總經 | Fed（FOMC 聲明）、BLS（CPI、非農）、BEA（GDP、PCE）、美國財政部（公債殖利率） | 中央銀行、主計總處、國發會 |
| 補充報導 | CNBC、MarketWatch、鉅亨網美股、經濟日報國際 | 鉅亨網、MoneyDJ、工商時報 |

- Reuters、AP 擋自動讀取（第 4 節），用上表其他來源；Yahoo Finance／CNBC 讀不到就用 `curl`。
- 搜尋關鍵字：`stock market week ending November 20 2026 S&P 500`、`美股 週線 道瓊 那斯達克 MM/DD`、`台股盤後 MM月DD日 加權指數 收盤`、`三大法人 買賣超 本週`。

### 8-2 週日：每週整理
- 由「每日知識庫更新」在週日完成第 4 節第 7 步後接著執行；即使當天每日更新失敗也要嘗試。
- 先 `git fetch origin main`、確認工作目錄乾淨；`weekly/本週週次.md` 已存在就跳過。只看過去 7 天新增或修改的檔案。
- 合併重複、修正過時（註明「（YYYY-MM-DD 更新）」）、補連結、接回孤立概念卡；刪除低價值自動文章（每週 ≤10 個，不確定就保留；概念卡只合併不刪）。
- 寫 `weekly/YYYY-Www.md`（`title: 🗓️ YYYY 第 N 週回顧`、`tags: [每週回顧]`、`author: claude`）：本週重點（連到週六的美股／台股週報）、新概念卡、路徑進度（完成／總數）、3 題人資自測（`> [!question]- 題目` 摺疊答案）、整理紀錄。
- **不可動** `latest.json`。check → 另外 commit（`每週整理 YYYY-Www`）→ push → 回覆每週摘要；失敗附完整錯誤。

## 9. 禁止事項（所有自動化）
- 不可修改／刪除 `content/notes/` 或 `author` 不是 `claude` 的檔案、`content/index.md`。
- 每日／每週任務不可改：`quartz/`、`.github/`、`site-extra/admin/`、`quartz.*.ts`、`scripts/`、本檔。
- 不寄 Email；不處理任何 token／密碼（Laura 自行貼上）。

## 10. 維護速查
| 需求 | 做法 |
|---|---|
| 考科確定／改配額／改來源 | 改本檔第 1、5、6 節 |
| 改外觀 | `quartz/styles/custom.scss`（配色在 `quartz.config.ts`）；頂部導覽 `quartz/components/SiteNav.tsx` |
| 關係網（Graph） | 只顯示概念卡（`concepts/` 下），文章／總覽／首頁不進關係網。每頁 1 層、最多 12 個節點、名稱常駐、四領域配色；手機點一下選取、再點一下開啟（滑鼠點一下直接開）；圖下方有「相關知識點」按鈕；「全部」視圖可篩選領域。程式在 `quartz/components/scripts/graph.inline.ts`、`Graph.tsx`、`styles/graph.scss`，參數在 `quartz.layout.ts`。文章要進關係網，重點裡要連 `[[概念]]`；概念卡之間要互連 |
| 改字型 | `quartz.config.ts` typography ＋ `custom.scss` 的 @font-face ＋ `deploy.yml` 下載網址 |
| 網站沒更新 | 看 repo 的 Actions 是否失敗；字型裁切步驟失敗時檢查 `scripts/subset_fonts.py` |
| LINE 沒推 | 試算表「推播紀錄」；`latest.json` 的 date 是否為今天；Apps Script 觸發器是否存在；`checkQuota` 看額度 |
| 新朋友當天補推 | Apps Script 執行 `resendToday`（會重推給所有人） |
| 後台無法登入 | 用「使用存取權杖登入」；token 過期就到 GitHub 重新產生 |
| 排程時間／暫停 | Claude 排程任務設定（單一任務「每日知識庫更新」每天 07:31，台北時間；週日含每週整理） |
| 改週報（美股／台股） | 改本檔第 8-1 節（範本、選股規則、來源表）；舊的「台股主力股週報」排程已停用，不要再開 |
| 改排程提示 | 通常不必：提示只叫 Claude 依本檔執行，改本檔即可 |
| 手動補跑 | 排程任務頁按「立即執行」，或在專用工作階段輸入「跑今天的每日任務」 |
| 研究時網站連不上（`CONNECT tunnel failed, response 403`） | 雲端環境網路被限制：工作階段標題列的環境選單 →「Default」→ Edit → Network access 設為「不限制」（目前設定） |
| 排程跑了但推不上去（403） | 專用工作階段沒有接上 repo：在 claude.ai/code 新開一個選了本 repo 的雲端工作階段，請 Claude 把排程改送進新工作階段 |

## 11. 對話與操作（省 token）
- **只保留**專用工作階段「每日知識庫｜排程執行專用」（排程送進這裡，不可封存）。其餘與本站有關的舊對話都可封存：claude.ai/code 左側清單 → 對話 → 封存。
- 排程提示只有一句「依 CLAUDE.md 執行」，規範全在本檔；改規範＝改本檔，不必改排程。
- 要調整時：在 claude.ai/code **新開**一個選了本 repo 的工作階段（不要用專用工作階段，避免它的對話越來越長），一句話下指令並指明節次，例如：
  - 「改 CLAUDE.md 第 5 節：人資每天 3 則，改完 push」
  - 「content/path/index.md 人資第四階段移到第二階段前面，push」
  - 「11/16 那篇台股文章刪掉，同步改總覽頁，push」
- 不要貼長說明、不要叫它「先讀整個 repo」；完成後把該工作階段封存。

## 12. 已知限制
- 用工具建立的排程任務無法直接綁 repository，所以排程改送進「已接上 repo 的專用工作階段」執行；該工作階段被封存或刪除，排程就會失效。
- Apps Script 原始碼只在 Laura 的 Google 試算表；若需修改，請她貼出（遮住 token）或提供新版讓她覆蓋。
- 首頁桌機版隱藏側欄（搜尋在內頁）；預設淺色主題。
- 字型為建置時裁切，新字會在下次部署自動加入。
