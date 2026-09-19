// Docs search (⌘K). An app route, so it takes precedence over the /api/* proxy rewrite.
import { source } from "@/lib/docs/source";
import { createFromSource } from "fumadocs-core/search/server";

export const { GET } = createFromSource(source);
