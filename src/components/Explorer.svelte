<script lang="ts">
	import { onMount } from "svelte";
	import "maplibre-gl/dist/maplibre-gl.css";
	import type { AsylumSite, ImageCredit, Source, Status } from "../lib/types";
	import { STATUS_LABELS, STATUSES } from "../lib/types";
	import { matchesSite, siteToSearchParams } from "../lib/site-utils";
	import sitesData from "../data/sites.json";
	import sourcesData from "../data/sources.json";
	import imagesData from "../data/images.json";

	const sites = sitesData as AsylumSite[];
	const sources = sourcesData as Source[];
	const imageCredits = imagesData as ImageCredit[];
	type Basemap = "street" | "satellite";
	const STREET_STYLE =
		import.meta.env.PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
	const SATELLITE_STYLE = {
		version: 8,
		glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
		sources: {
			satellite: {
				type: "raster",
				tiles: [
					"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
				],
				tileSize: 256,
				attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
			},
		},
		layers: [{ id: "satellite", type: "raster", source: "satellite" }],
	};
	const BASEMAP_ATTRIBUTION = {
		street: "Basemap © OpenFreeMap, © OpenStreetMap contributors",
		satellite: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
	};
	const states = [...new Map(sites.map((site) => [site.stateCode, site.state])).entries()].sort(
		(a, b) => a[1].localeCompare(b[1]),
	);
	let query = "";
	let state = "";
	let status: Status | "all" = "all";
	let withImages = false;
	let selected: AsylumSite | null = null;
	let mapElement: HTMLDivElement;
	let map: any;
	let mapLibrary: any;
	let attributionControl: any;
	let hoverPopup: any;
	let basemap: Basemap = "street";
	type MapCamera = {
		center: [number, number];
		zoom: number;
		bearing: number;
		pitch: number;
	};
	let pendingCamera: MapCamera | null = null;
	let mapError = "";
	let filteredSites: AsylumSite[] = sites;
	let sortedSites: AsylumSite[] = sites;
	$: filteredSites = sites.filter((site) => matchesSite(site, query, state, status, withImages));
	$: sortedSites = [...filteredSites].sort((a, b) => a.name.localeCompare(b.name));
	$: if (map && map.getSource("sites")) {
		map.getSource("sites").setData(siteGeoJson(filteredSites, selected?.id));
	}

	function siteGeoJson(records: AsylumSite[], selectedId = "") {
		return {
			type: "FeatureCollection",
			features: records.map((site) => ({
				type: "Feature",
				geometry: { type: "Point", coordinates: [site.coordinates.lng, site.coordinates.lat] },
				properties: {
					slug: site.slug,
					status: site.status,
					name: site.name,
					selected: site.id === selectedId,
				},
			})),
		};
	}

	function updateUrl(site?: AsylumSite | null) {
		if (typeof window === "undefined") return;
		const center = map?.getCenter();
		const next = siteToSearchParams({
			q: query,
			state,
			status,
			images: withImages,
			site: site?.slug,
			lng: center?.lng,
			lat: center?.lat,
			zoom: map?.getZoom(),
		});
		window.history.replaceState({}, "", `${window.location.pathname}${next}`);
	}

	function selectSite(site: AsylumSite | null) {
		selected = site;
		if (site && map)
			map.flyTo({
				center: [site.coordinates.lng, site.coordinates.lat],
				zoom: 9,
				essential: false,
			});
		updateUrl(site);
	}

	function resetFilters() {
		query = "";
		state = "";
		status = "all";
		withImages = false;
		selected = null;
		updateUrl();
	}

	function readUrl() {
		const params = new URLSearchParams(window.location.search);
		query = params.get("q") ?? "";
		state = params.get("state") ?? "";
		status = (STATUSES as readonly string[]).includes(params.get("status") ?? "")
			? (params.get("status") as Status)
			: "all";
		withImages = params.get("images") === "1";
		selected = sites.find((site) => site.slug === params.get("site")) ?? null;
	}

	function updateAttributionControl() {
		if (!map || !mapLibrary) return;
		if (attributionControl) map.removeControl(attributionControl);
		attributionControl = new mapLibrary.AttributionControl({
			compact: true,
			customAttribution: BASEMAP_ATTRIBUTION[basemap],
		});
		map.addControl(attributionControl, "bottom-right");
	}

	async function handleClusterClick(event: any) {
		const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
		const feature = features[0];
		if (!feature) return;
		const zoom = await map
			.getSource("sites")
			.getClusterExpansionZoom(feature.properties.cluster_id);
		map.easeTo({ center: feature.geometry.coordinates, zoom });
	}

	function handleSiteClick(event: any) {
		const slug = event.features?.[0]?.properties?.slug;
		selectSite(sites.find((site) => site.slug === slug) ?? null);
	}

	function setPointerCursor() {
		map.getCanvas().style.cursor = "pointer";
	}

	function clearPointerCursor() {
		map.getCanvas().style.cursor = "";
	}

	function showSiteLabel(event: any) {
		const feature = event.features?.[0];
		const coordinates = feature?.geometry?.coordinates?.slice();
		const name = feature?.properties?.name;
		if (!coordinates || !name || !mapLibrary) return;
		setPointerCursor();
		hoverPopup?.remove();
		hoverPopup = new mapLibrary.Popup({
			closeButton: false,
			closeOnClick: false,
			offset: 18,
			className: "site-hover-label",
		})
			.setLngLat(coordinates)
			.setText(name)
			.addTo(map);
	}

	function hideSiteLabel() {
		clearPointerCursor();
		hoverPopup?.remove();
		hoverPopup = null;
	}

	function bindMapInteractions() {
		map.off("click", "clusters", handleClusterClick);
		map.off("click", "site-points", handleSiteClick);
		map.off("mouseenter", "clusters", setPointerCursor);
		map.off("mouseenter", "site-points", showSiteLabel);
		map.off("mouseleave", "clusters", clearPointerCursor);
		map.off("mouseleave", "site-points", hideSiteLabel);
		map.on("click", "clusters", handleClusterClick);
		map.on("click", "site-points", handleSiteClick);
		map.on("mouseenter", "clusters", setPointerCursor);
		map.on("mouseenter", "site-points", showSiteLabel);
		map.on("mouseleave", "clusters", clearPointerCursor);
		map.on("mouseleave", "site-points", hideSiteLabel);
	}

	function addSiteLayers() {
		if (!map || map.getSource("sites")) return;
		map.addSource("sites", {
			type: "geojson",
			data: siteGeoJson(filteredSites, selected?.id),
			cluster: true,
			clusterMaxZoom: 7,
			clusterRadius: 42,
		});
		map.addLayer({
			id: "clusters",
			type: "circle",
			source: "sites",
			filter: ["has", "point_count"],
			paint: {
				"circle-color": "#b95738",
				"circle-radius": ["step", ["get", "point_count"], 18, 4, 23, 8, 29],
				"circle-opacity": 0.9,
				"circle-stroke-width": 2,
				"circle-stroke-color": "#f4f1e9",
			},
		});
		map.addLayer({
			id: "cluster-count",
			type: "symbol",
			source: "sites",
			filter: ["has", "point_count"],
			layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
			paint: { "text-color": "#fff" },
		});
		map.addLayer({
			id: "selected-site-point",
			type: "circle",
			source: "sites",
			filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "selected"], true]],
			paint: {
				"circle-color": "#19332f",
				"circle-radius": 13,
				"circle-opacity": 0.12,
				"circle-stroke-width": 2,
				"circle-stroke-color": "#19332f",
				"circle-stroke-opacity": 0.5,
			},
		});
		map.addLayer({
			id: "site-points",
			type: "circle",
			source: "sites",
			filter: ["!", ["has", "point_count"]],
			paint: {
				"circle-color": [
					"match",
					["get", "status"],
					"operating-healthcare",
					"#447b6a",
					"preserved-reuse",
					"#d49b42",
					"partial-remains",
					"#b95738",
					"demolished",
					"#8c9290",
					"#718c7e",
				],
				"circle-radius": 8,
				"circle-stroke-width": 2,
				"circle-stroke-color": "#fbfaf6",
			},
		});
		bindMapInteractions();
	}

	function setBasemap(nextBasemap: Basemap) {
		if (!map || basemap === nextBasemap) return;
		const center = map.getCenter();
		pendingCamera = {
			center: [center.lng, center.lat],
			zoom: map.getZoom(),
			bearing: map.getBearing(),
			pitch: map.getPitch(),
		};
		basemap = nextBasemap;
		updateAttributionControl();
		hideSiteLabel();
		map.setStyle(basemap === "street" ? STREET_STYLE : SATELLITE_STYLE);
		updateUrl(selected);
	}

	async function setupMap() {
		try {
			mapLibrary = await import("maplibre-gl");
			map = new mapLibrary.Map({
				container: mapElement,
				style: STREET_STYLE,
				center: [-96, 38.5],
				zoom: 3.6,
				attributionControl: false,
			});
			map.addControl(new mapLibrary.NavigationControl({ showCompass: false }), "bottom-right");
			updateAttributionControl();
			map.on("style.load", () => {
				addSiteLayers();
				if (pendingCamera) {
					map.jumpTo(pendingCamera);
					pendingCamera = null;
				} else if (selected) {
					map.flyTo({ center: [selected.coordinates.lng, selected.coordinates.lat], zoom: 9 });
				}
			});
			map.on("moveend", () => updateUrl(selected));
			map.on("error", (event: any) => {
				if (event?.error?.message?.includes("style") || event?.error?.message?.includes("fetch"))
					mapError =
						"The basemap is unavailable, but the complete searchable site list remains available in the left sidebar.";
			});
		} catch (error) {
			mapError =
				"This browser could not load WebGL. Use the searchable site list in the left sidebar to explore the directory.";
		}
	}
	onMount(() => {
		readUrl();
		setupMap();
		return () => {
			hoverPopup?.remove();
			map?.remove();
		};
	});
