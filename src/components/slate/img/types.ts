export type ImageAlign = "left" | "center" | "right";

export type ImageElement = {
  type: "image";
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  align?: ImageAlign;
  /** Set while the file is uploading; `url` is a local preview until then. */
  uploadId?: string;
  children: [{ text: "" }];
};

export const DEFAULT_IMAGE_ALIGN: ImageAlign = "center";
export const MIN_IMAGE_WIDTH = 96;
export const MAX_IMAGE_WIDTH = 920;
