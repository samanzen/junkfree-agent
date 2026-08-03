"use client";

// Pill sub-navigation used inside a section page (Intelligence, Local SEO,
// Website, Content, Reports...). Purely presentational; the page owns state.
export default function SubNav<T extends string>({ items, value, onChange }: {
  items: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="p-subnav" role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={value === it.key}
          className={`p-subnav-btn ${value === it.key ? "on" : ""}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
          {it.count != null && <span className="p-subnav-count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
