import type { ReactNode } from "react"

import ChoiceGroup
  from "../ui/ChoiceGroup"

export type SortOption =
  | "name"
  | "recent"
  | "most-played"
  | "rating"
  | "complexity"


export type PlayFilter =
  | "all"
  | "played"
  | "never"


type Props = {
  search: string
  sort: SortOption
  playFilter: PlayFilter
  onSearchChange: (
    value: string,
  ) => void
  onSortChange: (
    value: SortOption,
  ) => void
  onPlayFilterChange: (
    value: PlayFilter,
  ) => void
  trailing?: ReactNode
}


function CollectionFilters({
  search,
  sort,
  playFilter,
  onSearchChange,
  onSortChange,
  onPlayFilterChange,
  trailing,
}: Props) {
  return (
    <div className="shelf-tools">
      <div className="shelf-toolbar">
        <label className="shelf-search" htmlFor="collection-search">
          <span className="sr-only">Search your games</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            id="collection-search"
            name="collection_search"
            type="search"
            value={search}
            placeholder="Search"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="shelf-sort">
          <select
            id="collection-sort"
            name="collection_sort"
            value={sort}
            aria-label="Sort games"
            onChange={(event) => onSortChange(event.target.value as SortOption)}
          >
            <option value="name">A–Z</option>
            <option value="recent">Recent</option>
            <option value="most-played">Most played</option>
            <option value="rating">Rating</option>
            <option value="complexity">Complexity</option>
          </select>
        </div>
        {trailing}
      </div>

      <ChoiceGroup
        variant="chips"
        value={playFilter}
        ariaLabel="Filter collection"
        options={[
          { value: "all", label: "All" },
          { value: "played", label: "Played" },
          { value: "never", label: "Unplayed" },
        ]}
        onChange={onPlayFilterChange}
      />
    </div>
  )
}


export default CollectionFilters
