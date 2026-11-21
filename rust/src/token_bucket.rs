//! A token bucket for rate limits: the arithmetic only. The caller supplies the time and
//! does the waiting (with a thread sleep, an async timer, or anything else).

use std::time::{Duration, Instant};

/// Allows `rate` units per second, with bursts of at most `burst` worth of units. Taking
/// more than is there is allowed: the debt is paid by waiting, so one large take does not
/// stall forever and the average stays at `rate`.
#[derive(Clone, Debug)]
pub struct TokenBucket {
    rate: f64,
    capacity: f64,
    /// May go negative (debt).
    tokens: f64,
    last: Option<Instant>,
}

impl TokenBucket {
    /// A bucket for `rate` units per second that holds at most `burst` worth of them. It
    /// starts empty, so the first take already waits.
    ///
    /// # Panics
    /// If `rate` is zero.
    pub fn new(rate: u64, burst: Duration) -> Self {
        assert!(rate > 0, "a token bucket needs a rate above zero");
        let rate = rate as f64;
        Self { rate, capacity: rate * burst.as_secs_f64(), tokens: 0.0, last: None }
    }

    pub fn rate(&self) -> u64 {
        self.rate as u64
    }

    /// Takes `n` units at `now`; returns how long to wait before going on (zero when the
    /// bucket held enough). Times before the last take count as no time passed.
    pub fn take(&mut self, n: u64, now: Instant) -> Duration {
        let elapsed = self.last.map_or(0.0, |l| now.saturating_duration_since(l).as_secs_f64());
        self.last = Some(now);
        self.tokens = (self.tokens + elapsed * self.rate).min(self.capacity) - n as f64;
        if self.tokens >= 0.0 { Duration::ZERO } else { Duration::from_secs_f64(-self.tokens / self.rate) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pays_debt_by_waiting_and_caps_bursts() {
        let t0 = Instant::now();
        let mut b = TokenBucket::new(1000, Duration::from_millis(250));
        assert_eq!(b.rate(), 1000);
        // Starts empty: 500 units at 1000/s is half a second.
        assert_eq!(b.take(500, t0), Duration::from_millis(500));
        // After paying it, a second's rest refills only the burst (250).
        let t1 = t0 + Duration::from_millis(500);
        assert_eq!(b.take(0, t1), Duration::ZERO);
        let t2 = t1 + Duration::from_secs(1);
        assert_eq!(b.take(250, t2), Duration::ZERO);
        assert_eq!(b.take(100, t2), Duration::from_millis(100));
        // A clock that goes back counts as no time passed.
        assert_eq!(b.take(0, t0), Duration::from_millis(100));
    }

    #[test]
    fn the_average_stays_at_the_rate() {
        let t0 = Instant::now();
        let mut b = TokenBucket::new(4096, Duration::from_millis(250));
        let mut now = t0;
        for _ in 0..100 {
            now += b.take(1024, now);
        }
        // 100 KiB at 4 KiB/s is 25 s.
        let secs = now.duration_since(t0).as_secs_f64();
        assert!((secs - 25.0).abs() < 1e-6, "{secs}");
    }

    #[test]
    #[should_panic(expected = "rate above zero")]
    fn zero_rate_is_refused() {
        let _ = TokenBucket::new(0, Duration::from_secs(1));
    }
}
