// Shared shape for writing published rows into `content`.

export function contentPublishFields(input: {
  slug: string;
  brandId: string;
  title: string;
  body: string;
  metaDescription?: string | null;
  publishedAt?: string;
}) {
  const now = input.publishedAt || new Date().toISOString();
  return {
    slug: input.slug,
    brand_id: input.brandId,
    title: input.title,
    body: input.body,
    meta_description: input.metaDescription?.trim() || null,
    published_at: now,
    updated_at: now,
  };
}
