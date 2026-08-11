import { describe, expect, it } from "vitest";
import { clearFilterState, formatDateRange, matchesSite, siteToSearchParams } from "./site-utils";
import type { AsylumSite } from "./types";

const site: AsylumSite = {
	id: "x",
	slug: "x",
	name: "Test Asylum",
	aliases: ["Old Test"],
	city: "Athens",
	state: "Ohio",
	stateCode: "OH",
	coordinates: { lat: 1, lng: 2, precision: "campus" },
	dates: { opened: "1880", completed: null, closed: "1990" },
	architects: [],
	originalInstitution: "Test",
	configuration: null,
	status: "preserved-reuse",
	presentUse: null,
	note: "A note",
	images: [],
	sourceRefs: ["source"],
	claimRefs: {},
};

describe("site utilities", () => {
	it("formats a date range", () => expect(formatDateRange(site)).toBe("1880–1990"));
	it("searches aliases and filters controlled values", () => {
		expect(matchesSite(site, "old test", "", "all", false)).toBe(true);
		expect(matchesSite(site, "", "OH", "preserved-reuse", false)).toBe(true);
		expect(matchesSite(site, "", "MI", "all", false)).toBe(false);
	});
	it("serializes shareable filter state", () =>
		expect(
			siteToSearchParams({
				q: "athens",
				state: "OH",
				status: "preserved-reuse",
				images: true,
				site: "x",
				lng: 2,
				lat: 1,
				zoom: 8,
			}),
		).toContain("q=athens"));
	it("clears state", () => expect(clearFilterState()).toBe(""));
});
