# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁体中文](README.zh-TW.md)

CareerVista 幫你尋找下一份澳洲工作。代理與你釐清目標、研究職缺並解釋推薦理由；本機工作台保留佐證、候選職缺和申請紀錄，方便你瀏覽與追蹤。

**先安裝技能，再讓起始技能引導其餘設定。** 你不必先開啟網頁，也不必自行尋找執行檔路徑。

## 1. 安裝技能

把以下內容傳給你的代理：

```text
請使用目前代理支援的技能安裝方式，從以下 GitHub 儲存庫的預設分支安裝 CareerVista 技能：
https://github.com/career-vista-by-ax/careervista-job-hunting-tool
請安裝 agent-skills/v1/careervista-job-search、agent-skills/v1/ax-cv
及 agent-skills/v1/ax-30-secs 這三個目錄。
先只安裝技能，然後告訴我如何啟動 careervista-job-search。
```

儲存庫目前為私人，需要你既有的 GitHub 存取權限。如果無法存取，請透過正常工具登入；請勿把存取權杖貼到對話中。

<details>
<summary>可選：使用 skills CLI 安裝</summary>

如果已安裝 Node/npm，可以使用 [skills CLI](https://github.com/vercel-labs/skills)：

```sh
npx skills add career-vista-by-ax/careervista-job-hunting-tool --skill careervista-job-search --skill ax-cv --skill ax-30-secs
```

依提示選擇你的代理軟體。這個命令只安裝技能說明，不安裝應用程式。

</details>

## 2. 開始引導流程

技能可用後，告訴代理：

```text
請使用 careervista-job-search 技能，幫我尋找下一份澳洲工作。
```

你也可以在同一則訊息補充自己的目標。不同代理的呼叫方式可能不同；在 Codex 中也可以使用 `$careervista-job-search`。

技能會引導你選擇語言、Docker 或本機副本，在取得必要許可後尋找或啟動工作台，並驗證實際網址。它會檢查可用的發行版本或映像檔，不會假設固定連接埠或程式路徑。目前尚未發布映像倉庫中的 Docker 映像檔；需要時，代理可以徵得你的許可後提供原始碼建置方案。

代理會優先呼叫宿主的原生提問工具，提供可點選的選項並保留自訂輸入；只有不支援此介面時才使用文字選項。接下來，代理一次只問一個問題；如果你提供履歷，它會與你確認競爭優勢，並延伸相關職稱。與你確認澳洲地點、工作方式、AUD 薪資與 base/super、關注重點、網站、搜尋範圍及預算後，再開始研究。結果準備好後，它會把你帶到職缺表格。

## 技能用途

| 技能 | 用途 |
| --- | --- |
| `careervista-job-search` | 引導設定、職缺研究及有佐證支持的推薦 |
| `ax-cv` | 面向澳洲市場、忠於事實的履歷改進與調整 |
| `ax-30-secs` | 模擬 30 秒快速閱讀履歷或求職信，提出具體改進建議 |

技能使用代理自己的瀏覽器、HTTP 與文件工具。實際能力及模型費用由代理軟體決定，不限定服務商。技能與應用程式執行環境分開安裝。

工作台支援搜尋封存、可還原刪除、申請進度、聯絡人、文件副本及應用程式內的追蹤提醒。語言可選 English、简体中文、繁体中文；英文職缺原文與佐證會保留。

**請自行從職缺原始廣告的 Apply 按鈕申請。** CareerVista 不會自動申請、代填申請表或代發訊息。

## 參考資料

- [手動執行、更新與支援範圍](docs/release.md)
- [搜尋與申請紀錄](docs/history.md) · [語言](docs/language.md)
- [代理工作流程](docs/agent-workflow.md) · [架構](docs/architecture.md)
- [貢獻與開發](CONTRIBUTING.md) · [驗證紀錄](docs/validation-2026-10-20.md)

這些參考文件目前為英文。儲存庫暫為私人，授權及公開散布條款尚未決定。
