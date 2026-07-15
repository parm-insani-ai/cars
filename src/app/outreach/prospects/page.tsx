import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { chipClass, prospectStatusChip, prospectStatusLabel } from "@/lib/labels";
import {
  categoryLabel,
  groupLabel,
  categoryById,
  categoriesInGroup,
  CATEGORY_GROUPS,
  type CategoryGroup,
} from "@/outreach/categories";
import { SourceForm } from "./SourceForm";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "Unqualified" },
  { key: "qualified", label: "Qualified" },
  { key: "queued", label: "In a campaign" },
  { key: "contacted", label: "Contacted" },
  { key: "converted", label: "Demo booked" },
  { key: "do_not_call", label: "Do not call" },
];

const RATING_FILTERS = [
  { key: "any", label: "Any", value: 0 },
  { key: "3", label: "3.0+", value: 3 },
  { key: "4", label: "4.0+", value: 4 },
  { key: "4.5", label: "4.5+", value: 4.5 },
];

const REVIEW_FILTERS = [
  { key: "any", label: "Any", value: 0 },
  { key: "10", label: "10+", value: 10 },
  { key: "50", label: "50+", value: 50 },
  { key: "100", label: "100+", value: 100 },
];

const SCORE_FILTERS = [
  { key: "any", label: "Any", value: 0 },
  { key: "60", label: "60+", value: 60 },
  { key: "75", label: "75+", value: 75 },
  { key: "90", label: "90+", value: 90 },
];

const SORT_OPTIONS = [
  { key: "score", label: "Score (high→low)" },
  { key: "rating", label: "Rating (high→low)" },
  { key: "reviews", label: "Reviews (many→few)" },
  { key: "name", label: "Name (A→Z)" },
  { key: "recent", label: "Newest first" },
];

type SearchParams = {
  status?: string;
  group?: string;
  category?: string;
  city?: string;
  rating?: string;
  reviews?: string;
  score?: string;
  q?: string;
  hasPhone?: string;
  sort?: string;
};

