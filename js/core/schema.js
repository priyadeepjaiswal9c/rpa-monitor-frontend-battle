/**
 * schema.js — single source of truth for the dataset shape and the grid columns.
 *
 * The real CSV (automation_projects.csv) has these 18 columns. The provided
 * dataStream.js casts/mutates columns that DON'T exist here (JUNK_KEYS) and leaves
 * the REAL numerics as strings (NUMERIC_KEYS) — both handled in streamAdapter.js.
 */

/** Real numeric columns — arrive as strings from the stream; coerced into row.num. */
export const NUMERIC_KEYS = [
  'robots_deployed', 'budget_usd', 'annual_savings_usd', 'roi_percent', 'employee_hours_saved',
];

/** Phantom columns the provided stream mutates (→ NaN). Stripped on ingest. */
export const JUNK_KEYS = [
  'annual_revenue_usd', 'customer_count', 'market_share_percent', 'employee_count', 'founded_year',
];

/** Fuzzy search target columns. */
export const SEARCH_KEYS = ['project_name', 'company_id', 'implementation_partner', 'country'];

/** Categorical multi-select filter facets (cardinalities: 25 / 30 / 26). */
export const FILTER_FIELDS = [
  { key: 'automation_type', label: 'Automation' },
  { key: 'department',      label: 'Department' },
  { key: 'industry',        label: 'Industry' },
];

/** Infrastructure toggles — boolean facets. */
export const TOGGLE_FIELDS = [
  { key: 'ai_enabled',       label: 'AI Enabled' },
  { key: 'cloud_deployment', label: 'Cloud' },
];

export const STATUS_VALUES = ['Active', 'Completed', 'Planned'];

/**
 * Column definitions. `sortType` drives the comparator:
 *   'num'  → compares row.num[key] (fast numeric)
 *   'str'  → Intl.Collator on the string (ISO dates also sort correctly as strings)
 * `cls` is the value class (drives formatting + alignment in rowBinder).
 */
export const COLUMNS = [
  { key: 'project_id',           label: 'Project ID',   cls: 'mono',   align: 'l', w: 114, sortType: 'str', group: 'Identity' },
  { key: 'project_name',         label: 'Project',      cls: 'name',   align: 'l', w: 224, sortType: 'str', group: 'Identity' },
  { key: 'project_status',       label: 'Status',       cls: 'status', align: 'l', w: 120, sortType: 'str', group: 'Identity' },
  { key: 'robots_deployed',      label: 'Robots',       cls: 'int',    align: 'r', w: 88,  sortType: 'num', group: 'Deployment' },
  { key: 'budget_usd',           label: 'Budget',       cls: 'cur',    align: 'r', w: 128, sortType: 'num', group: 'Financials' },
  { key: 'annual_savings_usd',   label: 'Annual Savings', cls: 'cur',  align: 'r', w: 142, sortType: 'num', group: 'Financials' },
  { key: 'roi_percent',          label: 'ROI',          cls: 'pct',    align: 'r', w: 96,  sortType: 'num', group: 'Financials' },
  { key: 'employee_hours_saved', label: 'Hours Saved',  cls: 'int',    align: 'r', w: 120, sortType: 'num', group: 'Financials' },
  { key: 'automation_type',      label: 'Automation',   cls: 'text',   align: 'l', w: 182, sortType: 'str', group: 'Classification' },
  { key: 'department',           label: 'Department',   cls: 'text',   align: 'l', w: 176, sortType: 'str', group: 'Classification' },
  { key: 'industry',             label: 'Industry',     cls: 'text',   align: 'l', w: 192, sortType: 'str', group: 'Classification' },
  { key: 'ai_enabled',           label: 'AI',           cls: 'bool',   align: 'c', w: 66,  sortType: 'str', group: 'Deployment' },
  { key: 'cloud_deployment',     label: 'Cloud',        cls: 'bool',   align: 'c', w: 78,  sortType: 'str', group: 'Deployment' },
  { key: 'implementation_partner', label: 'Partner',    cls: 'text',   align: 'l', w: 150, sortType: 'str', group: 'Identity' },
  { key: 'country',              label: 'Country',      cls: 'text',   align: 'l', w: 124, sortType: 'str', group: 'Identity' },
  { key: 'company_id',           label: 'Company',      cls: 'mono',   align: 'l', w: 108, sortType: 'str', group: 'Identity' },
  { key: 'start_date',           label: 'Start',        cls: 'date',   align: 'l', w: 112, sortType: 'str', group: 'Timeline' },
  { key: 'completion_date',      label: 'Completed',    cls: 'date',   align: 'l', w: 124, sortType: 'str', group: 'Timeline' },
];

export const COL_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

/** Primary numeric sort columns (every column is sortable). */
export const PRIMARY_SORT_KEYS = ['budget_usd', 'roi_percent', 'employee_hours_saved'];
