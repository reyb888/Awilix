# Awilix data sources, attribution, and accuracy notes

Last reviewed: 2026-11-09. This document describes the local preview build.

## Challenge and project scope

Awilix is a scenario comparison and educational tool for lunar surface lighting and geometric Earth visibility. Its outputs are exploratory estimates; they are not mission certification, a flight dynamics product, a power budget, or a communications link budget.

NASA Space Apps requires participants to cite sources used and provide appropriate license documentation for solution materials. The source copy used for this preview has no project-level `LICENSE` file, so the team must choose and add its project license before challenge submission. This document does not grant a license to Awilix code or assets.

Reference: [NASA Space Apps legal terms](https://www.spaceappschallenge.org/legal/) (reviewed 2026-11-09).

## Celestial directions

| Item | Source and use | Provenance and limits |
|---|---|---|
| Hourly 2026 direction table | `public/data/mooninfo_2026.json`; application attributes it to [NASA SVS 5587](https://svs.gsfc.nasa.gov/5587/) and uses hourly subsolar/sub-Earth directions and Earth distance. | SHA-256: `098ec6434ba4fecb84e66485385816d465b7969f142864bcfc9ffc68311b4a86`. Covers 2026-01-01 00:00 through 2026-12-31 23:00 UTC. The row timestamp, order, coordinate ranges, distance, and phase are validated at load. The source extraction URL/recipe and a separate independent SPICE/Horizons reference comparison are not present in this copy; attribution and checksum do not prove ephemeris accuracy. |
| Direction interpolation | Spherical interpolation on unit vectors between adjacent hourly subpoints. | Avoids longitude-wrap errors at ±180°. It does not add information between hourly records. |
| Outside table coverage | `astronomy-engine` package, analytic lunar orientation fallback. | Approximate fallback; not a NASA DE421 or SPICE validation claim. The Sun distance in the hourly-table path is fixed to 1 AU. |

## Terrain

The runtime terrain manifest is [`science-terrain/manifest.json`](science-terrain/manifest.json). It lists each bundled terrain asset, its SHA-256, stated source family, native resolution, display sampling, frame/datum status, and missing-value policy. The app has distinct source products: polar crops labeled as 80 m elevation with a separate 20 m mask, and lower-resolution LDEM16 regional crops at 16 pixels/degree. Resampling or mesh subdivision is display sampling; it does not create new measured detail.

Source family reference: [NASA PDS Geosciences Node, LRO LOLA](https://pds-geosciences.wustl.edu/missions/lro/lola.htm) (reviewed 2026-11-09). The original PDS raster labels, source rasters, exact product identifiers, and original NoData masks are not included in this copy. Terrain crops are marked experimental because body-fixed registration and height datum have not been independently verified. Legacy builders replaced some missing samples with zero; where that occurred, the original validity cannot be recovered. The current conservative mask may also remove valid zero-valued elevations. Do not treat terrain-derived horizon values as validated landing predictions.

Runtime assumptions: lunar planetocentric latitude and east-positive longitude; lunar radius 1,737.4 km; locally reconstructed crop registration; curvature-corrected local terrain only. The model excludes far-field terrain, solar-disk fraction, atmospheric refraction, antenna pattern, Earth station scheduling, radio link budget, and solar-array tracking. Reference-sphere mode excludes local topographic obstruction.

## Mission and location catalog

Catalog coordinates are regional comparison markers, not surveyed touchdown coordinates. Mission associations are explicitly labeled as regional or unconfirmed. In particular, NASA records IM-2 Athena reaching the surface near Mons Mouton on 2025-03-06, and Blue Ghost 1 landing at Mare Crisium on 2025-03-02 and concluding its mission on 2025-03-16:

- [NASA: IM-2 on the Moon’s surface](https://www.nasa.gov/image-article/nasas-lunar-reconnaissance-orbiter-views-im-2-on-moons-surface/) (published 2025-03-25; reviewed 2026-11-09).
- [NASA: Blue Ghost 1 landing](https://www.nasa.gov/news-release/touchdown-carrying-nasa-science-fireflys-blue-ghost-lands-on-moon/) (published 2025-03-02; reviewed 2026-11-09).
- [NASA: Blue Ghost 1 mission conclusion](https://www.nasa.gov/news-release/nasa-science-continues-after-fireflys-first-moon-mission-concludes/) (published 2025-03-18; reviewed 2026-11-09).
- [NASA: Artemis III 2027 Earth-orbit test](https://www.nasa.gov/missions/artemis/nasa-shares-plans-to-accelerate-artemis-return-to-moon/) (published 2026-11-04; reviewed 2026-11-09). It is not a lunar landing date preset.
- [NASA: IM-3 / Lunar Vertex region](https://science.nasa.gov/lunar-science/clps-deliveries/cp-11/) (reviewed 2026-11-09). Its Reiner Gamma association is regional; the catalog does not assert the latest schedule or landing result.
- [NASA: IM-1 landing at Malapert A](https://science.nasa.gov/moon/missions/) (reviewed 2026-11-09). The selected Malapert coordinate is still a regional comparison marker.

Other future associations are not represented as confirmed site assignments. Review all mission schedules and catalog facts against current primary sources before submission; these schedules can change.

## Software and licenses

The runtime analytic fallback uses the [`astronomy-engine` npm package](https://www.npmjs.com/package/astronomy-engine); the project lockfile pins dependency versions. Third-party package licenses are supplied with their respective packages under `node_modules` after install and must be included in any distribution review. No project-level license was found in this source copy. The team should decide the source and asset license and include the corresponding license files before public challenge submission.

NASA marks and imagery are not implied to be endorsed by NASA. Review each asset’s original source and usage terms before redistribution; the presence of a NASA URL or a data checksum is not itself a license grant.
