import type { ReactNode } from "react"

import FilterTabs
  from "../ui/FilterTabs"

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
    <div className="collection-tools">
      <div className="collection-search-sort-row">
        <label
          className="collection-search-wrap"
          htmlFor="collection-search"
        >
          <span className="sr-only">
            Search your games
          </span>

          <input
            id="collection-search"
            name="collection_search"
            className="collection-search"
            type="search"
            value={search}
            placeholder="Search"
            onChange={(event) =>
              onSearchChange(
                event.target.value
              )
            }
          />
        </label>

        <label
          className="collection-sort-wrap"
          htmlFor="collection-sort"
        >
          <span className="sr-only">
            Sort games
          </span>

          <select
            id="collection-sort"
            name="collection_sort"
            className="collection-sort"
            value={sort}
            aria-label="Sort games"
            onChange={(event) =>
              onSortChange(
                event.target
                  .value as SortOption
              )
            }
          >
            <option value="name">
              A–Z
            </option>

            <option value="recent">
              Recent
            </option>

            <option value="most-played">
              Most played
            </option>

            <option value="rating">
              Rating
            </option>

            <option value="complexity">
              Complexity
            </option>
          </select>
        </label>
        {trailing}
      </div>

      <FilterTabs
        value={playFilter}
        ariaLabel="Filter collection"
        options={[
          { value: "all", label: "All" },
          { value: "played", label: "Played" },
          { value: "never", label: "Unplayed" },
        ]}
        onChange={
          onPlayFilterChange
        }
      />
    </div>
  )
}


export default CollectionFilters
