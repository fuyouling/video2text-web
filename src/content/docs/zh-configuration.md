---
title: 配置说明
lang: zh
order: 2
description: 配置模型、API Key 与 GPU 设置。
---

## 模型

video2text 内置离线模型，你也可以使用自带 Key 接入在线转写端点（BYOK）。

## GPU

在受支持的独立显卡存在时，GPU 加速使用 CUDA；否则自动回退 CPU。

## 在线模型（BYOK）

在线模型为自带 Key（BYOK），密钥仅保存在你本机，不会上传给我们。
