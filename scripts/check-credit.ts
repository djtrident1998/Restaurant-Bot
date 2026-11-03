// Guards the creator credit: the name and links exist, are well-formed, and appear where recruiters will look.
import fs from "node:fs";
import path from "node:path";
import { CREATOR_GITHUB, CREATOR_NAME, REPO_URL, creatorLinkedIn, docUrl } from "../lib/site";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};
const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

check("creator name", CREATOR_NAME === "Dibyajyoti Ray");
check("links are https and on github.com", CREATOR_GITHUB.startsWith("https://github.com/") && REPO_URL.startsWith(`${CREATOR_GITHUB}/`));
check("doc links point into the repo", docUrl("PRD.md") === `${REPO_URL}/blob/main/docs/PRD.md`);

// LinkedIn is optional and only a real linkedin.com address is accepted
check("no LinkedIn by default", creatorLinkedIn(env({})) === "");
check("valid LinkedIn accepted", creatorLinkedIn(env({ NEXT_PUBLIC_LINKEDIN_URL: "https://www.linkedin.com/in/dibyajyoti-ray" })) === "https://www.linkedin.com/in/dibyajyoti-ray");
check("non-LinkedIn address ignored", creatorLinkedIn(env({ NEXT_PUBLIC_LINKEDIN_URL: "https://evil.example.com/in/x" })) === "");
check("look-alike host ignored", creatorLinkedIn(env({ NEXT_PUBLIC_LINKEDIN_URL: "https://linkedin.com.evil.io/in/x" })) === "");
check("http (not https) ignored", creatorLinkedIn(env({ NEXT_PUBLIC_LINKEDIN_URL: "http://www.linkedin.com/in/x" })) === "");
check("javascript: URL ignored", creatorLinkedIn(env({ NEXT_PUBLIC_LINKEDIN_URL: "javascript:alert(1)" })) === "");

// the credit really is wired into the places a visitor sees
check("footer credit component names the creator", /CREATOR_NAME/.test(src("components/Credit.tsx")) && /\/about/.test(src("components/Credit.tsx")));
check("landing page footer shows the credit", /<Credit/.test(src("app/page.tsx")));
check("landing header links to About", /href="\/about"/.test(src("components/LandingHeader.tsx")) && /href="\/about"/.test(src("components/SiteHeader.tsx")));
check("legal/about pages, account, sign-in and order rail show the credit", ["components/LegalPage.tsx", "app/account/page.tsx", "components/AuthShell.tsx", "components/Chat.tsx"].every((f) => /<Credit/.test(src(f))));
check("page metadata names the author", /authors:/.test(src("app/layout.tsx")) && /creator: CREATOR_NAME/.test(src("app/layout.tsx")));
check("share image carries the credit", /CREATOR_NAME/.test(src("app/opengraph-image.tsx")));
check("structured data names the creator", /creator:/.test(src("app/page.tsx")));
check("About page links the PRD (PDF and Markdown), the one document that covers the rest", /Spice-Route-PRD\.pdf/.test(src("app/about/page.tsx")) && /PRD\.md/.test(src("app/about/page.tsx")) && !/EVAL_REPORT\.md|GUARDRAILS\.md|COST_FRAMEWORK\.md|GLOBAL_STANDARD\.md/.test(src("app/about/page.tsx")));
check("About page is in the sitemap", /\/about/.test(src("app/sitemap.ts")));
check("README credits the creator", /Dibyajyoti Ray/.test(src("README.md")));

console.log(fails ? `\n${fails} FAILED` : "\nAll creator-credit checks passed");
process.exit(fails ? 1 : 0);
