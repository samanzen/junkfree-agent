import { redirect } from "next/navigation";

// The platform's front door: opening the site root takes you straight to the
// mission-control dashboard (no need to type /dashboard).
export default function Home() {
  redirect("/dashboard");
}
