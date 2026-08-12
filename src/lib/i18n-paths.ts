import type { GetStaticPaths } from "astro";
import type { Lang } from "../i18n/ui";

const LANGS: Lang[] = ["en", "zh"];

// 供各静态页面复用的 getStaticPaths：为每种语言生成一个页面，
// 并把当前语言作为 props.lang 透传给页面组件。
export const getStaticPaths = (async () => {
  return LANGS.map((lang) => ({ params: { lang }, props: { lang } }));
}) satisfies GetStaticPaths;
