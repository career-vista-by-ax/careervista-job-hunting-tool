# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md)

CareerVista 是專為**澳洲就業市場**設計的本機求職研究助手與應徵紀錄工具，適用於澳洲各種職業、產業及職級。AI 代理程式（下稱代理）負責提問、閱讀履歷、延伸相關職稱、操作求職網站及分析適合程度；網頁則以表格與詳細資料視窗，呈現職缺、推薦理由、疑慮及原始佐證。

本工具不限定模型、服務供應商或 AI 代理。只要代理具備瀏覽器操作工具，並能存取本機 HTTP 介面，就能使用。開發驗證採用 Codex。模型設定、帳號、憑證及費用由執行代理的軟體管理，CareerVista 不會自行呼叫模型、投遞履歷或傳送訊息。

## 升級現有安裝

下載並解壓縮新版，在**新版解壓縮目錄**執行：Mac 使用 `./CareerVista.command upgrade`，Windows 使用 `.\CareerVista.cmd upgrade`。命令會保留職缺、檔案、履歷和申請紀錄，驗證資料庫遷移並重新開啟應用程式，無需解除安裝。重複執行同一版本會沿用已啟動的應用程式。加入 `--no-browser` 可只輸出本機網址；如使用自訂資料目錄，請傳入原來的 `--root`。此命令安裝目前下載的版本，不會自動下載更新。升級後請使用新版目錄中的啟動器。

## 安裝

