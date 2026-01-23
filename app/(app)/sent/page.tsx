import { redirect } from "next/navigation";

export default function SentPage() {
  redirect("/dashboard?tab=sent");
}
