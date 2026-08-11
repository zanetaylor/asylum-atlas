import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
let sites;
let sources;
let images = [];
try {
	sites = JSON.parse(readFileSync(resolve(root, "src/data/sites.json"), "utf8"));
	sources = JSON.parse(readFileSync(resolve(root, "src/data/sources.json"), "utf8"));
	if (existsSync(resolve(root, "src/data/images.json")))
		images = JSON.parse(readFileSync(resolve(root, "src/data/images.json"), "utf8"));
} catch (error) {
	console.error(`Unable to parse data JSON: ${error.message}`);
	process.exit(1);
}
const statuses = new Set([
	"operating-healthcare",
	"preserved-reuse",
	"vacant",
	"partial-remains",
	"demolished",
	"unknown",
]);
const precisions = new Set(["exact", "campus", "approximate"]);
const imageLicenses = new Set(["Public Domain", "CC0", "CC BY", "CC BY-SA"]);
const errors = [];
const sourceIds = new Set();

for (const source of sources) {
	if (sourceIds.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
	sourceIds.add(source.id);
	for (const field of ["id", "title", "publisher", "url", "accessed", "type"])
		if (!source[field]) errors.push(`source ${source.id} missing ${field}`);
	if (!/^https?:\/\//.test(source.url)) errors.push(`source ${source.id} has invalid URL`);
}
const siteIds = new Set();
const slugs = new Set();
for (const site of sites) {
	if (siteIds.has(site.id)) errors.push(`duplicate site id: ${site.id}`);
	if (slugs.has(site.slug)) errors.push(`duplicate site slug: ${site.slug}`);
	siteIds.add(site.id);
	slugs.add(site.slug);
	for (const field of [
		"id",
		"slug",
		"name",
		"city",
		"state",
		"stateCode",
		"originalInstitution",
		"status",
		"note",
	])
		if (!site[field]) errors.push(`site ${site.id} missing ${field}`);
	const { lat, lng, precision } = site.coordinates ?? {};
	if (
		!Number.isFinite(lat) ||
		lat < -90 ||
		lat > 90 ||
		!Number.isFinite(lng) ||
		lng < -180 ||
		lng > 180
	)
		errors.push(`site ${site.id} has invalid coordinates`);
	if (!precisions.has(precision)) errors.push(`site ${site.id} has invalid coordinate precision`);
	if (!statuses.has(site.status)) errors.push(`site ${site.id} has invalid status`);
	for (const date of Object.values(site.dates ?? {}))
		if (date !== null && !/^\d{4}$/.test(date))
			errors.push(`site ${site.id} has invalid date ${date}`);
	if (!Array.isArray(site.sourceRefs) || site.sourceRefs.length === 0)
		errors.push(`site ${site.id} has no citations`);
	for (const ref of site.sourceRefs ?? [])
		if (!sourceIds.has(ref)) errors.push(`site ${site.id} references missing source ${ref}`);
	for (const claim of ["location", "dates", "architects", "status"]) {
		if (!Array.isArray(site.claimRefs?.[claim]) || site.claimRefs[claim].length === 0)
			errors.push(`site ${site.id} is missing a citation for ${claim}`);
	}
	for (const refs of Object.values(site.claimRefs ?? {}))
		for (const ref of refs)
			if (!sourceIds.has(ref))
				errors.push(`site ${site.id} claim references missing source ${ref}`);
	for (const imagePath of site.images ?? []) {
		const image = images.find((item) => item.path === imagePath);
		if (!image) errors.push(`site ${site.id} references missing image ${imagePath}`);
	}
}
if (images.length) {
	for (const image of images) {
		for (const field of [
			"path",
			"siteId",
			"creator",
			"title",
			"description",
			"sourceUrl",
			"license",
			"licenseUrl",
			"attribution",
		])
			if (!image[field]) errors.push(`image ${image.path ?? "(unknown)"} missing ${field}`);
		if (!imageLicenses.has(image.license))
			errors.push(`image ${image.path} has unsupported license`);
		if (!existsSync(resolve(root, "public", image.path.replace(/^\//, ""))))
			errors.push(`image ${image.path} is not local`);
		if (!siteIds.has(image.siteId)) errors.push(`image ${image.path} references missing site`);
	}
}
if (errors.length) {
	console.error(`Data validation failed with ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
	process.exit(1);
}
console.log(`Validated ${sites.length} sites and ${sources.length} sources.`);
