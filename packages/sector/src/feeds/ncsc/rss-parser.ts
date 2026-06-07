import { DOMParser } from "@xmldom/xmldom";
import type { NcscRssItem } from "./types.js";

export function parseNcscFeed(xml: string): NcscRssItem[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const itemElements = doc.getElementsByTagName("item");
  const items: NcscRssItem[] = [];

  for (let i = 0; i < itemElements.length; i++) {
    const item = itemElements.item(i);
    if (!item) continue;

    const getText = (tag: string): string => {
      const el = item.getElementsByTagName(tag).item(0);
      return el?.textContent?.trim() ?? "";
    };

    items.push({
      title: getText("title"),
      link: getText("link"),
      description: getText("description"),
      pubDate: getText("pubDate"),
      guid: getText("guid"),
    });
  }

  return items;
}
