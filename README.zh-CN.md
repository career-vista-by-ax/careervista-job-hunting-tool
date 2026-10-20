# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁体中文](README.zh-TW.md)

CareerVista 帮你寻找下一份澳洲工作。智能体与你明确目标、研究职位并解释推荐理由；本地工作台保存证据、候选职位和申请记录，方便你浏览与跟进。

**先安装技能，再让起始技能引导其余设置。** 你不需要先打开网页，也不需要自行寻找可执行文件路径。

## 1. 安装技能

把下面这段话发给你的智能体：

```text
请使用当前智能体支持的技能安装方式，从以下 GitHub 仓库的默认分支安装 CareerVista 技能：
https://github.com/career-vista-by-ax/careervista-job-hunting-tool
请安装 agent-skills/v1/careervista-job-search、agent-skills/v1/ax-cv
和 agent-skills/v1/ax-30-secs 这三个目录。
先只安装技能，然后告诉我如何启动 careervista-job-search。
```

仓库目前为私有，需要你已有的 GitHub 访问权限。如果无法访问，请通过正常工具登录；不要把访问令牌粘贴到对话中。

<details>
<summary>可选：使用 skills CLI 安装</summary>

如果已安装 Node/npm，可以使用 [skills CLI](https://github.com/vercel-labs/skills)：

```sh
npx skills add career-vista-by-ax/careervista-job-hunting-tool --skill careervista-job-search --skill ax-cv --skill ax-30-secs
```

按提示选择你的智能体宿主。这个命令只安装技能说明，不安装应用。

</details>

## 2. 开始引导流程

技能可用后，告诉智能体：

```text
请使用 careervista-job-search 技能，帮我寻找下一份澳洲工作。
```

你也可以在同一条消息里补充自己的目标。不同智能体的调用方式可能不同；在 Codex 中也可以使用 `$careervista-job-search`。

技能会引导你选择语言、Docker 或本地副本，在获得必要许可后定位或启动工作台，并验证实际网址。它会检查可用的发布版本或镜像，不会假设固定端口或程序路径。目前尚未发布镜像仓库中的 Docker 镜像；需要时，智能体可以征得你的许可后提供源码构建方案。

接下来，智能体一次只问一个问题；如果你提供简历，它会与你确认竞争优势，并扩展相关职位名称。与你确认澳洲地点、工作方式、AUD 薪资与 base/super、关注重点、网站、搜索范围和预算后，再开始研究。结果准备好后，它会把你带到职位表格。

## 技能用途

| 技能 | 用途 |
| --- | --- |
| `careervista-job-search` | 引导设置、职位研究及有证据支持的推荐 |
| `ax-cv` | 面向澳洲市场、忠于事实的简历改进与定制 |
| `ax-30-secs` | 模拟 30 秒快速阅读简历或求职信，提出具体改进建议 |

技能使用智能体自己的浏览器、HTTP 和文档工具。实际能力及模型费用由智能体宿主决定，不限定服务商。技能与应用运行环境分开安装。

工作台支持搜索归档、可恢复删除、申请进度、联系人、文档副本和应用内跟进提醒。语言可选 English、简体中文、繁体中文；英文职位原文与证据会保留。

**请自行从职位原始广告的 Apply 按钮申请。** CareerVista 不会自动申请、代填申请表或代发消息。

## 参考资料

- [手动运行、更新与支持范围](docs/release.md)
- [搜索与申请记录](docs/history.md) · [语言](docs/language.md)
- [智能体工作流程](docs/agent-workflow.md) · [架构](docs/architecture.md)
- [贡献与开发](CONTRIBUTING.md) · [验证记录](docs/validation-2026-10-20.md)

这些参考文档目前为英文。仓库暂为私有，许可证及公开分发条款尚未决定。
