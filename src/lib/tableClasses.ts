/**
 * A row's grid; tracks come from the inline template.
 * `min-w-min`: `docs/map/invariant/drawn-columns-are-tracks-are-cells.md`.
 */
export const TABLE_GRID = 'justable:grid justable:min-w-min justable:items-center';

/**
 * A cell's padding, held by the cell and never the grid (`docs/map/territory/stylesheet-and-prefix.md`),
 * and the cell as tall as its row with its content centred (`docs/map/territory/table-row.md`).
 */
export const TABLE_CELL = 'justable:px-2 justable:self-stretch justable:content-center';
