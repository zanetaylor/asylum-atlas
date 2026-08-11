import type { AsylumSite, Status } from "./types";

export function formatYear(value: string | null): string {
	return value ?? "Unknown";
}

export function formatDateRange(site: AsylumSite): string {
	const start = site.dates.opened ?? site.dates.completed;
	const end = site.dates.closed;
	if (start && end) return `${start}–${end}`;
	if (start) return `${start}–present`;
	return "Date unknown";
}

export function matchesSite(
	site: AsylumSite,
	query: string,
	state: string,
	status: Status | "all",
	withImages: boolean,
): boolean {
	const haystack = [site.name, ...site.aliases, site.city, site.state, site.stateCode]
		.join(" ")
		.toLowerCase();
	return (
		(!query || haystack.includes(query.trim().toLowerCase())) &&
		(!state || site.stateCode === state) &&
		(status === "all" || site.status === status) &&
		(!withImages || site.images.length > 0)
	);
}

export function siteToSearchParams(state: {
	q: string;
	state: string;
	status: string;
	images: boolean;
	site?: string | null;
	lng?: number;
	lat?: number;
	zoom?: number;
}): string {
	const params = new URLSearchParams();
	if (state.q) params.set("q", state.q);
	if (state.state) params.set("state", state.state);
	if (state.status && state.status !== "all") params.set("status", state.status);
	if (state.images) params.set("images", "1");
	if (state.site) params.set("site", state.site);
	if (typeof state.lng === "number" && typeof state.lat === "number") {
		params.set("lng", state.lng.toFixed(4));
		params.set("lat", state.lat.toFixed(4));
	}
	if (typeof state.zoom === "number") params.set("zoom", state.zoom.toFixed(2));
	const encoded = params.toString();
	return encoded ? `?${encoded}` : "";
}

export function clearFilterState(): string {
	return siteToSearchParams({ q: "", state: "", status: "all", images: false });
}
