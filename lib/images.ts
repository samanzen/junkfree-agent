// AI image generation via Google's Nano Banana (gemini-2.5-flash-image).
// Generates a realistic, post-specific header image for blog posts and pages,
// uploads it to Supabase Storage, and returns a public URL.
//
// Needs GEMINI_API_KEY. If unset, image steps are skipped silently.

import { db } from "./supabase";
import type { Brand } from "./brands";

const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// Turn a post topic into a clean, realistic image prompt (no text-in-image,
// no logos, photo-real, relevant to the local service).
function imagePrompt(brand: Brand, topic: string) {
  return `Photorealistic, high-quality horizontal header photo for a local ${
    brand.services?.split(",")[0] || "service"
  } business blog post about "${topic}". Realistic lighting, professional, clean composition, no text, no watermarks, no logos, no readable signage. Canadian suburban/residential context.`;
}

// Generate one image, return { base64, mime } or null.
async function generate(brand: Brand, topic: string): Promise<{ data: string; mime: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const res = await fetch(ENDPOINT(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt(brand, topic) }] }],
    }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData);
  if (!img) return null;
  return { data: img.inlineData.data, mime: img.inlineData.mimeType || "image/png" };
}

// Generate + store in Supabase Storage bucket 'blog-images'. Returns public URL.
export async function generateAndStore(brand: Brand, topic: string, slug: string): Promise<string | null> {
  const img = await generate(brand, topic);
  if (!img) return null;

  const bytes = Buffer.from(img.data, "base64");
  const ext = img.mime.includes("jpeg") ? "jpg" : "png";
  const path = `${brand.slug}/${slug}-${Date.now()}.${ext}`;

  const up = await db.storage.from("blog-images").upload(path, bytes, {
    contentType: img.mime,
    upsert: true,
  });
  if (up.error) return null;

  const { data } = db.storage.from("blog-images").getPublicUrl(path);
  return data.publicUrl || null;
}
