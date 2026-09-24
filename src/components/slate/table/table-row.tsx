"use client";

import { cn } from "@/lib/utils";

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

export function TableRow({ children, className }: TableRowProps) {
  return (
    <tr contentEditable={false} className={cn(className)}>
      {children}
    </tr>
  );
}
