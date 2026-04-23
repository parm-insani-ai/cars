// Minimal ADF/XML parser for inbound website leads. Real providers send a richer
// structure; we extract only the fields we need. For MVP, we accept either the
// ADF envelope or a flat JSON body.

export type AdfParsed = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  vehicle?: { year?: number; make?: string; model?: string; stockNumber?: string };
  comment?: string;
};

export function parseAdfXml(xml: string): AdfParsed {
  // We avoid an XML library dep. ADF is tiny and predictable; regex-extraction is enough.
  const pick = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? decode(m[1]).trim() : undefined;
  };
  const name = pick("name") ?? "";
  const [firstName, ...rest] = name.split(/\s+/);
  const year = pick("year");

  return {
    firstName: firstName || undefined,
    lastName: rest.join(" ") || undefined,
    phone: pick("phone"),
    email: pick("email"),
    vehicle: {
      year: year ? Number(year) : undefined,
      make: pick("make"),
      model: pick("model"),
      stockNumber: pick("stock"),
    },
    comment: pick("comments"),
  };
}

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[|]]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
