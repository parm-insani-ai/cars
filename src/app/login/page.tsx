import { prisma } from "@/lib/prisma";
import { LoginPicker } from "./LoginPicker";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    where: { active: true },
    include: { business: true },
    orderBy: [{ business: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="card p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Sign in to insani</h1>
          <p className="text-sm text-ink-muted mt-1">
            Dev mode — pick a user. In production this would be WorkOS SSO.
          </p>
        </div>
        {users.length === 0 ? (
          <p className="text-sm">
            No users yet. Run <code className="font-mono">npm run db:seed</code>.
          </p>
        ) : (
          <LoginPicker
            users={users.map(u => ({
              id: u.id,
              name: u.name,
              role: u.role,
              business: u.business.name,
              vertical: u.business.vertical,
            }))}
          />
        )}
      </div>
    </div>
  );
}
