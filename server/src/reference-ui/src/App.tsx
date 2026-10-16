import { useMemo, useState } from "react";

type IconName =
  | "bookmark"
  | "check"
  | "chevron"
  | "close"
  | "info"
  | "play"
  | "search";

const image = (url: string, width = 900) =>
  `${url.split("?")[0]}?auto=format&fit=crop&w=${width}&q=85`;

const films = [
  {
    title: "Neon District",
    meta: "2025 · 1h 56m",
    genre: "Thriller",
    match: "96% match",
    image: image("https://images.unsplash.com/photo-1599060052009-24d6d0b0161c"),
  },
  {
    title: "Red Horizon",
    meta: "2024 · 2h 14m",
    genre: "Sci-fi",
    match: "93% match",
    image: image("https://images.unsplash.com/photo-1568801556940-e5b3a55fa6ea"),
  },
  {
    title: "Dark Water",
    meta: "2025 · 1h 48m",
    genre: "Drama",
    match: "91% match",
    image: image("https://images.unsplash.com/photo-1553336972-e104649d0554"),
  },
  {
    title: "Last Stop",
    meta: "2023 · 1h 42m",
    genre: "Crime",
    match: "89% match",
    image: image("https://images.unsplash.com/photo-1671408932328-c481eb33c527"),
  },
  {
    title: "Silent Valley",
    meta: "2024 · 2h 02m",
    genre: "Drama",
    match: "87% match",
    image: image("https://images.unsplash.com/photo-1552117978-5818fbb674bc"),
  },
  {
    title: "Afterlight",
    meta: "2025 · 1h 51m",
    genre: "Sci-fi",
    match: "85% match",
    image: image("https://images.unsplash.com/photo-1672872476232-da16b45c9001"),
  },
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21V4.8Z" />,
    check: <path d="m5 12 4.2 4L19 6.5" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    play: <path d="m9 6 9 6-9 6V6Z" />,
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.2 4.2" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

function Logo() {
  return (
    <div className="logo" aria-label="Frame streaming">
      <span className="logo-mark">
        <span />
        <span />
      </span>
      <span className="logo-word">FRAME</span>
    </div>
  );
}

export default function App() {
  const [activeGenre, setActiveGenre] = useState("All");
  const [watchlist, setWatchlist] = useState<string[]>(["Red Horizon"]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const genres = ["All", "Thriller", "Sci-fi", "Drama", "Crime"];

  const visibleFilms = useMemo(() => {
    return films.filter((film) => {
      const genreMatch = activeGenre === "All" || film.genre === activeGenre;
      const searchMatch = film.title.toLowerCase().includes(query.toLowerCase());
      return genreMatch && searchMatch;
    });
  }, [activeGenre, query]);

  const toggleWatchlist = (title: string) => {
    setWatchlist((current) =>
      current.includes(title) ? current.filter((item) => item !== title) : [...current, title],
    );
  };

  return (
    <main>
      <header className="topbar">
        <Logo />
        <nav aria-label="Primary navigation">
          <button className="nav-item active">Home</button>
          <button className="nav-item">Movies</button>
          <button className="nav-item">Series</button>
          <button className="nav-item">My list</button>
        </nav>
        <div className="header-actions">
          <div className={`search ${searchOpen ? "open" : ""}`}>
            {searchOpen && (
              <input
                aria-label="Search titles"
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles"
                value={query}
              />
            )}
            <button
              aria-label={searchOpen ? "Close search" : "Search"}
              className="icon-button"
              onClick={() => {
                setSearchOpen((current) => !current);
                if (searchOpen) setQuery("");
              }}
            >
              <Icon name={searchOpen ? "close" : "search"} />
            </button>
          </div>
          <button className="profile" aria-label="Open profile">
            MA
          </button>
        </div>
      </header>

      <section className="hero" aria-labelledby="featured-title">
        <img
          alt="A lone traveler overlooking a vast sandstone desert"
          className="hero-image"
          src={image("https://images.unsplash.com/photo-1682685797229-b2930538da47", 1800)}
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="eyebrow">
            <span />
            Frame original
          </div>
          <h1 id="featured-title">DUST</h1>
          <p className="hero-subtitle">Beyond the edge of everything.</p>
          <div className="hero-meta">
            <strong>98% match</strong>
            <span>2025</span>
            <span className="rating">16+</span>
            <span>2h 08m</span>
            <span>4K</span>
          </div>
          <p className="hero-copy">
            A lone cartographer crosses an uncharted planet to find the signal that could bring
            humanity home.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => setPlaying(true)}>
              <Icon name="play" size={18} />
              Play now
            </button>
            <button className="button secondary">
              <Icon name="info" size={18} />
              Details
            </button>
          </div>
        </div>
        <div className="hero-index">
          <span>01</span>
          <div><i /><i /><i /></div>
          <span>03</span>
        </div>
      </section>

      <section className="catalog" aria-labelledby="trending-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Curated for you</p>
            <h2 id="trending-title">{query ? `Results for “${query}”` : "Trending now"}</h2>
          </div>
          <div className="genre-list" aria-label="Filter by genre">
            {genres.map((genre) => (
              <button
                className={activeGenre === genre ? "genre active" : "genre"}
                key={genre}
                onClick={() => setActiveGenre(genre)}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        <div className="film-grid">
          {visibleFilms.map((film, index) => {
            const saved = watchlist.includes(film.title);
            return (
              <article className="film-card" key={film.title}>
                <div className="film-art">
                  <img alt="" src={film.image} />
                  <div className="film-overlay">
                    <button
                      aria-label={`Play ${film.title}`}
                      className="card-play"
                      onClick={() => setPlaying(true)}
                    >
                      <Icon name="play" size={18} />
                    </button>
                    <button
                      aria-label={`${saved ? "Remove from" : "Add to"} watchlist`}
                      className={`save-button ${saved ? "saved" : ""}`}
                      onClick={() => toggleWatchlist(film.title)}
                    >
                      <Icon name={saved ? "check" : "bookmark"} size={18} />
                    </button>
                  </div>
                  <span className="film-number">0{index + 1}</span>
                </div>
                <div className="film-info">
                  <div>
                    <h3>{film.title}</h3>
                    <p>{film.meta} · {film.genre}</p>
                  </div>
                  <span>{film.match}</span>
                </div>
              </article>
            );
          })}
          {visibleFilms.length === 0 && (
            <div className="empty-state">
              <p>No titles found. Try a different search or genre.</p>
            </div>
          )}
        </div>
        <button className="browse-all">
          Browse all films
          <Icon name="chevron" size={18} />
        </button>
      </section>

      <footer>
        <Logo />
        <p>Stories worth staying for.</p>
        <p className="photo-credit">Photography via Unsplash</p>
      </footer>

      {playing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Video preview">
          <div className="player">
            <img
              alt="Desert landscape preview"
              src={image("https://images.unsplash.com/photo-1547235001-d703406d3f17", 1400)}
            />
            <div className="player-shade" />
            <button aria-label="Close preview" className="player-close" onClick={() => setPlaying(false)}>
              <Icon name="close" />
            </button>
            <div className="player-message">
              <span className="pulse"><Icon name="play" /></span>
              <p>Preview playing</p>
              <small>DUST · Official trailer</small>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
