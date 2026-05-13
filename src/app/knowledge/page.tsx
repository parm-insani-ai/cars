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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Knowledge base</h1>
        <p className="page-sub">
          Short answers your agent reads aloud when callers ask. Think financing terms, parking, refund policy, what your hours actually mean —
          anything you'd put on an FAQ page.
        </p>
      </div>
      <KnowledgeEditor articles={articles.map(a => ({ id: a.id, title: a.title, body: a.body, tags: a.tags }))} />
    </div>
  );
}
