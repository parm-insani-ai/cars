import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "rep" || user.role === "bdc") redirect(`/rep/${user.id}`);
  redirect("/manager");
}
