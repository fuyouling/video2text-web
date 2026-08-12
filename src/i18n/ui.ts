// 类型化 UI 文案键集合（en 为完整基准集，新增键必须在此声明）
export type Lang = "en" | "zh";

export type UIKey =
  | "nav.features"
  | "nav.docs"
  | "nav.blog"
  | "nav.pricing"
  | "nav.contact"
  | "nav.register"
  | "lang.en"
  | "lang.zh"
  | "cta.download"
  | "cta.docs"
  | "cta.getStarted"
  | "cta.learnMore"
  | "cta.viewDocs"
  | "hero.badge"
  | "hero.title"
  | "hero.subtitle"
  | "hero.ctaPrimary"
  | "hero.ctaSecondary"
  | "hero.note"
  | "features.title"
  | "features.subtitle"
  | "features.local.title"
  | "features.local.desc"
  | "features.gpu.title"
  | "features.gpu.desc"
  | "features.multilang.title"
  | "features.multilang.desc"
  | "features.summary.title"
  | "features.summary.desc"
  | "features.models.title"
  | "features.models.desc"
  | "features.desktop.title"
  | "features.desktop.desc"
  | "workflow.title"
  | "workflow.subtitle"
  | "workflow.step1.title"
  | "workflow.step1.desc"
  | "workflow.step2.title"
  | "workflow.step2.desc"
  | "workflow.step3.title"
  | "workflow.step3.desc"
  | "workflow.step4.title"
  | "workflow.step4.desc"
  | "workflow.step5.title"
  | "workflow.step5.desc"
  | "compare.title"
  | "compare.col.local"
  | "compare.col.cloud"
  | "compare.row.privacy"
  | "compare.row.network"
  | "compare.row.cost"
  | "compare.row.performance"
  | "compare.row.models"
  | "pricing.title"
  | "pricing.subtitle"
  | "pricing.free.name"
  | "pricing.free.tagline"
  | "pricing.pro.name"
  | "pricing.pro.tagline"
  | "pricing.pro.price"
  | "pricing.faq.title"
  | "pricing.faq.q1"
  | "pricing.faq.a1"
  | "pricing.faq.q2"
  | "pricing.faq.a2"
  | "pricing.faq.q3"
  | "pricing.faq.a3"
  | "pricing.perks.batch"
  | "pricing.perks.support"
  | "pricing.perks.devices"
  | "pricing.perks.export"
  | "pricing.perks.early"
  | "pricing.byok.note"
  | "blog.title"
  | "blog.subtitle"
  | "blog.readMore"
  | "blog.backToBlog"
  | "blog.empty"
  | "docs.title"
  | "docs.subtitle"
  | "docs.onThisPage"
  | "docs.empty"
  | "contact.title"
  | "contact.subtitle"
  | "contact.github.label"
  | "contact.email.label"
  | "contact.issues.label"
  | "footer.tagline"
  | "footer.rights"
  | "footer.privacy"
  | "footer.terms"
  | "footer.refund"
  | "footer.github"
  | "common.loading"
  | "common.error"
  | "common.backHome"
  | "common.notFound"
  | "common.notFound.desc"
  | "common.langLabel"
  | "auth.register.title"
  | "auth.register.subtitle"
  | "auth.register.emailLabel"
  | "auth.register.passwordLabel"
  | "auth.register.submit"
  | "auth.register.success"
  | "auth.register.errorRequired"
  | "auth.register.errorEmail"
  | "auth.register.errorPassword"
  | "auth.register.errorConflict"
  | "auth.register.errorGeneric"
  | "auth.register.haveAccount"
  | "auth.register.loginLink"
  | "auth.login.title"
  | "auth.login.subtitle"
  | "auth.login.emailLabel"
  | "auth.login.passwordLabel"
  | "auth.login.submit"
  | "auth.login.errorRequired"
  | "auth.login.errorCredentials"
  | "auth.login.errorGeneric"
  | "auth.login.noAccount"
  | "auth.login.registerLink"
  | "checkout.title"
  | "checkout.subtitle"
  | "checkout.accountLabel"
  | "checkout.payButton"
  | "checkout.success"
  | "checkout.keyLabel"
  | "checkout.keyNote"
  | "checkout.copy"
  | "checkout.copied"
  | "checkout.logout"
  | "changelog.title"
  | "changelog.subtitle"
  | "changelog.empty"
  | "changelog.viewAll";

