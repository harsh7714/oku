import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

// Generic infinite-scroll hook. `fetchPage(page)` must resolve to
// `{ posts, hasMore }`. Pass `deps` to reset and refetch from page 1
// whenever they change (e.g. switching Explore tabs or hashtag filters).
export function useInfiniteScroll(fetchPage, deps = []) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async (pageToLoad, replace) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const { posts, hasMore: more } = await fetchPage(pageToLoad);
        setItems((prev) => (replace ? posts : [...prev, ...posts]));
        setHasMore(more);
        setPage(pageToLoad);
      } catch (err) {
        console.error('Infinite scroll fetch error:', err);
        toast.error('Failed to load posts');
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [fetchPage]
  );

  useEffect(() => {
    setItems([]);
    setHasMore(true);
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadPage(page + 1, false);
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, hasMore, loadPage]);

  return { items, setItems, loading, hasMore, sentinelRef };
}
