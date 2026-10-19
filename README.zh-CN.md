# CareerVista

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文（台灣用語）](README.zh-TW.md)

CareerVista 是面向**澳大利亚就业市场**的本地求职研究助手与申请记录工具，适用于澳洲的任何职业、行业和职级。智能体负责提问、理解简历、扩展相关职位名称、操作招聘网站和分析匹配情况；网页负责用表格和详情弹窗展示结果、入选理由、疑虑及原始证据。

它不绑定特定模型、服务商或智能体。只要智能体具有浏览器控制和访问本机 HTTP 接口的能力，就能使用。开发验证使用 Codex。模型配置、账号、凭据和费用由智能体宿主软件管理，CareerVista 不会自动调用模型或发送申请。

## 安装

从私有仓库的 [Releases 页面](https://github.com/allenhori/careervista-job-hunting-tool/releases)下载对应压缩包；下载需要该仓库的 GitHub 访问权限。

| 平台 | 文件 | 解压后打开 | 默认数据位置 |
| --- | --- | --- | --- |
| Apple Silicon Mac | `CareerVista-…-macos-arm64.tar.gz` | `CareerVista.command` | `~/Library/Application Support/CareerVista` |
| Windows x64 | `CareerVista-…-windows-x64.zip` | `CareerVista.cmd` | `%LOCALAPPDATA%\CareerVista` |

先解压并保留整个文件夹，再打开启动文件。Windows 请使用“全部解压”，不要直接在 ZIP 内运行。启动器自带 Node 和应用，不需要单独安装 Node、npm、Git、编译器、WSL 或 Docker，也不需要管理员权限。它会启动本地服务并打开浏览器；再次启动会复用已有实例和数据。新安装不含开发测试用的职位或个人资料。

这是预览版。Mac 安装包尚未公证，干净系统上的 Gatekeeper/下载隔离行为未验证。Windows x64 提供原生 CI 构建与压缩包验收测试；成功运行的构建也可从 [Windows Actions](https://github.com/allenhori/careervista-job-hunting-tool/actions/workflows/windows.yml)下载。Windows 包未代码签名，普通新电脑上的 Explorer/SmartScreen 行为及 Windows 智能体宿主仍需另行验证。Linux、Intel Mac、Windows ARM64 和 Chromebook 不在已验证范围。详见[发布说明](docs/release.md)。

每台电脑使用独立数据库和智能体会话。迁移记录请使用私密备份/恢复；不要在电脑之间同步正在使用的 SQLite 文件。

## 连接智能体

在同一台电脑上配置具备浏览器控制能力的智能体，并允许它访问启动器显示的完整本地 URL。端口可能变化，不要固定假设为 4318。

在解压目录中打开终端或 PowerShell，注册技能：

Mac：

```sh
./CareerVista.command register-skills --host codex
```

Windows：

```powershell
.\CareerVista.cmd register-skills --host codex
```

兼容 `~/.agents/skills` 的宿主可改用 `--host agents`。注册过程记录安装归属，保留无关技能。刷新宿主的技能或开始新对话后，使用 **careervista-capture**。不支持技能注册的宿主可以直接读取解压目录中的 `agent-skills/v1/careervista-capture/SKILL.md` 及相关说明。

## 第一次搜索

1. 启动 CareerVista，把浏览器地址栏中的完整本地 URL 告诉智能体。
2. 直接描述目标，例如“帮我找墨尔本的 principal analytics engineer 职位”。智能体应扩展 staff/lead 等相关名称，并先确认你是否也考虑数据工程或数据管理路线，而不是只搜索原始标题。
3. 按需提供 PDF、Word 简历或文字，由智能体自己的文档工具读取。它与你核实事实和竞争优势后，保存获准的基础简历、已审核内容和个人资料，供后续会话复用。定制简历、求职信草稿和修改建议另存版本，不覆盖基础简历。扫描件或不支持的文件可能需要宿主 OCR/可读文本，也可以不提供简历继续搜索。网页不承担文件解析。
4. 智能体**每次只问一个问题**，说明建议及取舍，提供选项和自定义回答，并等待回复。它按需确认澳洲地点、远程/混合/现场工作、薪资、股权、年假、福利、工作内容及员工评价关注点，避免重复询问已知信息。
5. 薪资使用 AUD，并明确是“不含 super 的基本工资”还是“包含 super 的总薪酬”，保留年薪、时薪或合同费率等原始单位。Superannuation 是澳大利亚退休金制度，不能与其他地区制度混同。
6. 讨论偏好后，智能体询问搜索哪些网站：SEEK、LinkedIn、Glassdoor、Indeed、雇主招聘页或你指定的网址。它与你确认职位范围、硬性要求/可协商偏好、搜索数量和预算，然后搜索、分析并保存证据、入选理由、疑虑与未知项。
7. 完成这一批结果后，智能体给你网页链接。表格在可见时定期更新，也可以点 **Refresh**。点击职位，在 **Why this job is here** 中查看推荐理由及证据。**Filters & columns** 内有筛选、显示列和已保存视图。

网页的 **Agent setup** 中提供起始提示词，以及 **Local data** 下的备份、恢复、导出和删除工具。输入、追问、分析和搜索调整都在智能体对话中进行。

可复制的起始提示词（替换 URL 和示例职业）：

```text
请使用 <LOCAL_URL> 上的 CareerVista 和 careervista-capture 技能，
帮我寻找澳大利亚的 principal analytics engineer 职位。
扩展 staff/lead 等相关职称，并确认是否考虑数据工程或管理路线。
每次只问我一个问题，给出推荐、可选答案及自定义回答的方式。
核实目标、地点、工作方式、AUD 薪资及 base/super、股权、年假和福利，
再问我想搜索哪些网站。如果我提供简历，先确认竞争优势并保存基础版本。
确认范围、数量和预算后，在智能体中搜索和分析，保存原始证据、
入选理由、疑虑及未知项。定制简历或求职信另存版本。
这一批结果准备好后，再让我到网页浏览。不要代投申请或发送消息。
```

技能从 `/api/v1/agent-guide` 读取当前安装版本的工作流程和 API 说明，可以直接建立个人资料、相关职位路线及有边界的研究任务，不需要先填写网页表单。

## 独立简历技能：`/ax-cv`

**老徐的简历修改** 可独立使用，不依赖 CareerVista、LinkedIn 插件或特定模型。将解压目录中的 `agent-skills/v1/ax-cv` 文件夹放入宿主规定的技能目录，或直接让智能体读取其中的 `SKILL.md`。`/ax-cv` 是简称，实际调用语法取决于宿主。技能强调最多四页、准确页码、重点调整职业亮点、以成果和真实能力为主的自然语言；基础简历与定制版本分别保存。CareerVista 求职技能会读取相同规则，不需要在每次对话中重新描述。

## 登录、评价和后续跟进

- 网站登录和验证由你在智能体控制的同一浏览器会话中完成，再通知智能体继续。密码、Cookie 和会话令牌不提交给 CareerVista。
- Glassdoor 等评价由浏览器读取；如已有合适且获准的 MCP，也可使用。无法登录、付费墙或被阻挡的内容必须标为无法访问，不能声称已经读过。公司、团队、地区、时间和相互矛盾的评价应分开保存；个别评价不是公司文化的定论。
- 告诉智能体要收藏、放弃或深入调查哪个职位。你的决定与智能体评级、一般偏好和申请状态分别记录。
- 硬性条件的调整需要明确确认；重新分析应保留旧版本。打开招聘链接并不代表已经申请。
- 基础简历与独立修改版本保存在本地数据库，包含在私密备份中。外部文件引用不等于复制文件，换电脑时需另外携带相关文档。
- 应用只保存和验证智能体的输出。实际模型费用由宿主管理；预算中的估算不等于精确账单。

## 停止、清理与卸载

在解压目录中运行以下 Mac 命令；Windows 将 `./CareerVista.command` 换成 `.\CareerVista.cmd`：

```sh
./CareerVista.command stop
./CareerVista.command storage
./CareerVista.command clear-cache
./CareerVista.command uninstall
```

默认卸载保留证据、简历、个人资料、凭据目录和会话目录，重新安装可继续使用。永久删除需要专门确认；操作与独立数据目录说明见[发布说明](docs/release.md)。卸载不会删除另存的备份、导出文件或下载压缩包。请妥善保管含个人资料的备份。

## 开发与验证

开发环境使用 `mise.toml` 锁定的 Node 26.12.0：

```sh
mise trust
mise install
mise exec -- npm ci
mise exec -- npm run build
mise exec -- npm start
mise exec -- npm test
```

也可在 Windows 中使用相同固定版本的 Node 运行 npm 命令；发布构建应在对应平台原生执行 `node scripts/package-release.mjs`。普通使用者不需要这些开发工具。

服务只绑定 `127.0.0.1`，拒绝异常 Host、外部 Origin 和跨站数据请求。它是本机单人使用的应用，不是远程托管服务；以同一系统用户身份运行的其他进程仍可能访问它。`CAREERVISTA_ROOT` 可指定独立数据目录，`CAREERVISTA_PORT` 可指定端口，0 表示自动选择。不要把 `data`、`sessions` 或 `credentials` 当作缓存删除，也不要手动清理正在使用的 SQLite WAL/journal 文件。

更多说明：[智能体工作流程](docs/agent-workflow.md)、[逐题访谈](docs/agent-intake.md)、[简历](docs/resume.md)、[个人资料](docs/profiles.md)、[研究任务](docs/runs.md)、[架构](docs/architecture.md)、[许可与来源](docs/references-and-licenses.md)。这些技术说明目前为英文。本 README 的语言版本不表示网页界面已本地化，也不扩展产品的澳洲市场范围。