請從私人儲存庫的 [Releases 頁面](https://github.com/allenhori/careervista-job-hunting-tool/releases)下載對應的壓縮檔；下載時需要具備該儲存庫的 GitHub 存取權限。

| 平台 | 檔案 | 解壓縮後開啟 | 預設資料位置 |
| --- | --- | --- | --- |
| Apple Silicon Mac | `CareerVista-…-macos-arm64.tar.gz` | `CareerVista.command` | `~/Library/Application Support/CareerVista` |
| Windows x64 | `CareerVista-…-windows-x64.zip` | `CareerVista.cmd` | `%LOCALAPPDATA%\CareerVista` |

請先解壓縮並保留整個資料夾，再開啟啟動檔。Windows 請使用「全部解壓縮」，不要直接從 ZIP 內執行。啟動程式已內含 Node 與應用程式，不必另外安裝 Node、npm、Git、編譯器、WSL 或 Docker，也不需要系統管理員權限。它會啟動本機服務並開啟瀏覽器；再次開啟時，會沿用既有執行個體與資料。全新安裝不包含開發測試用的職缺或個人資料。

目前為預覽版。Mac 安裝套件尚未完成 Apple 公證，全新系統的 Gatekeeper 與下載隔離行為也尚未驗證。Windows x64 提供原生 CI 建置與壓縮檔驗收測試；成功執行的建置亦可從 [Windows Actions](https://github.com/allenhori/careervista-job-hunting-tool/actions/workflows/windows.yml)下載。Windows 套件尚未進行程式碼簽章，全新個人電腦上的檔案總管／SmartScreen 行為及 Windows 代理軟體仍需另行驗證。Linux、Intel Mac、Windows ARM64 與 Chromebook 不在已驗證範圍內。詳見[發行說明](docs/release.md)。

每台電腦各自使用獨立的資料庫與代理工作階段。移轉紀錄請使用私人備份／還原功能；不要在不同電腦間同步使用中的 SQLite 檔案。

## 連接 AI 代理程式

請在同一台電腦上設定具備瀏覽器操作能力的代理，並允許它存取啟動程式顯示的完整本機網址。連接埠可能不同，請勿一律假設為 4318。

在解壓縮後的資料夾中開啟終端機或 PowerShell，註冊技能：

Mac：

```sh
./CareerVista.command register-skills --host codex
```

Windows：

```powershell
.\CareerVista.cmd register-skills --host codex
```

支援 `~/.agents/skills` 的代理軟體可改用 `--host agents`。註冊時會記錄安裝歸屬，並保留無關的技能。請重新載入代理軟體的技能，或開啟新對話後，使用 **careervista-capture**。若代理軟體不支援技能註冊，可直接讓它讀取解壓縮資料夾中的 `agent-skills/v1/careervista-capture/SKILL.md` 與相關說明。

## 第一次搜尋

1. 啟動 CareerVista，將瀏覽器網址列中的完整本機網址交給代理。
2. 直接描述目標，例如「幫我找墨爾本的 principal analytics engineer 職缺」。代理應延伸 staff／lead 等相關職稱，並先確認你是否也考慮資料工程或資料團隊管理，而不是只搜尋原始職稱。
3. 視需要提供 PDF、Word 履歷或文字，由代理自己的文件工具閱讀。它會與你確認事實及競爭優勢，再將你同意保存的基礎履歷、已確認內容與個人資料存入資料庫，供後續對話重複使用。為個別職缺調整的履歷、求職信草稿與修改建議會另存版本，不覆寫基礎履歷。掃描檔或不支援的格式可能需要代理軟體提供 OCR／可讀文字，也可以不提供履歷繼續搜尋。網頁不負責解析文件。
4. 代理**一次只問一個問題**，說明建議與取捨，提供選項及自行輸入答案的方式，並等待回覆。它會視需要確認澳洲地點、遠端／混合／現場工作、薪資、股權、年假、福利、工作內容及員工評價的關注面向，避免重複詢問已知資訊。
5. 薪資以澳幣 AUD 為準，並釐清是「不含 super 的本薪」或「包含 super 的整體薪酬」，保留年薪、時薪或承攬報酬等原始計價方式。Superannuation 是澳洲退休金制度。
6. 偏好討論完成後，代理會問你要搜尋哪些網站：SEEK、LinkedIn、Glassdoor、Indeed、雇主徵才頁面，或你指定的網址。接著與你確認職務範圍、必要條件／可協調偏好、搜尋數量及預算，再搜尋、分析並保存佐證、推薦理由、疑慮與待確認事項。
7. 這一批結果完成後，代理會提供網頁連結。表格在畫面開啟時會定期更新，也可以按 **Refresh** 立即更新。點選職缺，在 **Why this job is here** 中查看推薦理由與佐證。**Filters & columns** 內提供篩選、顯示欄位及已儲存的檢視設定。

網頁的 **Agent setup** 提供起始提示詞，以及 **Local data** 下的備份、還原、匯出及刪除工具。輸入、追問、分析與搜尋調整，都在代理對話中完成。

可複製使用的起始提示詞（請替換網址與範例職業）：

```text
請使用 <LOCAL_URL> 上的 CareerVista 與 careervista-capture 技能，
幫我尋找澳洲的 principal analytics engineer 職缺。
延伸 staff／lead 等相關職稱，並確認是否納入資料工程或管理職務。
一次只問我一個問題，提供建議、可選答案及自行輸入答案的方式。
釐清目標、地點、工作方式、AUD 薪資與 base／super、股權、年假及福利，
再問我要搜尋哪些網站。如果我提供履歷，先確認競爭優勢並保存基礎版本。
確認範圍、數量及預算後，在代理中搜尋與分析，保存原始佐證、
推薦理由、疑慮及待確認事項。調整後的履歷或求職信請另存版本。
這一批結果準備好後，再讓我到網頁瀏覽。不要代為應徵或傳送訊息。
```

技能會從 `/api/v1/agent-guide` 讀取目前安裝版本的工作流程與 API 說明，可直接建立個人資料、相關職務路線及範圍明確的研究任務，不必先填寫網頁表單。

## 獨立履歷技能：`/ax-cv`

**老徐的简历修改** 可獨立使用，不依賴 CareerVista、LinkedIn 外掛程式或特定模型。請將解壓縮資料夾中的 `agent-skills/v1/ax-cv` 資料夾加入代理軟體指定的技能目錄，或直接讓代理讀取其中的 `SKILL.md`。`/ax-cv` 是簡稱，實際呼叫方式依代理軟體而定。技能強調最多四頁、正確頁碼、優先調整專業亮點，以及以成果與實際能力為主的自然語氣；基礎履歷與個別調整版本分開保存。CareerVista 求職技能會讀取相同規則，不必在每次對話中重述。

## 登入、評價與後續追蹤

- 網站登入及驗證由你在代理控制的同一個瀏覽器工作階段中完成，再通知代理繼續。密碼、Cookie 與工作階段權杖不會提交給 CareerVista。
- Glassdoor 等評價由瀏覽器讀取；若已連接適用且獲授權的 MCP，也可使用。無法登入、遇到付費牆或遭阻擋時，應明確標示無法存取，不能聲稱已閱讀。公司、團隊、地區、時間及互相矛盾的評價應分別保留；個別評論不能直接視為公司文化的定論。
- 告訴代理要儲存、略過或進一步調查哪個職缺。你的決定、代理評估、一般偏好與應徵狀態會分開記錄。
- 變更必要條件須經明確確認；重新分析時應保留舊版本。開啟徵才連結不代表已提出應徵。
- 基礎履歷及個別修改版本會保存在本機資料庫，並納入私人備份。外部文件參照不代表已複製檔案，換電腦時仍須另外攜帶相關文件。
- 應用程式只驗證並保存代理的輸出。實際模型費用由代理軟體管理；預算估算不等同於精確帳單。

## 停止、清理與解除安裝

請在解壓縮資料夾中執行以下 Mac 指令；Windows 請將 `./CareerVista.command` 改為 `.\CareerVista.cmd`：

```sh
./CareerVista.command stop
./CareerVista.command storage
./CareerVista.command clear-cache
./CareerVista.command uninstall
```

預設解除安裝會保留佐證、履歷、個人資料、憑證資料夾及工作階段資料夾，重新安裝後可繼續使用。永久刪除需要另外確認；操作方式及獨立資料目錄設定請參閱[發行說明](docs/release.md)。解除安裝不會刪除另外儲存的備份、匯出檔或下載的壓縮檔。請妥善保管含有個人資料的備份。

## 開發與驗證

開發環境使用 `mise.toml` 固定的 Node 26.12.0：

```sh
mise trust
mise install
mise exec -- npm ci
mise exec -- npm run build
mise exec -- npm start
mise exec -- npm test
```

Windows 也可使用相同固定版本的 Node 執行 npm 指令；發行套件應在對應平台原生執行 `node scripts/package-release.mjs` 建置。一般使用者不需要這些開發工具。

服務僅繫結至 `127.0.0.1`，並拒絕異常 Host、外部 Origin 及跨網站資料請求。這是本機單人使用的應用程式，不是遠端代管服務；以同一系統使用者身分執行的其他處理程序，仍可能存取它。可用 `CAREERVISTA_ROOT` 指定獨立資料目錄，用 `CAREERVISTA_PORT` 指定連接埠，0 代表自動選擇。請勿將 `data`、`sessions` 或 `credentials` 當作快取刪除，也不要手動清理使用中的 SQLite WAL／journal 檔案。

更多說明：[代理工作流程](docs/agent-workflow.md)、[逐題訪談](docs/agent-intake.md)、[履歷](docs/resume.md)、[個人資料](docs/profiles.md)、[研究任務](docs/runs.md)、[系統架構](docs/architecture.md)、[授權與來源](docs/references-and-licenses.md)。這些技術文件目前為英文。繁體中文 README 不表示網頁介面已在地化；產品仍專注於澳洲就業市場。
