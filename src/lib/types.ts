export const STATUSES = [
	"operating-healthcare",
	"preserved-reuse",
	"vacant",
	"partial-remains",
	"demolished",
	"unknown",
] as const;

export const PRECISIONS = ["exact", "campus", "approximate"] as const;
export type Status = (typeof STATUSES)[number];
export type CoordinatePrecision = (typeof PRECISIONS)[number];

export interface Source {
	id: string;
	title: string;
	publisher: string;
	url: string;
	accessed: string;
	type: string;
	archivalIdentifier?: string;
}

export interface ImageCredit {
	path: string;
	siteId: string;
	creator: string;
	title: string;
	description: string;
	sourceUrl: string;
	license: "Public Domain" | "CC0" | "CC BY" | "CC BY-SA" | "Rights status unclear";
	licenseUrl: string;
	attribution: string;
	date?: string;
}

export interface AsylumSite {
	id: string;
	slug: string;
	name: string;
	aliases: string[];
	city: string;
	state: string;
	stateCode: string;
	coordinates: { lat: number; lng: number; precision: CoordinatePrecision };
	dates: {
		opened: string | null;
		completed: string | null;
		closed: string | null;
	};
	architects: string[];
	originalInstitution: string;
	configuration: string | null;
	status: Status;
	presentUse: string | null;
	note: string;
	images: string[];
	sourceRefs: string[];
	claimRefs: Record<string, string[]>;
}

export const STATUS_LABELS: Record<Status, string> = {
	"operating-healthcare": "Operating healthcare",
	"preserved-reuse": "Preserved / reused",
	vacant: "Vacant",
	"partial-remains": "Partial remains",
	demolished: "Demolished",
	unknown: "Unknown",
};
