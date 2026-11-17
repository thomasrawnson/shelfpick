"""Validation and outcome rules for recorded play results.

A play's result lives in three places: ``outcome_type`` and ``coop_result`` on
the play, and ``team``, ``rank`` and ``is_winner`` on each participant.
``normalize_results`` validates one combination and derives ``is_winner`` so
SQL aggregates that count winners stay correct. ``resolve_outcome`` turns a
stored play back into win, loss, draw or unknown for one participant.
"""

OUTCOME_TYPES = ("competitive", "cooperative", "team", "solo")
COOP_RESULTS = ("won", "lost")


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def normalize_results(
    outcome_type: str,
    coop_result: str | None,
    participants: list[dict],
) -> tuple[str | None, list[dict]]:
    """Validate a result combination and derive each participant's win flag.

    Returns ``(coop_result, participants)`` with ``is_winner``, ``team``,
    ``role`` and ``rank`` normalised. Raises ``ValueError`` with a message
    suitable for the API client.
    """
    if outcome_type not in OUTCOME_TYPES:
        raise ValueError("Unknown outcome type.")
    if coop_result is not None and coop_result not in COOP_RESULTS:
        raise ValueError("Co-op result must be won or lost.")

    rows = []
    for participant in participants:
        rank = participant.get("rank")
        if rank is not None and rank < 1:
            raise ValueError("Ranks must be positive.")
        rows.append(
            {
                **participant,
                "team": _clean(participant.get("team")),
                "role": _clean(participant.get("role")),
                "rank": rank,
                "is_winner": bool(participant.get("is_winner", False)),
            }
        )

    if outcome_type in ("cooperative", "solo"):
        if any(row["team"] or row["rank"] is not None for row in rows):
            raise ValueError(
                "Co-op and solo plays do not use teams or ranks."
            )
        if any(row["is_winner"] for row in rows):
            raise ValueError(
                "Co-op and solo plays record one shared result, "
                "not winners."
            )
        if outcome_type == "cooperative" and coop_result is None:
            raise ValueError("A co-op play needs a Won or Lost result.")
        if outcome_type == "solo" and len(rows) != 1:
            raise ValueError("A solo play has exactly one player.")
        for row in rows:
            row["is_winner"] = coop_result == "won"
        return coop_result, rows

    if coop_result is not None:
        raise ValueError(
            "Only co-op and solo plays have a Won or Lost result."
        )

    if outcome_type == "team":
        return None, _normalize_team(rows)

    return None, _normalize_competitive(rows)


def _normalize_competitive(rows: list[dict]) -> list[dict]:
    if any(row["team"] for row in rows):
        raise ValueError("Teams are only used by team plays.")

    ranked = [row for row in rows if row["rank"] is not None]
    if not ranked:
        return rows
    if len(ranked) != len(rows):
        raise ValueError("Give every player a rank, or none.")

    for row in rows:
        derived = row["rank"] == 1
        if row["is_winner"] and not derived:
            raise ValueError(
                "A winner must be ranked first."
            )
        row["is_winner"] = derived
    return rows


def _normalize_team(rows: list[dict]) -> list[dict]:
    if any(not row["team"] for row in rows):
        raise ValueError("Every player in a team play needs a team.")

    canonical: dict[str, str] = {}
    for row in rows:
        row["team"] = canonical.setdefault(row["team"].casefold(), row["team"])
    teams = set(canonical.values())
    if len(teams) < 2:
        raise ValueError("A team play needs at least two teams.")

    ranked = [row for row in rows if row["rank"] is not None]
    if ranked:
        if len(ranked) != len(rows):
            raise ValueError("Give every player a rank, or none.")
        for team in teams:
            if len({row["rank"] for row in rows if row["team"] == team}) > 1:
                raise ValueError("Players on one team share a rank.")
        for row in rows:
            derived = row["rank"] == 1
            if row["is_winner"] and not derived:
                raise ValueError("A winner must be ranked first.")
            row["is_winner"] = derived
        return rows

    winning_teams = {row["team"] for row in rows if row["is_winner"]}
    for team in winning_teams:
        if not all(row["is_winner"] for row in rows if row["team"] == team):
            raise ValueError(
                "Every member of the winning team shares the win."
            )
    return rows


def resolve_outcome(
    participant,
    play,
    is_cooperative_game: bool = False,
) -> str:
    """Return win, loss, draw or unknown for one participant of a play."""
    outcome_type = play.outcome_type

    if outcome_type in ("cooperative", "solo"):
        if play.coop_result == "won":
            return "win"
        if play.coop_result == "lost":
            return "loss"
        return "unknown"

    if outcome_type == "team":
        winners = [p for p in play.participants if p.is_winner]
        if not winners:
            return "unknown"
        if not participant.is_winner:
            return "loss"
        if len({p.team for p in winners}) > 1:
            return "draw"
        return "win"

    if any(p.rank is not None for p in play.participants):
        if participant.rank is None:
            return "unknown"
        top = [p for p in play.participants if p.rank == 1]
        if not top:
            return "unknown"
        if participant.rank != 1:
            return "loss"
        return "draw" if len(top) > 1 else "win"

    return _resolve_flagged_outcome(participant, play, is_cooperative_game)


def _resolve_flagged_outcome(participant, play, is_cooperative_game) -> str:
    """Outcome for plays that only carry ``is_winner`` flags.

    This covers every play recorded before results were structured, and any
    competitive play saved without ranks.
    """
    winners = [p for p in play.participants if p.is_winner]
    if not winners:
        return "unknown"
    if not participant.is_winner:
        return "loss"
    if is_cooperative_game and len(winners) == len(play.participants):
        return "win"
    is_scored_tie = (
        len(winners) > 1
        and all(w.score is not None for w in winners)
        and all(w.score == winners[0].score for w in winners)
    )
    return "draw" if is_scored_tie else "win"
