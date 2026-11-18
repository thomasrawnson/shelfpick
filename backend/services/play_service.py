from models.play import Play
from services.play_results import normalize_results
from services.scoresheet_service import (
    ScoresheetNotFound,
    ScoresheetService,
    apply_scoresheet,
)
from repositories.play_repository import (
    PlayRepository,
)


class PlayService:
    def __init__(
        self,
        repository: PlayRepository,
        scoresheets: ScoresheetService,
    ):
        self.repository = repository
        self.scoresheets = scoresheets

    @staticmethod
    def _normalize_player_name(
        name: str,
    ) -> str:
        return " ".join(
            name
            .strip()
            .lower()
            .split()
        )

    def record_play(
        self,
        bgg_id: int,
        played_at,
        duration_minutes: int | None,
        participants: list[dict],
        location: str | None = None,
        timer_session_id: str | None = None,
        outcome_type: str = "competitive",
        coop_result: str | None = None,
        scoresheet_id: int | None = None,
        scoresheet_version: int | None = None,
        result_override: bool = False,
    ) -> Play | None:
        self._reject_duplicate_players(participants)
        state = self._score(
            {
                "bgg_id": bgg_id,
                "outcome_type": outcome_type,
                "coop_result": coop_result,
                "participants": participants,
                "scoresheet_id": scoresheet_id,
                "scoresheet_version": scoresheet_version,
                "result_override": result_override,
            }
        )
        coop_result, participants = normalize_results(
            state["outcome_type"], state["coop_result"], state["participants"]
        )

        cleaned_location = " ".join(location.split()) if location else None

        return self.repository.create(
            bgg_id=bgg_id,
            played_at=played_at,
            duration_minutes=(
                duration_minutes
            ),
            participants=participants,
            location=cleaned_location or None,
            timer_session_id=timer_session_id,
            outcome_type=state["outcome_type"],
            coop_result=coop_result,
            scoresheet_id=state["scoresheet_id"],
            scoresheet_version=state["scoresheet_version"],
            result_overridden=state["result_override"],
        )

    def update_play(
        self,
        play_id: int,
        changes: dict,
    ) -> dict | None:
        """Apply a partial edit. ``changes`` holds only the sent fields."""
        state = self.repository.get_play_for_edit(play_id)
        if state is None:
            return None

        if changes.get("result_override") is None:
            changes.pop("result_override", None)
        if "scoresheet_id" in changes:
            if changes["scoresheet_id"] is None:
                # Back to plain scores: drop the breakdowns, keep the totals.
                changes["scoresheet_version"] = None
                for participant in changes.get(
                    "participants", state["participants"]
                ):
                    participant["score_breakdown"] = None
            elif "scoresheet_version" not in changes:
                changes["scoresheet_version"] = None
        state.update(changes)
        if state["played_at"] is None:
            raise ValueError("A play needs a date.")
        if state["location"] is not None:
            state["location"] = (
                " ".join(state["location"].split()) or None
            )

        self._reject_duplicate_players(state["participants"])
        state = self._score(state)
        state["coop_result"], state["participants"] = normalize_results(
            state["outcome_type"],
            state["coop_result"],
            state["participants"],
        )

        updated = self.repository.update(play_id, state)
        if updated is None:
            raise ValueError("Game not found in your collection.")
        return updated

    def _score(self, state: dict) -> dict:
        """Apply the play's scoresheet, if any, to ``state``.

        Pins the sheet version the breakdowns belong to (the current one
        unless a version is given) and recomputes scores and, without an
        override, the result.
        """
        if state["scoresheet_id"] is None:
            if any(
                p.get("score_breakdown") is not None
                for p in state["participants"]
            ):
                raise ValueError("Scoresheet entries need a scoresheet.")
            return {
                **state,
                "scoresheet_version": None,
                "result_override": False,
            }

        try:
            sheet, schema, version = self.scoresheets.resolve(
                state["scoresheet_id"], state["scoresheet_version"]
            )
        except ScoresheetNotFound:
            raise ValueError("Scoresheet not found.") from None
        if sheet.bgg_game_id != state["bgg_id"]:
            raise ValueError("That scoresheet is for a different game.")

        outcome_type, coop_result, participants = apply_scoresheet(
            schema,
            state["outcome_type"],
            state["coop_result"],
            state["participants"],
            bool(state["result_override"]),
        )
        return {
            **state,
            "outcome_type": outcome_type,
            "coop_result": coop_result,
            "participants": participants,
            "scoresheet_version": version,
            "result_override": bool(state["result_override"]),
        }

    def _reject_duplicate_players(self, participants: list[dict]) -> None:
        names = [
            self._normalize_player_name(participant["name"])
            for participant in participants
        ]
        if len(set(names)) != len(names):
            raise ValueError("The same player cannot be added twice.")

    def delete_play(
        self,
        play_id: int,
    ) -> bool:
        return (
            self.repository.delete(
                play_id
            )
        )
