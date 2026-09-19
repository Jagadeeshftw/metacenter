import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { source, gitConfig } from "@/lib/docs/source";
import { getMDXComponents } from "@/components/docs/mdx";

// Sections are rendered as sidebar headings (not folders), so breadcrumbs are built here.
const SECTIONS: Record<string, string> = {
  concepts: "Concepts",
  metrics: "Metrics",
  contracts: "Contracts",
  api: "API",
  integrate: "Integrate",
  verification: "Verification",
  resources: "Resources",
};

export const revalidate = 60;

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;
  const editUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/web/content/docs/${page.path}`;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full} breadcrumb={{ enabled: false }}>
      <nav aria-label="Breadcrumb" className="-mb-2 flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground">
        <Link href="/docs" className="hover:text-fd-foreground">
          Docs
        </Link>
        <span aria-hidden="true">/</span>
        <span>{SECTIONS[params.slug?.[0] ?? ""] ?? "Welcome"}</span>
        <span aria-hidden="true">/</span>
        <span className="text-fd-foreground">{page.data.title}</span>
      </nav>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
      <EditOnGitHub href={editUrl} />
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const path = `/docs${params.slug?.length ? `/${params.slug.join("/")}` : ""}`;
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: path },
    openGraph: { url: path },
  };
}
