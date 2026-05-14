// Default loading state for any route that hasn't shipped its own loading.tsx.
// Renders a low-effort skeleton so the user sees the page shape immediately
// while the server finishes preparing the real content.

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-surface-sub rounded-md" />
      <div className="h-4 w-80 bg-surface-sub rounded-md" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="card p-5 space-y-3">
        <div className="h-4 w-32 bg-surface-sub rounded-md" />
        <div className="h-4 w-full bg-surface-sub rounded-md" />
        <div className="h-4 w-5/6 bg-surface-sub rounded-md" />
        <div className="h-4 w-4/6 bg-surface-sub rounded-md" />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="kpi space-y-2">
      <div className="h-3 w-16 bg-surface-sub rounded" />
      <div className="h-6 w-12 bg-surface-sub rounded" />
    </div>
  );
}
