"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";

type Activity = {
  days: number;
  summary: {
    pages_published: number;
    drafts_published: number;
    google_posts: number;
    keywords_touched: number;
    agent_runs: number;
    successful_runs: number;
    by_type: Record<string, number>;
  };
  published_pages: { slug: string; title: string; published_at: string }[];
  published_drafts: {
    id: string;
    title: string;
    task_type: string;
    target_keyword: string | null;
    created_at: string;
  }[];
  keywords_worked: {
    keyword: string;
    best_position: number | null;
    status: string;
    search_volume: number | null;
  }[];
};

const TYPE_LABEL: Record<string, string> = {
  new_page: "New pages",
  new_blog: "Blog posts",
  improve_content: "Content rewrites",
  fix_meta: "Meta updates",
  geo_answers: "AI FAQ / answers",
};

export default function ActivityReport({ brandId, days = 30 }: { brandId: string; days?: number }) {
  const [data, setData] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    authedFetch(`/api/intelligence/activity?brand=${brandId}&days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, days]);

  if (loading) return <div className="act-loading">Gathering what the AI shipped…</div>;
  if (!data) return <div className="act-empty">Couldn’t load AI activity for this period.</div>;

  const s = data.summary;

  return (
    <div className="act">
      <div className="act-hero">
        <div className="act-hero-card c1">
          <div className="act-hero-n">{s.pages_published}</div>
          <div className="act-hero-l">Pages published</div>
        </div>
        <div className="act-hero-card c2">
          <div className="act-hero-n">{s.drafts_published}</div>
          <div className="act-hero-l">Drafts the AI finished</div>
        </div>
        <div className="act-hero-card c3">
          <div className="act-hero-n">{s.keywords_touched}</div>
          <div className="act-hero-l">Keywords worked on</div>
        </div>
        <div className="act-hero-card c4">
          <div className="act-hero-n">{s.successful_runs}</div>
          <div className="act-hero-l">Successful agent runs</div>
        </div>
      </div>

      {Object.keys(s.by_type).length > 0 && (
        <div className="act-types">
          <h3>What the AI produced</h3>
          <div className="act-type-row">
            {Object.entries(s.by_type).map(([k, n]) => (
              <div key={k} className="act-type-chip">
                <strong>{n}</strong> {TYPE_LABEL[k] || k}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="act-cols">
        <section className="act-panel teal">
          <h3>Published pages</h3>
          {data.published_pages.length === 0 ? (
            <p className="act-muted">No new pages went live in this period.</p>
          ) : (
            <ul>
              {data.published_pages.map((p) => (
                <li key={p.slug}>
                  <strong>{p.title || p.slug}</strong>
                  <span>{new Date(p.published_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="act-panel violet">
          <h3>Keywords the AI is working</h3>
          {data.keywords_worked.length === 0 ? (
            <p className="act-muted">No keyword status changes logged yet.</p>
          ) : (
            <ul>
              {data.keywords_worked.slice(0, 15).map((k) => (
                <li key={k.keyword}>
                  <strong>{k.keyword}</strong>
                  <span>
                    {k.best_position != null ? `#${k.best_position}` : "—"} · {k.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="act-panel amber">
        <h3>Recent AI publications</h3>
        {data.published_drafts.length === 0 ? (
          <p className="act-muted">Nothing published in this window yet — approve items in AI Recommendations.</p>
        ) : (
          <ul className="act-pub-list">
            {data.published_drafts.map((d) => (
              <li key={d.id}>
                <span className="act-badge">{TYPE_LABEL[d.task_type] || d.task_type}</span>
                <div>
                  <strong>{d.title}</strong>
                  {d.target_keyword && <em> · {d.target_keyword}</em>}
                </div>
                <span className="act-date">{new Date(d.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
