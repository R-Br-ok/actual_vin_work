'use client';

import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { MOCK_MOVIES } from '../data/mockMovies';

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.45 },
    { name: 'subtitle', weight: 0.15 },
    { name: 'genres', weight: 0.15 },
    { name: 'director', weight: 0.1 },
    { name: 'category', weight: 0.05 },
    { name: 'description', weight: 0.1 },
  ],
  threshold: 0.38, // typo tolerant: "elefant", "tears of stel"
  ignoreLocation: true,
  includeScore: true,
};

/**
 * Fuzzy search (Fuse.js) + category tab + genre filter over the catalog.
 */
export function useMovieSearch(movies = MOCK_MOVIES) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState(null);

  const fuse = useMemo(() => new Fuse(movies, fuseOptions), [movies]);

  const results = useMemo(() => {
    const q = query.trim();
    let list = q ? fuse.search(q).map((r) => r.item) : movies;

    if (selectedCategory !== 'All') {
      list = list.filter((m) => m.category === selectedCategory);
    }
    if (selectedGenre) {
      list = list.filter((m) => (m.genres || [m.genre]).includes(selectedGenre));
    }
    return list;
  }, [query, selectedCategory, selectedGenre, movies, fuse]);

  const reset = () => {
    setQuery('');
    setSelectedCategory('All');
    setSelectedGenre(null);
  };

  return {
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    selectedGenre,
    setSelectedGenre,
    movies: results,
    totalCount: results.length,
    reset,
  };
}
