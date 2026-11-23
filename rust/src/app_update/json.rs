//! A small JSON reader (RFC 8259), enough to read a GitHub release. Private: the crate has
//! no dependencies, so it cannot use serde. Numbers are kept as text; nesting is limited.

#[derive(Debug, PartialEq)]
pub(super) enum Json {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<Json>),
    Object(Vec<(String, Json)>),
}

const MAX_DEPTH: usize = 64;

impl Json {
    pub(super) fn parse(text: &str) -> Option<Json> {
        let mut p = Parser { s: text.as_bytes(), i: 0 };
        let v = p.value(0)?;
        p.ws();
        (p.i == p.s.len()).then_some(v)
    }

    pub(super) fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Object(m) => m.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    pub(super) fn as_str(&self) -> Option<&str> {
        match self {
            Json::String(s) => Some(s),
            _ => None,
        }
    }

    pub(super) fn as_u64(&self) -> Option<u64> {
        match self {
            Json::Number(n) => n.parse().ok(),
            _ => None,
        }
    }

    pub(super) fn as_array(&self) -> Option<&[Json]> {
        match self {
            Json::Array(a) => Some(a),
            _ => None,
        }
    }
}

struct Parser<'a> {
    s: &'a [u8],
    i: usize,
}

impl Parser<'_> {
    fn ws(&mut self) {
        while matches!(self.s.get(self.i), Some(b' ' | b'\t' | b'\n' | b'\r')) {
            self.i += 1;
        }
    }

    fn eat(&mut self, lit: &str) -> bool {
        if self.s[self.i..].starts_with(lit.as_bytes()) {
            self.i += lit.len();
            true
        } else {
            false
        }
    }

    fn value(&mut self, depth: usize) -> Option<Json> {
        if depth > MAX_DEPTH {
            return None;
        }
        self.ws();
        match *self.s.get(self.i)? {
            b'{' => {
                self.i += 1;
                let mut members = Vec::new();
                self.ws();
                if self.eat("}") {
                    return Some(Json::Object(members));
                }
                loop {
                    self.ws();
                    let key = self.string()?;
                    self.ws();
                    if !self.eat(":") {
                        return None;
                    }
                    members.push((key, self.value(depth + 1)?));
                    self.ws();
                    if self.eat("}") {
                        return Some(Json::Object(members));
                    }
                    if !self.eat(",") {
                        return None;
                    }
                }
            }
            b'[' => {
                self.i += 1;
                let mut items = Vec::new();
                self.ws();
                if self.eat("]") {
                    return Some(Json::Array(items));
                }
                loop {
                    items.push(self.value(depth + 1)?);
                    self.ws();
                    if self.eat("]") {
                        return Some(Json::Array(items));
                    }
                    if !self.eat(",") {
                        return None;
                    }
                }
            }
            b'"' => self.string().map(Json::String),
            b't' => self.eat("true").then_some(Json::Bool(true)),
            b'f' => self.eat("false").then_some(Json::Bool(false)),
            b'n' => self.eat("null").then_some(Json::Null),
            _ => self.number(),
        }
    }

    fn number(&mut self) -> Option<Json> {
        let start = self.i;
        self.eat("-");
        let digits = |p: &mut Self| {
            let s = p.i;
            while matches!(p.s.get(p.i), Some(b'0'..=b'9')) {
                p.i += 1;
            }
            p.i > s
        };
        if !digits(self) {
            return None;
        }
        if self.eat(".") && !digits(self) {
            return None;
        }
        if matches!(self.s.get(self.i), Some(b'e' | b'E')) {
            self.i += 1;
            if !self.eat("+") {
                self.eat("-");
            }
            if !digits(self) {
                return None;
            }
        }
        Some(Json::Number(std::str::from_utf8(&self.s[start..self.i]).ok()?.to_owned()))
    }

    fn hex4(&mut self) -> Option<u32> {
        let h = self.s.get(self.i..self.i + 4)?;
        self.i += 4;
        u32::from_str_radix(std::str::from_utf8(h).ok()?, 16).ok()
    }

    fn string(&mut self) -> Option<String> {
        if !self.eat("\"") {
            return None;
        }
        let mut out = Vec::new();
        loop {
            let b = *self.s.get(self.i)?;
            self.i += 1;
            match b {
                b'"' => return String::from_utf8(out).ok(),
                b'\\' => {
                    let e = *self.s.get(self.i)?;
                    self.i += 1;
                    let c = match e {
                        b'"' => '"',
                        b'\\' => '\\',
                        b'/' => '/',
                        b'b' => '\u{8}',
                        b'f' => '\u{c}',
                        b'n' => '\n',
                        b'r' => '\r',
                        b't' => '\t',
                        b'u' => {
                            let hi = self.hex4()?;
                            if (0xD800..0xDC00).contains(&hi) {
                                if !self.eat("\\u") {
                                    return None;
                                }
                                let lo = self.hex4()?;
                                if !(0xDC00..0xE000).contains(&lo) {
                                    return None;
                                }
                                char::from_u32(0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00))?
                            } else {
                                char::from_u32(hi)?
                            }
                        }
                        _ => return None,
                    };
                    let mut buf = [0u8; 4];
                    out.extend_from_slice(c.encode_utf8(&mut buf).as_bytes());
                }
                0..=0x1f => return None,
                _ => out.push(b),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_values() {
        let v = Json::parse(r#" {"a":[1,-2.5e3,true,false,null],"b":"x\"\u00e9\ud83d\ude00\n","c":{}} "#).unwrap();
        assert_eq!(v.get("a").unwrap().as_array().unwrap().len(), 5);
        assert_eq!(v.get("a").unwrap().as_array().unwrap()[0].as_u64(), Some(1));
        assert_eq!(v.get("b").unwrap().as_str(), Some("x\"é😀\n"));
        assert_eq!(v.get("c"), Some(&Json::Object(vec![])));
    }

    #[test]
    fn rejects_bad_input() {
        for bad in ["", "{", "[1,]", "{\"a\" 1}", "\"\\ud800\"", "01x", "\"a\nb\"", "1 2", "tru"] {
            assert!(Json::parse(bad).is_none(), "{bad:?}");
        }
        let deep = "[".repeat(100) + &"]".repeat(100);
        assert!(Json::parse(&deep).is_none(), "too deep");
    }
}
