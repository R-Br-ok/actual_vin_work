'use client';

import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { MOCK_MOVIES } from '../data/mockMovies';

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'subtitle', weight: 0.2 },
    { name: 'genre', weight: 0.15 },
    { name: 'director', weight: 0.1 },
    { name: 'description', weight: 0.05 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
};

export function useMovieSearch(initialMovies = MOCK_MOVIES) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fuse = useMemo(() => new Fuse(initialMovies, fuseOptions), [initialMovies]);

  const filteredMovies = useMemo(() => {
    let results = initialMovies;

    // Apply fuzzy search if query is non-empty
    if (query.trim() !== '') {
      results = fuse.search(query.trim()).map((res) => res.item);
    }

    // Apply category / genre filter
    if (selectedCategory !== 'All') {
      results = results.filter(
        (m) =>
          m.genre.toLowerCase() === selectedCategory.toLowerCase() ||
          m.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    return results;
  }, [query, selectedCategory, initialMovies, fuse]);

  return {
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    movies: filteredMovies,
    totalCount: filteredMovies.length,
  };
}
