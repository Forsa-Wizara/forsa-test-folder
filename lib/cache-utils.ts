// ============================================================================
// MEMOIZATION & CACHING UTILITIES
// For optimizing expensive function calls
// ============================================================================

/**
 * Simple LRU Cache implementation
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (will re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Memoize a function with a simple key-based cache
 */
export function memoize<Args extends any[], Result>(
  fn: (...args: Args) => Result,
  keyFn?: (...args: Args) => string
): (...args: Args) => Result {
  const cache = new Map<string, Result>();
  
  return (...args: Args): Result => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Memoize with LRU eviction
 */
export function memoizeLRU<Args extends any[], Result>(
  fn: (...args: Args) => Result,
  maxSize: number = 100,
  keyFn?: (...args: Args) => string
): (...args: Args) => Result {
  const cache = new LRUCache<string, Result>(maxSize);
  
  return (...args: Args): Result => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Create a debounced function
 */
export function debounce<Args extends any[]>(
  fn: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Args): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a throttled function
 */
export function throttle<Args extends any[]>(
  fn: (...args: Args) => void,
  limit: number
): (...args: Args) => void {
  let inThrottle = false;
  
  return (...args: Args): void => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Create a cache key from search parameters
 */
export function createSearchKey(params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const keyParts = sortedKeys.map(key => {
    const value = params[key];
    if (Array.isArray(value)) {
      return `${key}:${value.sort().join(',')}`;
    }
    return `${key}:${value}`;
  });
  return keyParts.join('|');
}
