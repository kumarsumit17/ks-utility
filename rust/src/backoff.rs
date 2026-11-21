//! Exponential backoff with full jitter, and the random source it uses.

use std::hash::{BuildHasher, Hasher, RandomState};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The wait before attempt `failures + 1`, with full jitter: a random time between zero
/// and the backoff ceiling (`base` doubled for each failure after the first, at most
/// `max`), so many clients that failed together do not retry together. `failures` 0 is
/// treated like 1.
pub fn full_jitter(failures: u32, base: Duration, max: Duration) -> Duration {
    let doubling = 2u32.saturating_pow(failures.saturating_sub(1));
    let ceiling = base.saturating_mul(doubling).min(max);
    let ceiling_ms = u64::try_from(ceiling.as_millis()).unwrap_or(u64::MAX);
    Duration::from_millis(jitter_random_below(ceiling_ms.saturating_add(1)))
}

/// A random number below `bound` (0 when `bound` is 0), **for jitter only**.
///
/// Not cryptographically secure and not uniform enough for statistics: it mixes std's
/// randomly keyed hasher with a counter and the clock. Never use it for tokens, IDs,
/// keys, passwords, nonces, sampling or anything else where an attacker or a bias
/// matters; use an operating-system random source (through a vetted crate) for those.
pub fn jitter_random_below(bound: u64) -> u64 {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    if bound == 0 {
        return 0;
    }
    let mut h = RandomState::new().build_hasher();
    h.write_u64(COUNTER.fetch_add(1, Ordering::Relaxed));
    h.write_u128(SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_nanos()));
    h.finish() % bound
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_grows_and_stays_under_the_cap() {
        let (base, max) = (Duration::from_millis(100), Duration::from_millis(1000));
        for _ in 0..200 {
            assert!(full_jitter(1, base, max) <= Duration::from_millis(100));
            assert!(full_jitter(3, base, max) <= Duration::from_millis(400));
            assert!(full_jitter(30, base, max) <= Duration::from_millis(1000));
        }
        // Jitter really varies.
        let samples: std::collections::HashSet<_> = (0..50).map(|_| full_jitter(4, base, max)).collect();
        assert!(samples.len() > 10);
    }

    #[test]
    fn random_stays_below_the_bound() {
        assert_eq!(jitter_random_below(0), 0);
        assert_eq!(jitter_random_below(1), 0);
        assert!((0..1000).all(|_| jitter_random_below(7) < 7));
    }
}
