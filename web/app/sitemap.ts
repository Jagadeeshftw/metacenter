import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { source } from "@/lib/docs/source";

const PATHS = ["/", "/dashboard", "/dashboard/coverage", "/dashboard/bonds", "/dashboard/reserve", "/dashboard/yield", "/dashboard/stress", "/methodology", "/api-reference"];

export default function sitemap(): MetadataRoute.Sitemap {
  const app = PATHS.map((p) => ({ url: `${site.url}${p === "/" ? "" : p}`, changeFrequency: p === "/" ? ("weekly" as const) : ("hourly" as const), priority: p === "/" ? 1 : 0.7 }));
  const docs = source.getPages().map((page) => ({ url: `${site.url}${page.url}`, changeFrequency: "daily" as const, priority: 0.6 }));
  return [...app, ...docs];
}
