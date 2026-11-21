//! Half-open byte ranges and a set that merges them.

/// A half-open byte range `[start, end)`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Range {
    pub start: u64,
    pub end: u64,
}

impl Range {
    /// Bytes in the range; 0 for an inverted one (`end < start`), never an overflow.
    pub fn len(self) -> u64 {
        self.end.saturating_sub(self.start)
    }

    pub fn is_empty(self) -> bool {
        self.end <= self.start
    }
}

/// Ranges kept sorted, non-overlapping and merged (touching ranges join).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RangeSet {
    ranges: Vec<Range>,
}

impl RangeSet {
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds `r`, merging it with every range it overlaps or touches. Empty ranges are ignored.
    pub fn insert(&mut self, r: Range) {
        if r.end <= r.start {
            return;
        }
        let i = self.ranges.partition_point(|w| w.end < r.start);
        let mut merged = r;
        let mut j = i;
        while j < self.ranges.len() && self.ranges[j].start <= merged.end {
            merged.start = merged.start.min(self.ranges[j].start);
            merged.end = merged.end.max(self.ranges[j].end);
            j += 1;
        }
        self.ranges.splice(i..j, [merged]);
    }

    /// The ranges, sorted and merged.
    pub fn as_slice(&self) -> &[Range] {
        &self.ranges
    }

    /// Total bytes covered.
    pub fn covered(&self) -> u64 {
        self.ranges.iter().map(|r| r.len()).sum()
    }

    /// The parts of `[0, size)` not covered.
    pub fn gaps(&self, size: u64) -> Vec<Range> {
        gaps(&self.ranges, size)
    }
}

impl FromIterator<Range> for RangeSet {
    fn from_iter<I: IntoIterator<Item = Range>>(iter: I) -> Self {
        let mut set = Self::new();
        for r in iter {
            set.insert(r);
        }
        set
    }
}

/// The parts of `[0, size)` not covered by `done` (which must be sorted and
/// non-overlapping, as a [`RangeSet`] keeps it). Every gap lies inside `[0, size)`, even
/// when ranges in `done` start or end beyond `size`.
pub fn gaps(done: &[Range], size: u64) -> Vec<Range> {
    let mut out = Vec::new();
    let mut at = 0;
    for d in done {
        if at >= size {
            break;
        }
        if d.start > at {
            out.push(Range { start: at, end: d.start.min(size) });
        }
        at = at.max(d.end);
    }
    if at < size {
        out.push(Range { start: at, end: size });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn written_set_merges() {
        let mut t = RangeSet::new();
        t.insert(Range { start: 10, end: 20 });
        t.insert(Range { start: 30, end: 40 });
        t.insert(Range { start: 0, end: 5 });
        assert_eq!(t.as_slice().len(), 3);
        t.insert(Range { start: 20, end: 30 });
        assert_eq!(t.as_slice(), &[Range { start: 0, end: 5 }, Range { start: 10, end: 40 }]);
        t.insert(Range { start: 3, end: 12 });
        assert_eq!(t.as_slice(), &[Range { start: 0, end: 40 }]);
        t.insert(Range { start: 50, end: 50 });
        assert_eq!(t.covered(), 40, "empty ranges are ignored");
    }

    #[test]
    fn length_never_underflows() {
        assert_eq!(Range { start: 5, end: 10 }.len(), 5);
        assert_eq!(Range { start: 10, end: 5 }.len(), 0);
        assert!(Range { start: 10, end: 5 }.is_empty());
        assert_eq!(Range { start: u64::MAX, end: 0 }.len(), 0);
    }

    #[test]
    fn gaps_are_the_complement() {
        let done = [Range { start: 0, end: 5 }, Range { start: 10, end: 20 }];
        assert_eq!(gaps(&done, 25), vec![Range { start: 5, end: 10 }, Range { start: 20, end: 25 }]);
        assert_eq!(gaps(&[], 7), vec![Range { start: 0, end: 7 }]);
        assert_eq!(gaps(&[Range { start: 0, end: 7 }], 7), vec![]);
        let set: RangeSet = done.into_iter().collect();
        assert_eq!(set.gaps(25), gaps(&done, 25));
    }

    #[test]
    fn gaps_stay_inside_the_size() {
        let r = |start, end| Range { start, end };
        assert_eq!(gaps(&[r(30, 40)], 25), vec![r(0, 25)]);
        assert_eq!(gaps(&[r(10, 40)], 25), vec![r(0, 10)]);
        assert_eq!(gaps(&[r(0, 40)], 25), vec![]);
        assert_eq!(gaps(&[], 0), vec![]);
        assert_eq!(gaps(&[r(5, 10)], 0), vec![]);
        assert_eq!(gaps(&[r(5, 10), r(30, 40)], 25), vec![r(0, 5), r(10, 25)]);
        let set: RangeSet = [r(10, 40)].into_iter().collect();
        assert_eq!(set.gaps(25), vec![r(0, 10)]);
    }
}
