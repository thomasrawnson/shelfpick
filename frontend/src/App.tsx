import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { SessionExpiredError } from "./api/request";
import RetryNotice from "./components/ui/RetryNotice";
import BrandLogo from "./components/ui/BrandLogo";
import { getMe } from "./api/client";

import { clearToken, getToken, type AuthUser } from "./auth";

import AuthView from "./components/AuthView";

import CollectionView, {
  type CollectionScrollPositions,
  type CollectionSection,
  type CollectionUiState,
} from "./components/CollectionView";

import DiscoverView from "./components/DiscoverView";

import InsightsView from "./components/InsightsView";

import GameNightView from "./components/GameNightView";

import OnboardingView from "./components/OnboardingView";

import SetupView from "./components/SetupView";
import ProfileSettings from "./components/ProfileSettings";
import SettingsView from "./components/SettingsView";
import ProComparisonView from "./components/ProComparisonView";
import PlayerAvatar from "./components/ui/PlayerAvatar";

import AppNavigation, { type AppView } from "./components/AppNavigation";

import PickerView from "./components/picker/PickerView";

import ForgotPasswordView from "./components/ForgotPasswordView";

import ResetPasswordView from "./components/ResetPasswordView";

import VerifyEmailView from "./components/VerifyEmailView";

import {
  APP_PATHS,
  appViewForPath,
  collectionGamePath,
  collectionPath,
  isProtectedAppPath,
  safeReturnPath,
  wishlistGamePath,
} from "./routes";

import "./App.css";

type NavigationState = {
  from?: string;
  detailOrigin?: "collection";
};

type CollectionRouteProps = {
  uiState: CollectionUiState;
  onUiStateChange: Dispatch<SetStateAction<CollectionUiState>>;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  scrollPositionsRef: React.RefObject<CollectionScrollPositions>;
};

type AppHeaderProps = {
  onOpenSettings: () => void;
  user: AuthUser;
};

function AppHeader({ onOpenSettings, user }: AppHeaderProps) {
  return (
    <header className="app-top-bar">
      <button
        type="button"
        className="dice-menu-button"
        onClick={onOpenSettings}
        aria-label={"Open profile and settings for " + user.player_name}
        title="Profile and settings"
      >
        <PlayerAvatar name={user.player_name} variant={user.avatar_key} />
      </button>

    </header>
  );
}

function pageShell(content: React.ReactNode) {
  return (
    <main className="app-shell">
      <section className="phone">{content}</section>
    </main>
  );
}

