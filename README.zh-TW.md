# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁体中文](README.zh-TW.md)

讓 AI 智能體協助你尋找澳洲工作，本機工作台保存職缺證據、推薦理由及申請紀錄。

## 開始使用

首次使用，告訴智能體：

```text
從 https://github.com/career-vista-by-ax/careervista-job-hunting-tool 安裝並啟動 CareerVista
```

安裝後，只需輸入：

```text
$careervista-job-search
```

也可以說「使用 careervista-job-search」。智能體會主動說明隱私事項，再逐步引導設定
Docker 或本機應用程式、釐清求職目標，並提供本機職缺表連結。無需準備特殊提示詞、
預先啟動應用程式或上傳履歷。已有設定會盡可能沿用。

智能體使用你選擇的模型、瀏覽器及文件工具，其費用和資料政策適用；CareerVista
在本機保存紀錄。`ax-cv` 可協助修改履歷，`ax-30-secs` 提供模擬快速審閱。
申請必須由你透過原始招聘廣告自行提交，工具不會自動申請或傳送訊息。

[安裝與發布說明](docs/release.md) · [貢獻指南](CONTRIBUTING.md)

使用 [GNU GPL v3 only](LICENSE) 授權。貢獻需簽署 [CLA](CLA.md)。

Docker 映像已公開發布：`careervista/careervista:0.2.0-preview.3`。技能使用固定摘要拉取，無需 Docker Hub 帳號或本機建置；請先啟動 Docker。舊版技能請先更新。
