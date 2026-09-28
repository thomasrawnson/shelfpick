from sqlalchemy.orm import Session

from auth.schemas import ProfileUpdateRequest
from database.models import Player, User


def update_profile(
    db: Session,
    user: User,
    changes: ProfileUpdateRequest,
    *,
    complete_onboarding: bool = False,
) -> User:
    fields = changes.model_fields_set
    requested_name = changes.player_name
    if requested_name is not None:
        name = " ".join(requested_name.split())
    elif user.profile_player is None and complete_onboarding:
        name = (user.display_name or user.email.split("@", 1)[0]).strip()
    else:
        name = None

    if name is not None:
        if not name:
            raise ValueError("Enter a player name")
        normalized = name.lower()
        existing = (
            db.query(Player)
            .filter(Player.user_id == user.id, Player.normalized_name == normalized)
            .first()
        )
        if existing is not None and existing.id != user.profile_player_id:
            raise ValueError("That name is already used by another player")
        if user.profile_player is None:
            player = Player(user_id=user.id, name=name, normalized_name=normalized)
            db.add(player)
            db.flush()
            user.profile_player_id = player.id
            user.profile_player = player
        else:
            user.profile_player.name = name
            user.profile_player.normalized_name = normalized

    if "avatar_key" in fields and changes.avatar_key is not None:
        if user.profile_player is None:
            raise ValueError("Set a player name before choosing an avatar")
        user.profile_player.avatar_key = changes.avatar_key
    if "preferred_player_count" in fields:
        user.preferred_player_count = changes.preferred_player_count
    if "preferred_play_time" in fields:
        user.preferred_play_time = changes.preferred_play_time
    if "preferred_play_style" in fields:
        user.preferred_play_style = changes.preferred_play_style
    if complete_onboarding:
        user.onboarding_completed = True

    db.commit()
    db.refresh(user)
    return user