function CollectionRoute({
  uiState,
  onUiStateChange,
  scrollContainerRef,
  scrollPositionsRef,
}: CollectionRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const wildcard = useParams()["*"] ?? "";

  let section: CollectionSection | null = null;
  let gameBggId: number | null = null;
  let wishlistGameBggId: number | null = null;
  let validRoute = true;

  if (wildcard === "owned") {
    section = "owned";
  } else if (wildcard === "want-to-play") {
    section = "wishlist";
  } else if (wildcard === "ranking") {
    section = "ranking";
  } else if (wildcard.startsWith("owned/")) {
    const gameIdText = wildcard.slice("owned/".length);
    const parsedGameId = Number(gameIdText);

    if (
      /^\d+$/.test(gameIdText) &&
      Number.isSafeInteger(parsedGameId) &&
      parsedGameId > 0
    ) {
      section = "owned";
      gameBggId = parsedGameId;
    } else {
      validRoute = false;
    }
  } else if (wildcard.startsWith("want-to-play/")) {
    const gameIdText = wildcard.slice("want-to-play/".length);
    const parsedGameId = Number(gameIdText);

    if (
      /^\d+$/.test(gameIdText) &&
      Number.isSafeInteger(parsedGameId) &&
      parsedGameId > 0
    ) {
      section = "wishlist";
      wishlistGameBggId = parsedGameId;
    } else {
      validRoute = false;
    }
  } else if (wildcard !== "") {
    validRoute = false;
  }

  useEffect(() => {
    if (section && uiState.section !== section) {
      onUiStateChange((current) => ({
        ...current,
        section,
      }));
    }
  }, [onUiStateChange, section, uiState.section]);

  const handleGameUnavailable = useCallback(() => {
    navigate(APP_PATHS.collectionOwned, { replace: true });
  }, [navigate]);

  const handleCloseGame = useCallback(() => {
    const navigationState = location.state as NavigationState | null;

    if (navigationState?.detailOrigin === "collection") {
      navigate(-1);
      return;
    }

    navigate(APP_PATHS.collectionOwned);
  }, [location.state, navigate]);

  const handleOpenWishlistGame = useCallback(
    (bggId: number) => {
      navigate(wishlistGamePath(bggId), {
        state: {
          detailOrigin: "collection",
        } satisfies NavigationState,
      });
    },
    [navigate],
  );

  const handleCloseWishlistGame = useCallback(() => {
    navigate(APP_PATHS.collectionWishlist);
  }, [navigate]);

  const handleWishlistGameUnavailable = useCallback(() => {
    navigate(APP_PATHS.collectionWishlist, { replace: true });
  }, [navigate]);

  const handleWishlistGameConverted = useCallback(
    (bggId: number) => {
      navigate(collectionGamePath(bggId), { replace: true });
    },
    [navigate],
  );

  if (wildcard === "") {
    return <Navigate to={collectionPath(uiState.section)} replace />;
  }

  if (!validRoute || section === null) {
    return <Navigate to={APP_PATHS.collectionOwned} replace />;
  }

  return (
    <CollectionView
      uiState={{
        ...uiState,
        section,
      }}
      onUiStateChange={onUiStateChange}
      scrollContainerRef={scrollContainerRef}
      scrollPositionsRef={scrollPositionsRef}
      gameBggId={gameBggId}
      wishlistGameBggId={wishlistGameBggId}
      onOpenGame={(bggId) => {
        navigate(collectionGamePath(bggId), {
          state: {
            detailOrigin: "collection",
          } satisfies NavigationState,
        });
      }}
      onCloseGame={handleCloseGame}
      onGameUnavailable={handleGameUnavailable}
      onOpenWishlistGame={handleOpenWishlistGame}
      onCloseWishlistGame={handleCloseWishlistGame}
      onWishlistGameUnavailable={handleWishlistGameUnavailable}
      onWishlistGameConverted={handleWishlistGameConverted}
      onSectionChange={(nextSection) => {
        navigate(collectionPath(nextSection));
      }}
      onBrowseDiscover={() => {
        navigate(APP_PATHS.discover);
      }}
    />
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<AuthUser | null>(null);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [collectionUiState, setCollectionUiState] = useState<CollectionUiState>(
    {
      section: "owned",
      search: "",
      sort: "name",
      playFilter: "all",
    },
  );

  const collectionScrollPositions = useRef<CollectionScrollPositions>({
    owned: 0,
    wishlist: 0,
    ranking: 0,
  });

  const appScrollRef = useRef<HTMLElement | null>(null);

  const resetCollectionUiState = useCallback(() => {
    setCollectionUiState({
      section: "owned",
      search: "",
      sort: "name",
      playFilter: "all",
    });

    collectionScrollPositions.current = {
      owned: 0,
      wishlist: 0,
      ranking: 0,
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      if (!getToken()) {
        setCheckingAuth(false);
        return;
      }

      try {
        const currentUser = await getMe();

        if (active) setUser(currentUser);
      } catch (err) {
        if (active && !(err instanceof SessionExpiredError)) setRestoreError(err instanceof Error ? err.message : "Couldn't restore your session.");
      } finally {
        if (active) setCheckingAuth(false);
      }
    }

    void restoreSession();
    return () => { active = false; };
  }, [restoreAttempt]);

  useEffect(() => {
    function handleAuthExpired() {
      setSessionExpired(true);
      setRestoreError("");
      const from = isProtectedAppPath(location.pathname)
        ? `${location.pathname}${location.search}`
        : null;

      resetCollectionUiState();
      setUser(null);

      navigate(APP_PATHS.login, {
        replace: true,
        state: from ? { from } : null,
      });
    }

    window.addEventListener("boardgamepicker-auth-expired", handleAuthExpired);

    return () => {
      window.removeEventListener(
        "boardgamepicker-auth-expired",
        handleAuthExpired,
      );
    };
  }, [location.pathname, location.search, navigate, resetCollectionUiState]);

  const navigationState = location.state as NavigationState | null;

  const intendedRoute = safeReturnPath(navigationState?.from);

  function handleAuthenticated(nextUser: AuthUser) {
    setSessionExpired(false);
    resetCollectionUiState();
    setUser(nextUser);

    if (!nextUser.onboarding_completed) {
      navigate(APP_PATHS.onboarding, {
        replace: true,
        state: intendedRoute ? { from: intendedRoute } : null,
      });
      return;
    }

    navigate(intendedRoute ?? APP_PATHS.picker, { replace: true });
  }

  function handleLogout() {
    setSessionExpired(false);
    clearToken();
    resetCollectionUiState();
    setUser(null);
    navigate(APP_PATHS.login, { replace: true });
  }

  function navigateToView(nextView: AppView) {
    if (nextView === "collection") {
      navigate(APP_PATHS.collection);
      return;
    }

    navigate(APP_PATHS[nextView]);
  }

  function openOwnedCollectionGame(bggId: number) {
    setCollectionUiState((current) => ({
      ...current,
      section: "owned",
    }));
    navigate(collectionGamePath(bggId));
  }

  if (location.pathname === APP_PATHS.forgotPassword) {
    return pageShell(<ForgotPasswordView />);
  }

  if (location.pathname === APP_PATHS.resetPassword) {
    return pageShell(<ResetPasswordView />);
  }

  if (location.pathname === APP_PATHS.verifyEmail) {
    return pageShell(<VerifyEmailView />);
  }

  if (checkingAuth) {
    return pageShell(
      <section className="auth-loading">
        <BrandLogo />

        <h1>Loading...</h1>
      </section>,
    );
  }

  if (restoreError) {
    return pageShell(<section className="auth-loading">
      <BrandLogo /><h1>Let’s reconnect</h1>
      <p>Your saved session is still available.</p>
      <RetryNotice message={restoreError} onRetry={() => {
        setCheckingAuth(true); setRestoreError(""); setRestoreAttempt(current => current + 1);
      }} />
      <button className="ghost-button" onClick={() => { setRestoreError(""); handleLogout(); }}>Log in instead</button>
    </section>);
  }
  if (!user) {
    if (location.pathname !== APP_PATHS.login) {
      const from = isProtectedAppPath(location.pathname)
        ? `${location.pathname}${location.search}`
        : null;

      return (
        <Navigate to={APP_PATHS.login} replace state={from ? { from } : null} />
      );
    }

    return pageShell(<AuthView onAuthenticated={handleAuthenticated} sessionExpired={sessionExpired} />);
  }

  if (!user.onboarding_completed) {
    if (location.pathname !== APP_PATHS.onboarding) {
      const from = isProtectedAppPath(location.pathname)
        ? `${location.pathname}${location.search}`
        : intendedRoute;

      return (
        <Navigate
          to={APP_PATHS.onboarding}
          replace
          state={from ? { from } : null}
        />
      );
    }

    return pageShell(
      <OnboardingView
        displayName={user.display_name}
        onComplete={(updatedUser) => {
          setUser(updatedUser);
          navigate(intendedRoute ?? APP_PATHS.picker, { replace: true });
        }}
      />,
    );
  }

  if (
    location.pathname === APP_PATHS.login ||
    location.pathname === APP_PATHS.onboarding
  ) {
    return <Navigate to={intendedRoute ?? APP_PATHS.picker} replace />;
  }

  const view = appViewForPath(location.pathname);

  return (
    <main className="app-shell">
      <section className={`phone app-phone${["collection", "discover", "rankings", "insights"].includes(view) || location.pathname === APP_PATHS.settingsPro ? " app-phone-wide" : ""}`} ref={appScrollRef}>
        <AppHeader
          user={user}
          onOpenSettings={() => {
            navigate(APP_PATHS.settings);
          }}
        />

        <div className="app-content">
          <Routes>
            <Route
              path={`${APP_PATHS.picker}/*`}
              element={<PickerView onViewGame={openOwnedCollectionGame}
                onViewCollection={() => navigate(APP_PATHS.collectionOwned)}
                defaultPlayers={user.preferred_player_count}
                defaultTime={user.preferred_play_time} />}
            />

            <Route
              path={`${APP_PATHS.collection}/*`}
              element={
                <CollectionRoute
                  uiState={collectionUiState}
                  onUiStateChange={setCollectionUiState}
                  scrollContainerRef={appScrollRef}
                  scrollPositionsRef={collectionScrollPositions}
                />
              }
            />

            <Route
              path={APP_PATHS.gameNight}
              element={
                <GameNightView
                  defaultTime={user.preferred_play_time}
                  enabled={user.entitlements.includes("game_night_basic")}
                  onBack={() => navigate(APP_PATHS.picker)}
                  onViewGame={openOwnedCollectionGame}
                  onUnlockPro={() => navigate(APP_PATHS.settingsPro)}
                />
              }
            />

            <Route
              path={APP_PATHS.rankings}
              element={
                <Navigate
                  to={APP_PATHS.collectionRanking}
                  replace
                />
              }
            />

            <Route
              path={APP_PATHS.discover}
              element={
                <DiscoverView
                  personalized={user.entitlements.includes("personalized_discover")}
                  onViewWishlist={() => {
                    navigate(APP_PATHS.collectionWishlist);
                  }}
                  onUnlockPro={() => navigate(APP_PATHS.settingsPro)}
                  onPersonalize={() => navigate(APP_PATHS.settingsProfile)}
                />
              }
            />

            <Route
              path={APP_PATHS.insights}
              element={
                <InsightsView
                  onOpenGame={openOwnedCollectionGame}
                  onOpenCollection={() => navigate(APP_PATHS.collectionOwned)}
                  onOpenPicker={() => navigate(APP_PATHS.picker)}
                />
              }
            />

            <Route
              path={APP_PATHS.settings}
              element={<SettingsView user={user} onLogout={handleLogout} />}
            />

            <Route
              path={APP_PATHS.settingsProfile}
              element={<>
                <Link className="settings-back-link" to={APP_PATHS.settings}>Back to Settings</Link>
                <ProfileSettings user={user} onChange={setUser} />
              </>}
            />

            <Route
              path={APP_PATHS.settingsPro}
              element={<ProComparisonView user={user} />}
            />

            <Route
              path={APP_PATHS.setup}
              element={
                <>
                  <SetupView
                    initialUsername={user.bgg_username}
                    onUsernameChange={(username) => {
                      setUser({
                        ...user,
                        bgg_username: username,
                      });
                    }}
                  />

                  <div className="account-panel">
                    <div>
                      <p className="account-label">Signed in as</p>

                      <strong>{user.display_name ?? user.email}</strong>

                      <span>{user.email}</span>
                    </div>

                    <button
                      type="button"
                      className="logout-button"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </div>
                </>
              }
            />

            <Route
              path="/"
              element={<Navigate to={APP_PATHS.picker} replace />}
            />

            <Route
              path="*"
              element={<Navigate to={APP_PATHS.picker} replace />}
            />
          </Routes>
        </div>

        <AppNavigation view={view} onChangeView={navigateToView} />
      </section>
    </main>
  );
}

export default App;