export const ui: {
  en: Record<UIKey, string>;
  zh: Partial<Record<UIKey, string>>;
} = {
  en: {
    "nav.features": "Features",
    "nav.docs": "Docs",
    "nav.blog": "Blog",
    "nav.pricing": "Pricing",
    "nav.contact": "Contact",
    "nav.register": "Sign up",
    "lang.en": "English",
    "lang.zh": "中文",
    "cta.download": "Download",
    "cta.docs": "Read the docs",
    "cta.getStarted": "Get started",
    "cta.learnMore": "Learn more",
    "cta.viewDocs": "View docs",
    "hero.badge": "100% local & private",
    "hero.title": "Local, private transcription & summarization",
    "hero.subtitle":
      "Turn audio and video into accurate text and smart summaries — entirely on your machine. No uploads, no cloud, no subscriptions.",
    "hero.ctaPrimary": "Download for Windows",
    "hero.ctaSecondary": "View documentation",
    "hero.note": "Free desktop app. Pro one-time upgrade available.",
    "features.title": "Everything runs on your machine",
    "features.subtitle":
      "video2text is built around privacy and performance. Your files never leave your computer.",
    "features.local.title": "100% Local & Private",
    "features.local.desc":
      "Audio and video are processed offline. Your data never leaves your machine — perfect for sensitive recordings.",
    "features.gpu.title": "GPU Accelerated",
    "features.gpu.desc":
      "Powered by faster-whisper with CUDA acceleration. Transcribe large files dramatically faster when a supported GPU is available.",
    "features.multilang.title": "Multi-language",
    "features.multilang.desc":
      "Transcribe and summarize across many languages with automatic language detection — no manual switching required.",
    "features.summary.title": "AI Summary",
    "features.summary.desc":
      "Generate structured summaries with a local model, or connect your own online model. Turn hours of audio into key points.",
    "features.models.title": "Flexible Models",
    "features.models.desc":
      "Use the built-in offline model, or plug in your own online transcription endpoint. Choose what fits each job.",
    "features.desktop.title": "Desktop & CLI",
    "features.desktop.desc":
      "A friendly Windows GUI for everyday use and a CLI for scripting and batch jobs. One purchase works on multiple machines.",
    "workflow.title": "From file to summary in five steps",
    "workflow.subtitle": "A simple, fully local pipeline.",
    "workflow.step1.title": "Pick a local file",
    "workflow.step1.desc": "Select an audio or video file from your computer. Nothing is uploaded.",
    "workflow.step2.title": "Extract audio",
    "workflow.step2.desc": "The app extracts the audio track locally for transcription.",
    "workflow.step3.title": "Transcribe",
    "workflow.step3.desc":
      "faster-whisper converts speech to text, with optional GPU acceleration.",
    "workflow.step4.title": "Summarize",
    "workflow.step4.desc":
      "A local model (or your own online model) produces a structured summary.",
    "workflow.step5.title": "Export",
    "workflow.step5.desc": "Save results as txt, json, srt, and more — ready to share.",
    "compare.title": "Local first, by design",
    "compare.col.local": "video2text (local)",
    "compare.col.cloud": "Cloud transcription SaaS",
    "compare.row.privacy": "Data privacy",
    "compare.row.network": "Network dependency",
    "compare.row.cost": "Cost",
    "compare.row.performance": "Performance",
    "compare.row.models": "Model choice",
    "pricing.title": "Simple, one-time pricing",
    "pricing.subtitle":
      "The desktop app is free forever. Upgrade once for advanced local features.",
    "pricing.free.name": "Free",
    "pricing.free.tagline": "Local transcription for everyone",
    "pricing.pro.name": "Pro",
    "pricing.pro.tagline": "For power users who need more",
    "pricing.pro.price": "$9.9 one-time",
    "pricing.faq.title": "Frequently asked questions",
    "pricing.faq.q1": "What is included in Pro?",
    "pricing.faq.a1":
      "Pro adds enhanced batch and incremental processing, priority support, multi-device activation (2 devices), advanced local export formats, and early access to new features. It does not include prepaid cloud model credits — online models use BYOK (bring your own key).",
    "pricing.faq.q2": "How is payment handled?",
    "pricing.faq.a2":
      "Checkout is handled by Paddle, a global Merchant of Record. Paddle processes payment, invoicing, and tax compliance — no self-hosted payment needed.",
    "pricing.faq.q3": "What about refunds?",
    "pricing.faq.a3": "We offer a 14-day refund window. See our refund policy for details.",
    "pricing.perks.batch": "Enhanced batch & incremental processing",
    "pricing.perks.support": "Priority support",
    "pricing.perks.devices": "Activate on up to 2 devices",
    "pricing.perks.export": "Advanced local export formats",
    "pricing.perks.early": "Early access to new features",
    "pricing.byok.note":
      "Online models are bring-your-own-key (BYOK). You use your own provider keys locally; no cloud credits are included in Pro.",
    "blog.title": "Blog & tutorials",
    "blog.subtitle": "Guides, tips, and product updates from the video2text team.",
    "blog.readMore": "Read more",
    "blog.backToBlog": "Back to blog",
    "blog.empty": "No posts yet — check back soon.",
    "docs.title": "Documentation",
    "docs.subtitle": "Learn how to install, configure, and get the most out of video2text.",
    "docs.onThisPage": "On this page",
    "docs.empty": "Documentation is being written. Check back soon.",
    "contact.title": "Get in touch",
    "contact.subtitle": "Found a bug or have a question? We would love to hear from you.",
    "contact.github.label": "GitHub repository",
    "contact.email.label": "Email",
    "contact.issues.label": "Report an issue",
    "footer.tagline": "Local, private transcription & summarization.",
    "footer.rights": "All rights reserved.",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",
    "footer.refund": "Refund",
    "footer.github": "GitHub",
    "common.loading": "Loading…",
    "common.error": "Something went wrong.",
    "common.backHome": "Back to home",
    "common.notFound": "Page not found",
    "common.notFound.desc": "The page you are looking for does not exist or has moved.",
    "common.langLabel": "Language",
    "auth.register.title": "Create your account",
    "auth.register.subtitle": "Sign up to activate and manage your video2text license.",
    "auth.register.emailLabel": "Email",
    "auth.register.passwordLabel": "Password",
    "auth.register.submit": "Create account",
    "auth.register.success": "Account created successfully.",
    "auth.register.errorRequired": "Please fill in all fields.",
    "auth.register.errorEmail": "Please enter a valid email address.",
    "auth.register.errorPassword": "Password must be at least 8 characters.",
    "auth.register.errorConflict": "An account with this email already exists.",
    "auth.register.errorGeneric": "Something went wrong. Please try again.",
    "auth.register.haveAccount": "Already have an account?",
    "auth.register.loginLink": "Sign in",
    "auth.login.title": "Sign in",
    "auth.login.subtitle": "Sign in to activate and manage your video2text license.",
    "auth.login.emailLabel": "Email",
    "auth.login.passwordLabel": "Password",
    "auth.login.submit": "Sign in",
    "auth.login.errorRequired": "Please fill in all fields.",
    "auth.login.errorCredentials": "Invalid email or password.",
    "auth.login.errorGeneric": "Something went wrong. Please try again.",
    "auth.login.noAccount": "No account yet?",
    "auth.login.registerLink": "Create one",
    "checkout.title": "Upgrade to Pro",
    "checkout.subtitle": "One-time purchase to unlock all Pro features.",
    "checkout.accountLabel": "Account",
    "checkout.payButton": "Complete payment (demo)",
    "checkout.success": "Payment successful",
    "checkout.keyLabel": "Your license key",
    "checkout.keyNote": "Copy this key and activate it in the video2text desktop app.",
    "checkout.copy": "Copy",
    "checkout.copied": "Copied",
    "checkout.logout": "Sign out",
    "changelog.title": "Changelog",
    "changelog.subtitle": "Release notes for video2text desktop.",
    "changelog.empty": "Release notes are not available right now.",
    "changelog.viewAll": "View all releases on GitHub",
  },
  zh: {
    "nav.features": "功能",
    "nav.docs": "文档",
    "nav.blog": "博客",
    "nav.pricing": "定价",
    "nav.contact": "联系",
    "nav.register": "注册",
    "lang.en": "English",
    "lang.zh": "中文",
    "cta.download": "下载",
    "cta.docs": "阅读文档",
    "cta.getStarted": "开始使用",
    "cta.learnMore": "了解更多",
    "cta.viewDocs": "查看文档",
    "hero.badge": "100% 本地离线 · 隐私优先",
    "hero.title": "本地、私密的音视频转写与总结",
    "hero.subtitle":
      "在您自己的电脑上把音视频转换成准确文本与智能总结。无需上传、无需云端、无需订阅。",
    "hero.ctaPrimary": "下载 Windows 版",
    "hero.ctaSecondary": "查看文档",
    "hero.note": "桌面端永久免费，Pro 版一次性买断升级。",
    "features.title": "一切都在你的设备上运行",
    "features.subtitle": "video2text 以隐私与性能为核心，文件永远不会离开你的电脑。",
    "features.local.title": "100% 本地离线",
    "features.local.desc": "音视频均在离线状态下处理，数据不出本机，适合敏感录音。",
    "features.gpu.title": "GPU 加速",
    "features.gpu.desc": "基于 faster-whisper 与 CUDA 加速，在受支持的独显上可大幅加快大文件转写。",
    "features.multilang.title": "多语言支持",
    "features.multilang.desc": "支持多语言转写与总结，并自动检测语言，无需手动切换。",
    "features.summary.title": "智能总结",
    "features.summary.desc":
      "使用本地大模型生成结构化总结，也可接入你自己的在线模型，把数小时音频浓缩成要点。",
    "features.models.title": "灵活的模型策略",
    "features.models.desc": "使用内置离线模型，或接入你自己的在线转写端点，按需选择。",
    "features.desktop.title": "桌面端 + CLI",
    "features.desktop.desc":
      "日常使用有友好的 Windows 图形界面，批处理与脚本化可用 CLI。一次购买多机可用。",
    "workflow.title": "五步完成从文件到总结",
    "workflow.subtitle": "一条完全本地的处理流水线。",
    "workflow.step1.title": "选择本地文件",
    "workflow.step1.desc": "从电脑中选择音视频文件，不会上传到任何地方。",
    "workflow.step2.title": "提取音频",
    "workflow.step2.desc": "应用在本地提取音轨用于转写。",
    "workflow.step3.title": "转写",
    "workflow.step3.desc": "faster-whisper 将语音转为文本，可选择 GPU 加速。",
    "workflow.step4.title": "总结",
    "workflow.step4.desc": "本地模型（或你自己的在线模型）生成结构化总结。",
    "workflow.step5.title": "导出",
    "workflow.step5.desc": "将结果保存为 txt、json、srt 等多种格式，即取即用。",
    "compare.title": "生来本地优先",
    "compare.col.local": "video2text（本地）",
    "compare.col.cloud": "云端转写 SaaS",
    "compare.row.privacy": "数据隐私",
    "compare.row.network": "网络依赖",
    "compare.row.cost": "成本",
    "compare.row.performance": "性能",
    "compare.row.models": "模型选择",
    "pricing.title": "简单的一次性定价",
    "pricing.subtitle": "桌面端永久免费，一次买断即可解锁进阶本地功能。",
    "pricing.free.name": "免费版",
    "pricing.free.tagline": "人人可用的本地转写",
    "pricing.pro.name": "Pro 版",
    "pricing.pro.tagline": "为重度用户而生",
    "pricing.pro.price": "$9.9 一次性",
    "pricing.faq.title": "常见问题",
    "pricing.faq.q1": "Pro 版包含什么？",
    "pricing.faq.a1":
      "Pro 版提供增强的批量与增量处理、优先支持、多设备激活（2 台）、进阶本地导出格式，以及新功能抢先体验。不包含开发者代付的云模型额度——在线模型采用 BYOK（用户自带 Key）。",
    "pricing.faq.q2": "如何付款？",
    "pricing.faq.a2":
      "收银台由 Paddle（全球商户托管方）提供，负责付款、开票与税务合规，无需自建支付。",
    "pricing.faq.q3": "退款政策如何？",
    "pricing.faq.a3": "我们提供 14 天退款窗口，详见退款政策。",
    "pricing.perks.batch": "增强的批量与增量处理",
    "pricing.perks.support": "优先支持",
    "pricing.perks.devices": "最多 2 台设备激活",
    "pricing.perks.export": "进阶本地导出格式",
    "pricing.perks.early": "新功能抢先体验",
    "pricing.byok.note":
      "在线模型为自带 Key（BYOK）。你在本机使用自己的服务商密钥，Pro 不含任何云额度。",
    "blog.title": "博客与教程",
    "blog.subtitle": "来自 video2text 团队的指南、技巧与产品动态。",
    "blog.readMore": "阅读全文",
    "blog.backToBlog": "返回博客",
    "blog.empty": "暂无文章，敬请期待。",
    "docs.title": "文档",
    "docs.subtitle": "了解如何安装、配置并充分利用 video2text。",
    "docs.onThisPage": "本页目录",
    "docs.empty": "文档正在撰写中，敬请期待。",
    "contact.title": "联系我们",
    "contact.subtitle": "遇到问题或有疑问？欢迎与我们联系。",
    "contact.github.label": "GitHub 仓库",
    "contact.email.label": "邮箱",
    "contact.issues.label": "提交问题",
    "footer.tagline": "本地、私密的音视频转写与总结。",
    "footer.rights": "保留所有权利。",
    "footer.privacy": "隐私政策",
    "footer.terms": "服务条款",
    "footer.refund": "退款政策",
    "footer.github": "GitHub",
    "common.loading": "加载中…",
    "common.error": "出错了。",
    "common.backHome": "返回首页",
    "common.notFound": "页面未找到",
    "common.notFound.desc": "你访问的页面不存在或已移动。",
    "common.langLabel": "语言",
    "auth.register.title": "创建账户",
    "auth.register.subtitle": "注册以激活并管理你的 video2text 授权。",
    "auth.register.emailLabel": "邮箱",
    "auth.register.passwordLabel": "密码",
    "auth.register.submit": "创建账户",
    "auth.register.success": "账户创建成功。",
    "auth.register.errorRequired": "请填写所有字段。",
    "auth.register.errorEmail": "请输入有效的邮箱地址。",
    "auth.register.errorPassword": "密码至少需要 8 个字符。",
    "auth.register.errorConflict": "该邮箱已被注册。",
    "auth.register.errorGeneric": "出错了，请重试。",
    "auth.register.haveAccount": "已有账户？",
    "auth.register.loginLink": "登录",
    "auth.login.title": "登录",
    "auth.login.subtitle": "登录以激活并管理你的 video2text 授权。",
    "auth.login.emailLabel": "邮箱",
    "auth.login.passwordLabel": "密码",
    "auth.login.submit": "登录",
    "auth.login.errorRequired": "请填写所有字段。",
    "auth.login.errorCredentials": "邮箱或密码错误。",
    "auth.login.errorGeneric": "出错了，请重试。",
    "auth.login.noAccount": "还没有账户？",
    "auth.login.registerLink": "立即注册",
    "checkout.title": "升级到 Pro",
    "checkout.subtitle": "一次性买断，解锁 Pro 全部功能。",
    "checkout.accountLabel": "当前账号",
    "checkout.payButton": "完成支付（模拟）",
    "checkout.success": "支付成功",
    "checkout.keyLabel": "你的授权密钥",
    "checkout.keyNote": "复制此密钥，在 video2text 桌面端中激活。",
    "checkout.copy": "复制",
    "checkout.copied": "已复制",
    "checkout.logout": "退出登录",
    "changelog.title": "更新日志",
    "changelog.subtitle": "video2text 桌面端发布说明。",
    "changelog.empty": "暂时无法获取发布说明。",
    "changelog.viewAll": "在 GitHub 查看全部发布",
  },
};
