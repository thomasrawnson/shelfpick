import {
  getPlayers,
  getStatsFilterOptions,
  type StatsFilterValues,
} from "../../api/client"
import { filtersActiveCount } from "../../stats-model"
import Disclosure from "../ui/Disclosure"
import { useStats } from "./useStats"

type Props = {
  filters: StatsFilterValues
  onChange: (filters: StatsFilterValues) => void
}

function numberOrUndefined(value: string): number | undefined {
  return value === "" ? undefined : Number(value)
}

// Pro: narrow every number on the Trends view by date, player, place and size.
export default function StatsFilters({ filters, onChange }: Props) {
  const options = useStats("filter-options", signal => getStatsFilterOptions(signal))
  const players = useStats("filter-players", () => getPlayers())
  const active = filtersActiveCount(filters)
  const update = (patch: StatsFilterValues) => onChange({ ...filters, ...patch })

  return (
    <Disclosure
      label="Filters"
      hint={active > 0 ? `${active} applied` : "Date, player, place, group size"}
      className="stats-filters"
    >
      <div className="stats-filter-grid">
        <label>
          <span>From</span>
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            min={options.data?.first_play ?? undefined}
            max={filters.dateTo ?? undefined}
            onChange={event => update({ dateFrom: event.target.value || undefined })}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={filters.dateTo ?? ""}
            min={filters.dateFrom ?? undefined}
            max={options.data?.last_play ?? undefined}
            onChange={event => update({ dateTo: event.target.value || undefined })}
          />
        </label>
        <label>
          <span>Player</span>
          <select
            value={filters.playerId ?? ""}
            onChange={event => update({ playerId: numberOrUndefined(event.target.value) })}
          >
            <option value="">Anyone</option>
            {(players.data ?? []).map(player => (
              <option key={player.id} value={player.id}>{player.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Location</span>
          <select
            value={filters.location ?? ""}
            onChange={event => update({ location: event.target.value || undefined })}
          >
            <option value="">Anywhere</option>
            {(options.data?.locations ?? []).map(location => (
              <option key={location.name} value={location.name}>{location.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Players at the table</span>
          <select
            value={filters.playerCount ?? ""}
            onChange={event => update({ playerCount: numberOrUndefined(event.target.value) })}
          >
            <option value="">Any number</option>
            {(options.data?.player_counts ?? []).map(count => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
        </label>
      </div>
      {active > 0 && (
        <button type="button" className="secondary-button" onClick={() => onChange({})}>
          Clear filters
        </button>
      )}
    </Disclosure>
  )
}
