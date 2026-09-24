export type LinkText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
};

export type LinkElement = {
  type: "link";
  url: string;
  children: LinkText[];
};
