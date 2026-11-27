import { useState } from 'react';
import { Camera, CalendarDays, FilterX, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import type { CategorySlug } from '../../types/category';
import type { ReportSort, ReportStatus, SearchFilters } from '../../types/report';
import { CATEGORY_SLUGS, ITEM_CATEGORIES } from '../../utils/categories';
import { REPORT_STATUS_LABELS } from '../../utils/reportLabels';
import { useUrlBackedText } from '../../hooks/useUrlBackedText';
import { Button } from '../common/Button';
import { SegmentedControl } from '../forms/SegmentedControl';
import { SelectField } from '../forms/SelectField';
import { TextField } from '../forms/TextField';
import styles from './FilterBar.module.css';

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
] as const;

const CATEGORY_OPTIONS = CATEGORY_SLUGS.map((slug) => ({ value: slug, label: ITEM_CATEGORIES[slug].label }));
const STATUS_OPTIONS = (Object.keys(REPORT_STATUS_LABELS) as ReportStatus[]).map((status) => ({
  value: status,
  label: REPORT_STATUS_LABELS[status],
}));
const SORT_OPTIONS: { value: ReportSort; label: string }[] = [
  { value: 'newest', label: 'Newest reports first' },
  { value: 'date', label: 'Most recent lost or found date' },
  { value: 'relevance', label: 'Best match for my search' },
];

const TYPING_DELAY_MS = 350;

type FilterBarProps = {
  filters: SearchFilters;
  onChange: (changes: Partial<SearchFilters>) => void;
  onClear: () => void;
};

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const advancedCount = [filters.categorySlug, filters.status, filters.location, filters.from, filters.to].filter(Boolean).length;
  const hasAnyFilter = advancedCount > 0 || Boolean(filters.query) || Boolean(filters.type) || filters.sort !== 'newest';
  const [moreOpen, setMoreOpen] = useState(advancedCount > 0);

  const queryBox = useUrlBackedText(filters.query, (query) => onChange({ query }), TYPING_DELAY_MS);
  const locationBox = useUrlBackedText(filters.location, (location) => onChange({ location }), TYPING_DELAY_MS);

  return (
    <form className={styles.bar} role="search" aria-label="Search reports" onSubmit={(event) => event.preventDefault()}>
      <div className={styles.searchRow}>
        <div className={styles.searchField}>
          <TextField
            label="Search by item name or description"
            type="search"
            icon={Search}
            placeholder="For example: black umbrella"
            value={queryBox.text}
            maxLength={100}
            onChange={(event) => queryBox.onChange(event.target.value)}
          />
        </div>

        {/* The interface is reserved here. Photo matching itself is connected in Phase 8. */}
        <Button
          variant="secondary"
          leadingIcon={Camera}
          disabled
          title="Search by photo is coming in a later update"
          className={styles.photoSearch}
        >
          Search by photo
        </Button>
      </div>

      <div className={styles.controlsRow}>
        <SegmentedControl
          legend="Report type"
          value={filters.type}
          options={TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          onChange={(type) => onChange({ type })}
        />

        <div className={styles.sort}>
          <SelectField
            label="Sort by"
            value={filters.sort}
            options={SORT_OPTIONS}
            onChange={(event) => onChange({ sort: event.target.value as ReportSort })}
          />
        </div>
      </div>

      <details className={styles.more} open={moreOpen} onToggle={(event) => setMoreOpen(event.currentTarget.open)}>
        <summary className={styles.summary}>
          <SlidersHorizontal aria-hidden="true" />
          <span>More filters{advancedCount > 0 ? ` (${advancedCount})` : ''}</span>
        </summary>

        <div className={styles.moreGrid}>
          <SelectField
            label="Category"
            placeholder="All categories"
            value={filters.categorySlug}
            options={CATEGORY_OPTIONS}
            onChange={(event) => onChange({ categorySlug: event.target.value as CategorySlug | '' })}
          />
          <SelectField
            label="Status"
            placeholder="Any status"
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(event) => onChange({ status: event.target.value as ReportStatus | '' })}
          />
          <TextField
            label="Location"
            icon={MapPin}
            placeholder="For example: Library"
            value={locationBox.text}
            maxLength={100}
            onChange={(event) => locationBox.onChange(event.target.value)}
          />
          <TextField
            label="Lost or found from"
            type="date"
            icon={CalendarDays}
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => onChange({ from: event.target.value })}
          />
          <TextField
            label="Lost or found until"
            type="date"
            icon={CalendarDays}
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </div>
      </details>

      {hasAnyFilter ? (
        <div className={styles.clearRow}>
          <Button variant="ghost" size="sm" leadingIcon={FilterX} onClick={onClear}>
            Clear all filters
          </Button>
        </div>
      ) : null}
    </form>
  );
}
