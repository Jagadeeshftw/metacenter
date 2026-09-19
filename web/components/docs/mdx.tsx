import defaultMdxComponents from "fumadocs-ui/mdx";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { MDXComponents } from "mdx/types";
import { ApiExample, AsOf, Deployments, Fn, Metric, Pox5, Recompute, Stress } from "./live";
import { ProvenanceTag } from "@/components/shared/provenance";
import { site } from "@/lib/site";

function XLink() {
  return site.xUrl ? <a href={site.xUrl}>X: {site.xUrl.replace("https://x.com/", "@")}</a> : <span>X: handle not published yet</span>;
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout,
    Card,
    Cards,
    Step,
    Steps,
    Tab,
    Tabs,
    Metric,
    AsOf,
    Deployments,
    ApiExample,
    Recompute,
    Stress,
    Fn,
    Pox5,
    Tag: ProvenanceTag,
    XLink,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;
