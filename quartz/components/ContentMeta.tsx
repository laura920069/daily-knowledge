import { Date, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"

interface ContentMetaOptions {
  /**
   * Whether to display reading time
   */
  showReadingTime: boolean
  showComma: boolean
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: true,
  showComma: true,
}

export default ((opts?: Partial<ContentMetaOptions>) => {
  // Merge options with defaults
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    const text = fileData.text

    if (text) {
      const segments: (string | JSX.Element)[] = []

      if (fileData.dates) {
        segments.push(<Date date={getDate(cfg, fileData)!} locale={cfg.locale} />)
      }

      // 閱讀時間：中文以每分鐘約 400 字估算；有「快速導讀」的文章分開標示
      if (options.showReadingTime) {
        const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length
        const latinWords = readingTime(text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ")).words
        const minutes = Math.max(1, Math.ceil(cjk / 400 + latinWords / 220))
        if (text.includes("快速導讀")) {
          segments.push(<span>⚡ 快速導讀 1 分鐘｜📖 完整閱讀 {minutes} 分鐘</span>)
        } else {
          segments.push(<span>閱讀約 {minutes} 分鐘</span>)
        }
      }

      return (
        <p show-comma={options.showComma} class={classNames(displayClass, "content-meta")}>
          {segments}
        </p>
      )
    } else {
      return null
    }
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
