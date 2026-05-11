import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { KnowledgeEditor } from "./KnowledgeEditor";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const user = await requireUser();
  const articles = await prisma.knowledgeArticle.findMany({
    where: { businessId: user.businessId },
    orderBy: { title: "asc" },
  });
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Knowledge base</h1>
        <p className="text-xs text-ink-muted">The agent reads these to answer caller questions (financing, hours, parking, policies…). Keep each one focused.</p>
      </div>
      <KnowledgeEditor
        articles={articles.map(a => ({ id: a.id, title: a.title, body: a.body, tags: a.tags }))}
      />
    </div>
  );
}
