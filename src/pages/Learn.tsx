import { ArrowLeft, Clock, Link2, Search, Share2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader, SampleNotice, Thumb } from "../components/ui";
import { ARTICLES, relatedArticles, trendingTags, type Article, type ArticleScope } from "../data/articles";

const SCOPES: Array<ArticleScope | "All"> = ["All", "Global", "Nigeria", "Prevention"];
const SCOPE_LABEL: Record<ArticleScope | "All", string> = { All: "All", Global: "🌍 Global", Nigeria: "🇳🇬 Nigeria", Prevention: "🛡️ Prevention tips" };

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

function ArticleMeta({ a }: { a: Article }) {
  return (
    <div className="food-row-top">
      <span className="tag tag-breakfast">{a.topic}</span>
      <span className="muted small row" style={{ gap: "0.25rem" }}><Clock size={13} aria-hidden /> {a.readMinutes} min · {dateLabel(a.published)}</span>
    </div>
  );
}

export function Learn() {
  const [scope, setScope] = useState<ArticleScope | "All">("All");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const items = ARTICLES.filter(
    (a) =>
      (scope === "All" || a.scope === scope) &&
      (!tag || a.tags.includes(tag)) &&
      (!q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q))),
  );
  const filtering = scope !== "All" || !!tag || !!q;
  const featured = items.find((a) => a.featured) ?? items[0];
  const popular = items.filter((a) => a !== featured).slice(0, 3);
  const rest = filtering ? items.filter((a) => a !== featured) : items.filter((a) => a !== featured && !popular.includes(a));

  return (
    <div className="page page-aside">
      <section className="insights-hero">
        <h1>Healthy Insights</h1>
        <p className="muted">Nutrition news, local food wisdom and prevention tips — reviewed by dietitians.</p>
        <label className="search-box insights-search">
          <Search size={18} aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search articles" aria-label="Search articles" />
        </label>
        <div className="chip-group chip-scroll" role="group" aria-label="Filter">
          {SCOPES.map((s) => (
            <button key={s} className={`chip${s === scope ? " on" : ""}`} onClick={() => setScope(s)}>{SCOPE_LABEL[s]}</button>
          ))}
        </div>
      </section>

      <div className="with-aside">
        <div>
          {tag && (
            <div className="row" style={{ marginBottom: "0.75rem" }}>
              <span className="muted small">Tag:</span>
              <button className="chip chip-outline on" onClick={() => setTag(null)}>#{tag} ✕</button>
            </div>
          )}
          {!featured ? (
            <div className="empty-meal muted">No articles match. Try another search.</div>
          ) : (
            <>
              <div className="section-title"><h2>Featured article</h2></div>
              <Link to={`/learn/${featured.id}`} className="card featured-article">
                <Thumb emoji={featured.emoji} size="lg" photo={`article:${featured.id}`} />
                <div>
                  <ArticleMeta a={featured} />
                  <h2 className="featured-article-title">{featured.title}</h2>
                  <p className="muted">{featured.summary}</p>
                  <span className="author"><span className="author-dot" aria-hidden>N</span> Kalorax editorial</span>
                </div>
              </Link>

              {popular.length > 0 && !filtering && (
                <>
                  <div className="section-title"><h2>Popular insights</h2></div>
                  <ul className="food-rows">
                    {popular.map((a) => (
                      <li key={a.id}>
                        <Link to={`/learn/${a.id}`} className="food-row">
                          <Thumb emoji={a.emoji} photo={`article:${a.id}`} />
                          <div className="food-row-body">
                            <ArticleMeta a={a} />
                            <strong>{a.title}</strong>
                            <span className="muted small">{a.summary}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {rest.length > 0 && (
                <>
                  <div className="section-title"><h2>{filtering ? "More results" : "Recommended"}</h2></div>
                  <div className="card-grid">
                    {rest.map((a) => (
                      <Link key={a.id} to={`/learn/${a.id}`} className="card mini-article">
                        <Thumb emoji={a.emoji} size="lg" photo={`article:${a.id}`} />
                        <span className="tag tag-breakfast">{a.topic}</span>
                        <strong>{a.title}</strong>
                        <span className="muted small">{dateLabel(a.published)}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <aside className="aside">
          <div className="section-title"><h2>Trending tags</h2></div>
          <div className="card">
            <ul className="tag-list">
              {trendingTags().slice(0, 10).map((t) => (
                <li key={t.tag}>
                  <button className={`tag-link${tag === t.tag ? " on" : ""}`} onClick={() => setTag(tag === t.tag ? null : t.tag)}>
                    #{t.tag.replace(/\s+/g, "")}
                  </button>
                  <span className="muted small">{t.count} post{t.count === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          </div>
          <SampleNotice>Articles are sample content until Kalorax's dietitians publish reviewed pieces.</SampleNotice>
        </aside>
      </div>
    </div>
  );
}

export function ArticlePage() {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);
  const a = ARTICLES.find((x) => x.id === id);
  if (!a) return <div className="page"><p>Article not found. <Link to="/learn">Back to Insights</Link></p></div>;
  const url = window.location.href;
  const shareText = encodeURIComponent(`${a.title} — ${url}`);

  return (
    <div className="page page-aside">
      <Link to="/learn" className="btn btn-ghost btn-small"><ArrowLeft size={16} /> Back to Insights</Link>
      <PageHeader title="Insight details" />
      <div className="with-aside">
        <article className="card article">
          <ArticleMeta a={a} />
          <h1>{a.title}</h1>
          <div className="row" style={{ marginBottom: "1rem" }}>
            <span className="author"><span className="author-dot" aria-hidden>N</span> Kalorax editorial</span>
            <span className="badge badge-ok"><ShieldCheck size={13} aria-hidden /> Dietitian review pending</span>
          </div>
          <Thumb emoji={a.emoji} size="lg" photo={`article:${a.id}`} />
          <p className="lead">{a.summary}</p>
          {a.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="muted small">{a.source}</p>
        </article>

        <aside className="aside">
          <div className="card">
            <h2>Share</h2>
            <div className="row" style={{ marginTop: "0.75rem" }}>
              <a className="btn btn-primary btn-small" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">
                <Share2 size={15} /> WhatsApp
              </a>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => {
                  navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
                }}
              >
                <Link2 size={15} /> {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <h3>Tags</h3>
            <div className="nchips">{a.tags.map((t) => <span key={t} className="nchip">#{t}</span>)}</div>
          </div>
          <div className="section-title"><h2>Related articles</h2></div>
          <ul className="food-rows">
            {relatedArticles(a).map((r) => (
              <li key={r.id}>
                <Link to={`/learn/${r.id}`} className="food-row">
                  <Thumb emoji={r.emoji} size="sm" photo={`article:${r.id}`} />
                  <div className="food-row-body">
                    <strong className="small">{r.title}</strong>
                    <span className="muted small">{r.topic}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