export default async function ProspectsPage({ searchParams }: { searchParams: SearchParams }) {
  const status = searchParams.status ?? "all";
  const category = searchParams.category ?? "all";
  const group =
    category !== "all" ? categoryById(category)?.group ?? "all" : searchParams.group ?? "all";
  const city = searchParams.city ?? "all";
  const ratingKey = searchParams.rating ?? "any";
  const reviewsKey = searchParams.reviews ?? "any";
  const scoreKey = searchParams.score ?? "any";
  const q = (searchParams.q ?? "").trim();
  const hasPhone = searchParams.hasPhone === "1";
  const sort = searchParams.sort ?? "score";

  const ratingMin = RATING_FILTERS.find(f => f.key === ratingKey)?.value ?? 0;
  const reviewsMin = REVIEW_FILTERS.find(f => f.key === reviewsKey)?.value ?? 0;
  const scoreMin = SCORE_FILTERS.find(f => f.key === scoreKey)?.value ?? 0;

  // Build the Prisma WHERE. Each active filter narrows the audience; the
  // ordering is set from `sort`. When "has phone" is on we require phone to
  // be non-null AND non-empty (Google Places occasionally returns "").
  const where: Prisma.ProspectWhereInput = {};
  if (status !== "all") where.status = status as any;
  if (category !== "all") where.category = category;
  else if (group !== "all") where.categoryGroup = group;
  if (city !== "all") where.city = city;
  if (ratingMin > 0) where.rating = { gte: ratingMin };
  if (reviewsMin > 0) where.reviewsCount = { gte: reviewsMin };
  if (scoreMin > 0) where.score = { gte: scoreMin };
  if (q) where.businessName = { contains: q, mode: "insensitive" };
  if (hasPhone) where.phone = { not: null };

  const orderBy: Prisma.ProspectOrderByWithRelationInput[] =
    sort === "rating"  ? [{ rating: "desc" }, { reviewsCount: "desc" }] :
    sort === "reviews" ? [{ reviewsCount: "desc" }, { rating: "desc" }] :
    sort === "name"    ? [{ businessName: "asc" }] :
    sort === "recent"  ? [{ createdAt: "desc" }] :
                         [{ score: "desc" }, { createdAt: "desc" }];

  // Fetch the filtered list. Cities dropdown pulls from the FULL set (not
  // narrowed by the current filter) so switching cities always reveals every
  // option, not just the ones that already match everything else.
  const [prospects, cities, totalMatching] = await Promise.all([
    prisma.prospect.findMany({ where, orderBy, take: 300 }),
    prisma.prospect.findMany({
      where: { city: { not: null } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    prisma.prospect.count({ where }),
  ]);

  function href(next: Partial<SearchParams>) {
    const s = next.status ?? status;
    let g = next.group ?? group;
    let c = next.category ?? category;
    if (next.group !== undefined) c = "all"; // switching group clears the sub-category
    if (c !== "all") g = categoryById(c)?.group ?? g;
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (g !== "all") params.set("group", g);
    if (c !== "all") params.set("category", c);
    const cityNext = next.city ?? city;
    if (cityNext !== "all") params.set("city", cityNext);
    const ratingNext = next.rating ?? ratingKey;
    if (ratingNext !== "any") params.set("rating", ratingNext);
    const reviewsNext = next.reviews ?? reviewsKey;
    if (reviewsNext !== "any") params.set("reviews", reviewsNext);
    const scoreNext = next.score ?? scoreKey;
    if (scoreNext !== "any") params.set("score", scoreNext);
    const qNext = next.q ?? q;
    if (qNext) params.set("q", qNext);
    const phoneNext = next.hasPhone ?? (hasPhone ? "1" : "0");
    if (phoneNext === "1") params.set("hasPhone", "1");
    const sortNext = next.sort ?? sort;
    if (sortNext !== "score") params.set("sort", sortNext);
    const str = params.toString();
    return str ? `/outreach/prospects?${str}` : "/outreach/prospects";
  }

  const chip = (active: boolean, small = false) =>
    (small ? "px-2.5 py-1 rounded-lg text-xs " : "px-3 py-1.5 rounded-lg text-sm ") +
    (active ? "bg-ink text-white" : "hover:bg-surface-sub text-ink-muted");

  const anyFilterActive =
    status !== "all" ||
    group !== "all" ||
    category !== "all" ||
    city !== "all" ||
    ratingKey !== "any" ||
    reviewsKey !== "any" ||
    scoreKey !== "any" ||
    hasPhone ||
    q.length > 0 ||
    sort !== "score";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Prospects</h1>
        <p className="page-sub">Halifax small businesses we've sourced as potential AI-receptionist customers.</p>
      </div>

      <SourceForm />

      {/* Search bar — plain GET form so it works even without JS. Preserves
          every other active filter as hidden inputs so submitting the search
          doesn't wipe them. */}
      <form method="GET" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search business name…"
          className="flex-1 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm"
        />
        {/* Carry-forward hidden inputs so other filters survive the search. */}
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        {group !== "all" && <input type="hidden" name="group" value={group} />}
        {category !== "all" && <input type="hidden" name="category" value={category} />}
        {city !== "all" && <input type="hidden" name="city" value={city} />}
        {ratingKey !== "any" && <input type="hidden" name="rating" value={ratingKey} />}
        {reviewsKey !== "any" && <input type="hidden" name="reviews" value={reviewsKey} />}
        {scoreKey !== "any" && <input type="hidden" name="score" value={scoreKey} />}
        {hasPhone && <input type="hidden" name="hasPhone" value="1" />}
        {sort !== "score" && <input type="hidden" name="sort" value={sort} />}
        <button type="submit" className="btn-secondary">Search</button>
        {anyFilterActive && (
          <Link href="/outreach/prospects" className="text-xs text-ink-muted hover:underline">Clear all</Link>
        )}
      </form>

      <div className="space-y-2">
        <FilterRow label="Status">
          {STATUS_FILTERS.map(f => (
            <Link key={f.key} href={href({ status: f.key })} className={chip(status === f.key)}>
              {f.label}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="Type">
          <Link href={href({ group: "all" })} className={chip(group === "all", true)}>All types</Link>
          {CATEGORY_GROUPS.map(g => (
            <Link key={g.id} href={href({ group: g.id })} className={chip(group === g.id, true)}>
              {g.label}
            </Link>
          ))}
        </FilterRow>

        {group !== "all" && (
          <FilterRow label="Sub" indent>
            <Link href={href({ category: "all" })} className={chip(category === "all", true)}>
              All {groupLabel(group).toLowerCase()}
            </Link>
            {categoriesInGroup(group as CategoryGroup).map(c => (
              <Link key={c.id} href={href({ category: c.id })} className={chip(category === c.id, true)}>
                {c.label}
              </Link>
            ))}
          </FilterRow>
        )}

        <FilterRow label="City">
          <Link href={href({ city: "all" })} className={chip(city === "all", true)}>All cities</Link>
          {cities.map(c => c.city && (
            <Link key={c.city} href={href({ city: c.city })} className={chip(city === c.city, true)}>
              {c.city}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="Rating">
          {RATING_FILTERS.map(f => (
            <Link key={f.key} href={href({ rating: f.key })} className={chip(ratingKey === f.key, true)}>
              {f.label}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="Reviews">
          {REVIEW_FILTERS.map(f => (
            <Link key={f.key} href={href({ reviews: f.key })} className={chip(reviewsKey === f.key, true)}>
              {f.label}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="Fit score">
          {SCORE_FILTERS.map(f => (
            <Link key={f.key} href={href({ score: f.key })} className={chip(scoreKey === f.key, true)}>
              {f.label}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label="Extras">
          <Link
            href={href({ hasPhone: hasPhone ? "0" : "1" })}
            className={chip(hasPhone, true)}
          >
            {hasPhone ? "✓ has phone" : "has phone"}
          </Link>
        </FilterRow>

        <FilterRow label="Sort">
          {SORT_OPTIONS.map(s => (
            <Link key={s.key} href={href({ sort: s.key })} className={chip(sort === s.key, true)}>
              {s.label}
            </Link>
          ))}
        </FilterRow>
      </div>

      <div className="text-xs text-ink-muted">
        Showing {prospects.length} of {totalMatching.toLocaleString()} matching{prospects.length < totalMatching && " (first 300)"}
      </div>

      <div className="card overflow-hidden">
        {prospects.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No prospects match this filter</div>
            <div className="empty-sub">Use "Find Halifax prospects" above to pull a batch of small businesses to call, or loosen the filters.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Business</th>
                <th>Type</th>
                <th>Location</th>
                <th>Phone</th>
                <th className="text-right">Rating</th>
                <th className="text-right">Reviews</th>
                <th className="text-right">Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/outreach/prospects/${p.id}`} className="text-lane hover:underline">
                      {p.businessName}
                    </Link>
                  </td>
                  <td className="text-xs text-ink-muted">
                    {categoryLabel(p.category)}
                    <span className="text-ink-muted/60"> · {groupLabel(p.categoryGroup)}</span>
                  </td>
                  <td className="text-xs text-ink-muted">
                    {[p.city, p.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="text-xs">{p.phone ?? "—"}</td>
                  <td className="text-right tabular-nums text-xs">{p.rating ? p.rating.toFixed(1) : "—"}</td>
                  <td className="text-right tabular-nums text-xs">{p.reviewsCount ?? "—"}</td>
                  <td className="text-right tabular-nums">{p.score ?? "—"}</td>
                  <td><span className={chipClass(prospectStatusChip[p.status])}>{prospectStatusLabel[p.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, indent, children }: { label: string; indent?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 flex-wrap ${indent ? "pl-3 border-l-2 border-surface-border" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold w-16 pt-1.5 shrink-0">
        {label}
      </div>
      <div className="flex items-center gap-1 flex-wrap flex-1">{children}</div>
    </div>
  );
}
