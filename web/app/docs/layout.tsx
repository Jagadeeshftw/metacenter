import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source, gitConfig } from "@/lib/docs/source";
import { Wordmark } from "@/components/shared/wordmark";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // the site's ThemeProvider (root layout) already manages dark/light
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout
        tree={source.getPageTree()}
        nav={{ title: <Wordmark />, url: "/" }}
        githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
        links={[
          { text: "Dashboard", url: "/dashboard" },
          { text: "API", url: "/api-reference" },
        ]}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
