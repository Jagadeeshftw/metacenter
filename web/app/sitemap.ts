import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const PATHS = ["/", "/dashboard", "/dashboard/coverage", "/dashboard/bonds", "/dashboard/reserve", "/dashboard/yield", "/dashboard/stress", "/methodology", "/api-reference"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${site.url}${p === "/" ? "" : p}`, changeFrequency: p === "/" ? "weekly" : "hourly", priority: p === "/" ? 1 : 0.7 }));
}
