from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from database.connection import Base


game_categories = Table(
    "game_categories",
    Base.metadata,
    Column(
        "game_id",
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
    Column(
        "category_id",
        ForeignKey(
            "categories.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)


game_mechanics = Table(
    "game_mechanics",
    Base.metadata,
    Column(
        "game_id",
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
    Column(
        "mechanic_id",
        ForeignKey(
            "mechanics.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    display_name: Mapped[str | None] = mapped_column(
        String(100),
    )

    bgg_username: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
    )
    preferred_player_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferred_play_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferred_play_style: Mapped[str | None] = mapped_column(String(16), nullable=True)
    profile_player_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "players.id", ondelete="SET NULL", use_alter=True,
            name="fk_users_profile_player_id",
        ), nullable=True,
    )
    profile_player = relationship("Player", foreign_keys=[profile_player_id], post_update=True)

    tier: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="FREE",
        server_default="FREE",
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    email_verified_at: Mapped[
        datetime | None
        ] = mapped_column(
            DateTime(timezone=True),
            nullable=True,
        )
    
    user_games = relationship(
        "UserGame",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    wishlist_games = relationship(
        "UserWishlistGame",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    players = relationship(
        "Player",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Player.user_id",
    )

    picker_sessions = relationship(
        "PickerSession",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class AuthToken(Base):
    __tablename__ = "auth_tokens"

    __table_args__ = (
        Index(
            "ix_auth_tokens_lookup",
            "token_hash",
            "purpose",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    purpose: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    used_at: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
class UserGame(Base):
    __tablename__ = "user_games"

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    game_id: Mapped[int] = mapped_column(
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="bgg",
        server_default="bgg",
    )


    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user = relationship(
        "User",
        back_populates="user_games",
    )

    game = relationship(
        "Game",
        back_populates="user_games",
    )


class UserWishlistGame(Base):
    __tablename__ = "user_wishlist_games"

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    game_id: Mapped[int] = mapped_column(
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user = relationship(
        "User",
        back_populates="wishlist_games",
    )

    game = relationship(
        "Game",
        back_populates="wishlist_users",
    )


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    bgg_id: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    year_published: Mapped[int | None] = mapped_column(
        Integer,
    )

    min_players: Mapped[int | None] = mapped_column(
        Integer,
    )

    max_players: Mapped[int | None] = mapped_column(
        Integer,
    )

    best_player_counts: Mapped[list[int]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    recommended_player_counts: Mapped[list[int]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    player_count_poll: Mapped[list[dict]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    min_play_time: Mapped[int | None] = mapped_column(
        Integer,
    )

    max_play_time: Mapped[int | None] = mapped_column(
        Integer,
    )

    min_age: Mapped[int | None] = mapped_column(
        Integer,
    )

    min_age_checked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    complexity: Mapped[float | None] = mapped_column(
        Float,
    )

    rating: Mapped[float | None] = mapped_column(
        Float,
    )

    is_expansion: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    expansion_checked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    designers: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    publishers: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    credits_checked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Temporary compatibility field.
    # Ownership will move entirely to UserGame.
    owned: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    image_url: Mapped[str | None] = mapped_column(
        String(500),
    )

    thumbnail_url: Mapped[str | None] = mapped_column(
        String(500),
    )

    categories = relationship(
        "Category",
        secondary=game_categories,
        lazy="selectin",
    )

    mechanics = relationship(
        "Mechanic",
        secondary=game_mechanics,
        lazy="selectin",
    )

    user_games = relationship(
        "UserGame",
        back_populates="game",
        cascade="all, delete-orphan",
    )

    wishlist_users = relationship(
        "UserWishlistGame",
        back_populates="game",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class Player(Base):
    __tablename__ = "players"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "normalized_name",
            name="uq_players_user_normalized_name",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    normalized_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    avatar_key: Mapped[str] = mapped_column(
        String(16), nullable=False, default="forest", server_default="forest",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user = relationship(
        "User",
        back_populates="players",
        foreign_keys=[user_id],
    )

    participants = relationship(
        "PlayParticipant",
        back_populates="player",
    )
class Play(Base):
    __tablename__ = "plays"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "source",
            "source_play_id",
            name=(
                "uq_plays_user_source_play_id"
            ),
        ),
        Index(
            "ix_plays_user_id_played_at",
            "user_id",
            "played_at",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    game_id: Mapped[int] = mapped_column(
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    player_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    duration_minutes: Mapped[int | None] = mapped_column(
        Integer,
    )

    location: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
    )

    timer_session_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, unique=True,
    )

    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="app",
    )

    source_play_id: Mapped[str | None] = mapped_column(
        String(100),
    )

    participants = relationship(
        "PlayParticipant",
        back_populates="play",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class LivePlayTimer(Base):
    __tablename__ = "live_play_timers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True,
    )
    game_id: Mapped[int] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    accumulated_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    running_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    draft_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    game = relationship("Game")

class PlayParticipant(Base):
    __tablename__ = "play_participants"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    play_id: Mapped[int] = mapped_column(
        ForeignKey(
            "plays.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    score: Mapped[float | None] = mapped_column(
        Float,
    )

    is_winner: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    play = relationship(
        "Play",
        back_populates="participants",
    )

    player_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "players.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    player = relationship(
        "Player",
        back_populates="participants",
    )


class PickerSession(Base):
    __tablename__ = "picker_sessions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    public_id: Mapped[str] = mapped_column(
        String(36),
        unique=True,
        nullable=False,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    criteria: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    recommendation_bgg_ids: Mapped[list[int]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user = relationship(
        "User",
        back_populates="picker_sessions",
    )

    events = relationship(
        "PickerEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class PickerEvent(Base):
    __tablename__ = "picker_events"

    __table_args__ = (
        Index(
            "ix_picker_events_session_created_at",
            "picker_session_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    picker_session_id: Mapped[int] = mapped_column(
        ForeignKey(
            "picker_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    event_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    bgg_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    position: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    session = relationship(
        "PickerSession",
        back_populates="events",
    )


class GameRanking(Base):
    __tablename__ = "game_rankings"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "game_id",
            name="uq_game_rankings_user_game",
        ),
        Index(
            "ix_game_rankings_user_rating",
            "user_id",
            "rating",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    game_id: Mapped[int] = mapped_column(
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    rating: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=1500.0,
        server_default="1500",
    )

    comparisons_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    wins: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    losses: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    excluded: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class GameComparison(Base):
    __tablename__ = "game_comparisons"

    __table_args__ = (
        Index(
            "ix_game_comparisons_user_created_at",
            "user_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    winner_game_id: Mapped[int] = mapped_column(
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    loser_game_id: Mapped[int] = mapped_column(
        ForeignKey(
            "games.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

class Category(Base):
    __tablename__ = "categories"

    id = Column(
        Integer,
        primary_key=True,
    )

    name = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )


class Mechanic(Base):
    __tablename__ = "mechanics"

    id = Column(
        Integer,
        primary_key=True,
    )

    name = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
