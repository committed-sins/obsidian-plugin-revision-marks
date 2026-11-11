export const DEFAULT_FRONTMATTER_ORDER = Object.freeze([
    "id",
    "scopes",
    "areas",
    "created",
    "updated",
    "updated_count",
    "viewed",
    "tags",
    "aliases",
    "tenants",
    "contexts",
    "dns",
    "domains",
    "emails",
    "phones",
    "addresses",
    "locations",
    "logins",
    "connections",
    "owners",
    "usernames",
    "status",
    "order",
    "priority",
    "started",
    "due",
    "scheduled",
    "finance",
    "asset",
    "timers"
]);

export function orderFrontmatter(frontmatter, order = DEFAULT_FRONTMATTER_ORDER) {
    const keys = [...new Set([...order, ...Object.keys(frontmatter)])];
    const entries = keys.filter(key => Object.hasOwn(frontmatter, key)).map(key => [key, frontmatter[key]]);
    for (const key of Object.keys(frontmatter)) delete frontmatter[key];
    for (const [key, value] of entries) Object.defineProperty(frontmatter, key, { value, enumerable: true, configurable: true, writable: true });
}