</script>

<div class="explorer" aria-label="Asylum Atlas site explorer">
	<aside class="controls" aria-label="Explorer filters and site list">
		<div class="explorer-heading">
			<p class="eyebrow">{sites.length} sites</p>
			<h1>Explore</h1>
			<h4>
				Have you ever wanted a map of all the sites of former and existing asylum buildings based on
				the Kirkbride Plan?
			</h4>
			<p>
				Not really? Well here you go anyway! A work in progress. Some info may be incomplete or
				inaccurate.
			</p>
		</div>
		<label for="site-search">Search sites</label>
		<div class="search-wrap">
			<input
				id="site-search"
				type="search"
				bind:value={query}
				on:input={() => updateUrl(selected)}
				placeholder="Name, city, or alias"
			/><span aria-hidden="true">⌕</span>
		</div>
		<label for="state-filter">State</label>
		<select id="state-filter" bind:value={state} on:change={() => updateUrl(selected)}
			><option value="">All states</option>{#each states as [code, name]}<option value={code}
					>{name}</option
				>{/each}</select
		>
		<label for="status-filter">Current status</label>
		<select id="status-filter" bind:value={status} on:change={() => updateUrl(selected)}
			><option value="all">All statuses</option>{#each STATUSES as item}<option value={item}
					>{STATUS_LABELS[item]}</option
				>{/each}</select
		>
		<label class="check"
			><input type="checkbox" bind:checked={withImages} on:change={() => updateUrl(selected)} />
			<span>Only sites with images</span></label
		>
		<div class="result-summary">
			<strong>{filteredSites.length}</strong> result{filteredSites.length === 1 ? "" : "s"}
			<button
				class="reset"
				on:click={resetFilters}
				disabled={!query && !state && status === "all" && !withImages}>Reset filters</button
			>
		</div>
		<div class="sidebar-results" aria-live="polite">
			<!-- <div class="results-header">
				<h3>Index</h3>
				<span>{filteredSites.length} shown</span>
			</div> -->
			{#if filteredSites.length === 0}<div class="empty">
					<h3>No sites match</h3>
					<p>Try a broader search or clear the filters.</p>
					<button class="button secondary" on:click={resetFilters}>Clear filters</button>
				</div>{:else}<div class="site-list">
					{#each sortedSites as site}<a
							class:selected={selected?.id === site.id}
							class="result-item"
							href={`/?site=${site.slug}`}
							on:click|preventDefault={() => selectSite(site)}
						>
							<span
								><strong>{site.name}</strong><small
									>{site.city}, {site.stateCode} · {STATUS_LABELS[site.status]}</small
								></span
							><span aria-hidden="true">→</span></a
						>{/each}
				</div>{/if}
		</div>
	</aside>
	<section class="map-column" aria-label="Map">
		<div class="map-status" aria-live="polite">
			{#if mapError}<span>{mapError}</span>{:else}<span
					>Click a marker to inspect a site. The complete site list is in the left sidebar.</span
				>{/if}
		</div>
		<div class="map-frame" bind:this={mapElement}>
			<div class="map-tools" aria-label="Map controls">
				<div class="legend" aria-label="Map legend">
					<span class="legend-title">Legend</span>
					<span><i class="legend-dot operating-healthcare"></i> Operating</span>
					<span><i class="legend-dot preserved-reuse"></i> Preserved / reused</span>
					<span><i class="legend-dot partial-remains"></i> Partial remains</span>
					<span><i class="legend-dot demolished"></i> Demolished</span>
				</div>
				<div class="basemap-control">
					<div class="basemap-buttons" role="group" aria-label="Choose a basemap">
						<button
							type="button"
							class:active={basemap === "street"}
							aria-pressed={basemap === "street"}
							on:click={() => setBasemap("street")}>Street</button
						>
						<button
							type="button"
							class:active={basemap === "satellite"}
							aria-pressed={basemap === "satellite"}
							on:click={() => setBasemap("satellite")}>Satellite</button
						>
					</div>
				</div>
			</div>
		</div>
	</section>
	{#if selected}{@const detailSite = selected}
		<aside class="detail-panel" aria-label="Selected site details">
			<button class="close" aria-label="Close site details" on:click={() => selectSite(null)}
				>×</button
			>
			<!-- <p class="eyebrow">Selected site · {selected.stateCode}</p> -->
			<h2>{selected.name}</h2>
			<p class="detail-place">
				{selected.city}, {selected.state} · {STATUS_LABELS[selected.status]}
			</p>
			{#if selected.aliases.length}<p class="aliases">
					<strong>Also known as:</strong>
					{selected.aliases.join(" · ")}
				</p>{/if}
			<p class="detail-note">{selected.note}</p>
			<dl class="detail-facts">
				<div>
					<dt>Dates</dt>
					<dd>
						{selected.dates.opened ?? selected.dates.completed ?? "Unknown"}{selected.dates.closed
							? `–${selected.dates.closed}`
							: selected.dates.opened
								? "–present"
								: ""}
					</dd>
				</div>
				<div>
					<dt>Architect{selected.architects.length === 1 ? "" : "s"}</dt>
					<dd>{selected.architects.join(", ") || "Not recorded"}</dd>
				</div>
				<div>
					<dt>Original institution</dt>
					<dd>{selected.originalInstitution}</dd>
				</div>
				<div>
					<dt>Configuration</dt>
					<dd>{selected.configuration ?? "Not recorded"}</dd>
				</div>
				<div>
					<dt>Present use</dt>
					<dd>{selected.presentUse ?? "Not recorded"}</dd>
				</div>
				<div>
					<dt>Coordinates</dt>
					<dd>
						{selected.coordinates.lat.toFixed(4)}, {selected.coordinates.lng.toFixed(4)}<br /><small
							>{selected.coordinates.precision} location</small
						>
					</dd>
				</div>
			</dl>
			<section class="detail-section">
				<h3>Images</h3>
				{#if selected.images.length}{#each imageCredits.filter( (image) => detailSite.images.includes(image.path) ) as image}<figure
						>
							<img src={image.path} alt={image.description} />
							<figcaption>
								{image.attribution} ·
								<a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}</a>
								· <a href={image.sourceUrl} target="_blank" rel="noreferrer">Source</a>
							</figcaption>
						</figure>{/each}{:else}<p class="muted">
						No compliant local image is published for this record yet.
					</p>{/if}
			</section>
			<section class="detail-section">
				<h3>Sources</h3>
				<ol class="citations">
					{#each sources.filter((source) => detailSite.sourceRefs.includes(source.id)) as source}<li
						>
							<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span
								>{source.publisher} · accessed {source.accessed}</span
							>
						</li>{/each}
				</ol>
			</section>
		</aside>{/if}
</div>

<style>
	.explorer {
		display: grid;
		grid-template-columns: 350px minmax(0, 1fr);
		min-height: calc(100vh - 84px);
		position: relative;
	}
	.controls {
		height: calc(100vh - 84px);
		overflow-y: auto;
		padding: 2.2rem 2rem;
		border-right: 1px solid var(--line);
		background: var(--card);
	}
	.explorer-heading {
		margin-bottom: 2rem;
	}
	.explorer-heading h1 {
		font-size: 3rem;
		margin: 0.45rem 0 0.8rem;
	}
	.explorer-heading p:last-child {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	label {
		display: block;
		margin: 0.95rem 0 0.35rem;
		font:
			500 0.68rem "DM Mono",
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	input[type="search"],
	select {
		width: 100%;
		border: 1px solid var(--line);
		background: var(--paper);
		color: var(--ink);
		border-radius: 2px;
		padding: 0.75rem 0.8rem;
		font: inherit;
	}
	.search-wrap {
		position: relative;
	}
	.search-wrap input {
		padding-right: 2rem;
	}
	.search-wrap span {
		position: absolute;
		right: 0.75rem;
		top: 0.55rem;
		font-size: 1.4rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 1.3rem 0;
		font-family: inherit;
		text-transform: none;
		letter-spacing: 0;
		font-size: 0.85rem;
	}
	input[type="checkbox"] {
		accent-color: var(--rust);
		width: 1rem;
		height: 1rem;
	}
	.result-summary {
		display: flex;
		align-items: center;
		padding: 1.1rem 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		font:
			500 0.78rem "DM Mono",
			monospace;
	}
	.result-summary strong {
		font-size: 1.3rem;
		margin-right: 0.3rem;
	}
	.reset {
		margin-left: auto;
		border: 0;
		padding: 0;
		background: none;
		color: var(--rust);
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
	}
	.reset:disabled {
		color: var(--disabled);
		cursor: default;
		text-decoration: none;
	}
	.map-tools {
		position: absolute;
		left: 1rem;
		bottom: 1rem;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.65rem;
		max-width: calc(100% - 2rem);
		padding: 0.75rem;
		background: var(--overlay);
		border: 1px solid var(--line);
		box-shadow: var(--shadow);
		backdrop-filter: blur(8px);
	}
	.basemap-control {
		border-top: 1px solid var(--line);
		padding-top: 0.65rem;
	}
	.legend-title {
		color: var(--ink);
		font:
			500 0.68rem "DM Mono",
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.basemap-buttons {
		display: flex;
		width: 100%;
	}
	.basemap-buttons button {
		width: 50%;
		border: 1px solid var(--line);
		padding: 0.4rem 0.55rem;
		background: transparent;
		color: var(--ink-soft);
		font:
			500 0.68rem "DM Mono",
			monospace;
		cursor: pointer;
	}
	.basemap-buttons button + button {
		margin-left: -1px;
	}
	.basemap-buttons button:hover,
	.basemap-buttons button.active {
		position: relative;
		z-index: 1;
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
	}
	.legend {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.2rem 0.3rem;
		color: var(--ink-soft);
		font-size: 0.72rem;
	}
	.legend-title {
		grid-column: 1 / -1;
	}
	.legend-title {
		color: var(--ink);
		font:
			500 0.68rem "DM Mono",
			monospace;
		text-transform: uppercase;
	}
	.legend-dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-right: 0.45rem;
		background: var(--sage);
	}
	.legend-dot.operating-healthcare {
		background: #447b6a;
	}
	.legend-dot.preserved-reuse {
		background: var(--gold);
	}
	.legend-dot.partial-remains {
		background: var(--rust);
	}
	.legend-dot.demolished {
		background: #8c9290;
	}
	/*.sidebar-results {
		padding-top: 1.6rem;
	}*/
	/*.results-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		border-bottom: 2px solid var(--ink);
	}*/
	.site-list {
		display: flex;
		flex-direction: column;
	}
	.result-item {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--line);
		background: none;
		color: var(--ink);
		text-align: left;
		text-decoration: none;
	}
	.result-item:hover,
	.result-item.selected {
		color: var(--rust);
	}
	.result-item strong,
	.result-item small {
		display: block;
	}
	.result-item strong {
		font-family: "Playfair Display", serif;
		font-size: 1rem;
	}
	.result-item small {
		margin-top: 0.15rem;
		color: var(--ink-soft);
		font-size: 0.7rem;
	}
	.empty {
		padding: 1.5rem 0;
		color: var(--ink-soft);
	}
	.empty h3 {
		font-size: 1.3rem;
		margin-bottom: 0.3rem;
	}
	.map-column {
		min-width: 0;
		min-height: calc(100vh - 84px);
		background: var(--map-surface);
	}
	.map-status {
		min-height: 40px;
		padding: 0.7rem 1rem;
		background: var(--ink);
		color: var(--paper);
		font-size: 0.78rem;
	}
	.map-frame {
		position: relative;
		height: calc(100vh - 124px);
		min-height: 520px;
		background: linear-gradient(135deg, var(--map-gradient-start), var(--map-gradient-end));
	}
	:global(.maplibregl-ctrl-group) {
		background: var(--card);
		border-color: var(--line);
	}
	:global(.maplibregl-ctrl-group button) {
		border-color: var(--line);
		filter: var(--control-icon-filter);
	}
	:global(.maplibregl-ctrl-bottom-right) {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
	:global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl) {
		float: none;
	}
	:global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group) {
		order: 1;
	}
	:global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib) {
		order: 2;
	}
	:global(.maplibregl-ctrl-attrib) {
		padding: 2px 5px;
		border-radius: 2px 0 0;
		background: var(--overlay);
		color: var(--ink-soft);
		font:
			500 10px/1.4 "DM Mono",
			monospace;
	}
	:global(.maplibregl-ctrl-attrib a) {
		color: var(--ink);
	}
	:global(.maplibregl-ctrl-attrib a:hover) {
		color: var(--rust);
	}
	:global(.maplibregl-ctrl-attrib-button) {
		width: 24px;
		height: 24px;
	}
	:global(.site-hover-label .maplibregl-popup-content) {
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--line);
		border-radius: 0;
		background: var(--overlay);
		color: var(--ink);
		box-shadow: none;
		font:
			500 0.72rem "DM Mono",
			monospace;
	}
	:global(.site-hover-label .maplibregl-popup-tip) {
		display: none;
	}
	.detail-panel {
		position: absolute;
		right: 1.2rem;
		top: 1.2rem;
		z-index: 3;
		width: min(430px, calc(100% - 2.4rem));
		max-height: calc(100vh - 110px);
		overflow-y: auto;
		padding: 2rem;
		background: var(--card);
		box-shadow: var(--shadow);
		border-top: 4px solid var(--rust);
	}
	.detail-panel h2 {
		font-size: 2.2rem;
		margin: 0 0 0.5rem;
	}
	.detail-place {
		color: var(--ink-soft);
		font-family: "DM Mono", monospace;
		font-size: 0.7rem;
		text-transform: uppercase;
	}
	.aliases {
		color: var(--ink-soft);
		font-size: 0.82rem;
	}
	.aliases strong {
		color: var(--ink);
	}
	.detail-note {
		font-size: 1rem;
		line-height: 1.5;
	}
	.close {
		position: absolute;
		right: 1rem;
		top: 0.7rem;
		border: 0;
		background: none;
		color: var(--ink);
		font-size: 1.8rem;
		cursor: pointer;
	}
	.detail-facts {
		margin: 1.5rem 0;
	}
	.detail-facts div {
		display: grid;
		grid-template-columns: 112px 1fr;
		gap: 0.5rem;
		padding: 0.6rem 0;
		border-top: 1px solid var(--line);
	}
	dt {
		color: var(--ink-soft);
		font:
			500 0.62rem "DM Mono",
			monospace;
		text-transform: uppercase;
	}
	dd {
		margin: 0;
		font-size: 0.82rem;
	}
	dd small {
		color: var(--ink-soft);
		font-size: 0.7rem;
	}
	.detail-section {
		margin-top: 1.8rem;
	}
	.detail-section h3 {
		font:
			600 0.7rem "DM Mono",
			monospace;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--ink);
	}
	.muted {
		color: var(--ink-soft);
		font-size: 0.8rem;
	}
	figure {
		margin: 0 0 1rem;
	}
	figure img {
		display: block;
		width: 100%;
	}
	figcaption {
		margin-top: 0.35rem;
		color: var(--ink-soft);
		font-size: 0.7rem;
	}
	.citations {
		padding-left: 1.1rem;
		margin-bottom: 0;
	}
	.citations li {
		padding: 0.45rem 0 0.45rem 0.2rem;
		font-size: 0.75rem;
	}
	.citations span {
		display: block;
		color: var(--ink-soft);
		font-size: 0.65rem;
	}
	@media (max-width: 900px) {
		.explorer {
			display: block;
		}
		.controls {
			height: auto;
			overflow: visible;
			border-right: 0;
			border-bottom: 1px solid var(--line);
			padding: 1.5rem 1rem;
		}
		.explorer-heading h1 {
			font-size: 2.8rem;
		}
		.map-column {
			min-height: 0;
		}
		.map-frame {
			min-height: 300px;
			height: 48vh;
		}
	}
	@media (max-width: 620px) {
		.detail-panel {
			position: fixed;
			top: auto;
			bottom: 0;
			right: 0;
			width: 100%;
			max-height: 80vh;
		}
	}
</style>
