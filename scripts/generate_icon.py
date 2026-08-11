#!/usr/bin/env python3
"""
video2text-web 静态资源生成器。

所有图片资源（favicon、Logo、OG 图、社交卡、占位图）由程序生成，
保证风格一致、可复现。依赖 Pillow，使用系统字体或内嵌字体文件。

用法:  python scripts/generate_icon.py
输出:   public/ 下的各类图片资源。
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from typing import Tuple, Union

from PIL import Image, ImageDraw, ImageFont

Color = Union[str, Tuple[int, int, int]]

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))

# 品牌色
BRAND_DARK = (55, 48, 130)     # brand-800
BRAND = (99, 102, 245)         # brand-500
WHITE = (255, 255, 255)
SLATE_100 = (241, 245, 255)
SLATE_800 = (33, 41, 55)


def _font(size: float, weight: str = "semibold") -> "ImageFont.FreeTypeFont":
    """加载字体：优先系统字体，回退 Pillow 默认字体。"""
    candidates = [
        # Windows
        "C:/Windows/Fonts/arialbd.ttf" if weight == "bold" else "C:/Windows/Fonts/arial.ttf",
        # 跨平台回退
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if weight == "bold" else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, int(size))
    return ImageFont.load_default()


@dataclass
class ImageSpec:
    """每个图片的独立参数。"""
    name: str
    width: int
    height: int
    bg_color: Color = WHITE
    fg_color: Color = BRAND
    text: str = "video2text"
    subtitle: str = ""
    font_path: str = ""
    output: str = ""  # 相对 public/
    corner_radius: int = 32


def _rounded_rect(size, radius):
    """返回一个圆角矩形蒙版。"""
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def render(spec: ImageSpec) -> Image.Image:
    """通用绘制：圆角背景 + 居中标题/副标题，被下例方法复用。"""
    img = Image.new("RGBA", (spec.width, spec.height), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    radius = min(spec.corner_radius, min(spec.width, spec.height) // 2)
    bg = Image.new("RGBA", (spec.width, spec.height), spec.bg_color)
    bg.putalpha(_rounded_rect((spec.width, spec.height), radius))
    img.alpha_composite(bg)

    title_font = _font(max(20, min(spec.width, spec.height) // 6), "bold")
    sub_font = _font(max(12, min(spec.width, spec.height) // 10), "normal")

    tw, th = draw.textlength(spec.text, font=title_font), title_font.size
    sw, sh = draw.textlength(spec.subtitle, font=sub_font), sub_font.size
    y = (spec.height - (th + (sh if spec.subtitle else 0))) / 2

    draw.text(
        ((spec.width - tw) / 2, y),
        spec.text,
        font=title_font,
        fill=spec.fg_color,
        anchor="la",
    )
    if spec.subtitle:
        draw.text(
            ((spec.width - sw) / 2, y + th + 8),
            spec.subtitle,
            font=sub_font,
            fill=spec.fg_color,
            anchor="la",
        )
    return img


def generate_favicon(spec: ImageSpec) -> None:
    """生成多尺寸 PNG + .ico favicon。"""
    out_dir = os.path.join(BASE, os.path.dirname(spec.output) or ".")
    os.makedirs(out_dir, exist_ok=True)
    base = render(spec)
    sizes = [16, 32, 64, 128, 256]
    frames = [base.resize((s, s), Image.LANCZOS) for s in sizes]
    frames[3].save(os.path.join(BASE, spec.output), "PNG")
    # .ico
    ico_path = os.path.join(out_dir, "favicon.ico")
    frames[-1].save(ico_path, "ICO")


def generate_logo(spec: ImageSpec) -> None:
    out = os.path.join(BASE, spec.output)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    render(spec).save(out, "PNG")


def generate_og_image(spec: ImageSpec) -> None:
    out = os.path.join(BASE, spec.output)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    render(spec).save(out, "PNG")


def generate_social_card(spec: ImageSpec) -> None:
    generate_og_image(spec)


def generate_placeholder(spec: ImageSpec) -> None:
    out = os.path.join(BASE, spec.output)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    render(spec).save(out, "PNG")


SPECS: list[ImageSpec] = [
    ImageSpec(
        name="favicon",
        width=64,
        height=64,
        bg_color=BRAND,
        fg_color=WHITE,
        text="V",
        output="favicon-64.png",
        corner_radius=12,
    ),
    ImageSpec(
        name="og/home",
        width=1200,
        height=630,
        bg_color=BRAND_DARK,
        fg_color=WHITE,
        text="video2text",
        subtitle="Local, private transcription & summarization",
        output="og/home.png",
        corner_radius=48,
    ),
    ImageSpec(
        name="og/pricing",
        width=1200,
        height=630,
        bg_color=BRAND_DARK,
        fg_color=WHITE,
        text="video2text Pro",
        subtitle="One-time $9.9 · Local & private",
        output="og/pricing.png",
        corner_radius=48,
    ),
    ImageSpec(
        name="logo",
        width=200,
        height=200,
        bg_color=WHITE,
        fg_color=BRAND,
        text="video2text",
        output="images/logo.png",
        corner_radius=40,
    ),
    ImageSpec(
        name="placeholder/download",
        width=1100,
        height=560,
        bg_color=SLATE_100,
        fg_color=SLATE_800,
        text="video2text screenshot",
        subtitle="(real screenshot coming soon)",
        output="images/placeholder-download.png",
        corner_radius=24,
    ),
]


def main() -> None:
    os.makedirs(BASE, exist_ok=True)
    dispatch = {
        "favicon": generate_favicon,
        "og/home": generate_og_image,
        "og/pricing": generate_og_image,
        "logo": generate_logo,
        "placeholder/download": generate_placeholder,
        "social": generate_social_card,
    }
    for spec in SPECS:
        fn = dispatch.get(spec.name, generate_placeholder)
        fn(spec)
        print(f"generated: {spec.output}")


if __name__ == "__main__":
    main()
