// Best-effort extraction of job details from a posting's HTML.
// Most ATS pages (Greenhouse, Lever, Workday, Ashby, many careers sites)
// embed schema.org JobPosting JSON-LD, which is the most reliable source.

export type ParsedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  salary: string;
};

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|ul|ol|tr)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function meta(html: string, prop: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  return decodeEntities(html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "");
}

type LD = Record<string, unknown>;

function findJobPosting(node: unknown): LD | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findJobPosting(n);
      if (f) return f;
    }
    return null;
  }
  const o = node as LD;
  const t = o["@type"];
  if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) return o;
  if (o["@graph"]) return findJobPosting(o["@graph"]);
  return null;
}

function ldLocation(loc: unknown): string {
  const list = Array.isArray(loc) ? loc : [loc];
  return list
    .map((l) => {
      const a = (l as LD)?.address as LD | undefined;
      if (!a) return "";
      return [a.addressLocality, a.addressRegion, a.addressCountry]
        .map((x) => (typeof x === "object" && x ? (x as LD).name : x))
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean)
    .join(" / ");
}

function ldSalary(s: unknown): string {
  const o = s as LD | undefined;
  const v = o?.value as LD | undefined;
  if (!v) return "";
  const range = v.minValue && v.maxValue ? `${v.minValue}–${v.maxValue}` : String(v.value ?? "");
  return [o?.currency, range, v.unitText].filter(Boolean).join(" ");
}

export function parseJobHtml(html: string, url: string): ParsedJob {
  const out: ParsedJob = { title: "", company: "", location: "", description: "", salary: "" };

  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const jp = findJobPosting(JSON.parse(m[1].trim()));
      if (jp) {
        out.title = String(jp.title ?? "");
        const org = jp.hiringOrganization as LD | string | undefined;
        out.company = typeof org === "string" ? org : String(org?.name ?? "");
        out.location = ldLocation(jp.jobLocation) || (jp.jobLocationType === "TELECOMMUTE" ? "Remote" : "");
        out.description = htmlToText(decodeEntities(String(jp.description ?? "")));
        out.salary = ldSalary(jp.baseSalary);
        break;
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }

  const ogTitle = meta(html, "og:title");
  const pageTitle = decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();

  if (!out.title || !out.company) {
    // LinkedIn guest page: "Acme hiring Product Designer in Bengaluru, Karnataka, India | LinkedIn"
    const li = (ogTitle || pageTitle).match(/^(.+?) hiring (.+?)(?: in (.+?))?(?: \| LinkedIn)?$/i);
    if (li && url.includes("linkedin.")) {
      out.company ||= li[1].trim();
      out.title ||= li[2].trim();
      out.location ||= (li[3] ?? "").trim();
    }
  }
  if (!out.description && url.includes("linkedin.")) {
    const block = html.match(/<div[^>]+class=["'][^"']*show-more-less-html__markup[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (block) out.description = htmlToText(block[1]);
  }
  if (!out.title) out.title = (ogTitle || pageTitle).split(/ [|\-–] /)[0].trim();
  if (!out.company) out.company = meta(html, "og:site_name");
  if (!out.description) out.description = meta(html, "og:description") || meta(html, "description");

  out.description = out.description.slice(0, 15000);
  return out;
}
