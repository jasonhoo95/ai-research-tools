"use client"

type Pdfjs = typeof import("pdfjs-dist")

let loading: Promise<Pdfjs> | null = null

/**
 * pdf.js, loaded on first use (browser only — it needs DOM APIs) with its
 * worker bundled from the package.
 */
export function loadPdfjs(): Promise<Pdfjs> {
  loading ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString()
    return pdfjs
  })
  return loading
}
