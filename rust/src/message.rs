//! Message codes with parameters, so Rust never builds display sentences: the interface
//! looks the code up in its language files and fills in the parameters
//! (specs/translation-format.md, "Messages from Rust").

use std::fmt;

/// A message for the interface: a code (a language-file key) and named parameters.
#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Message {
    code: String,
    params: Vec<(String, String)>,
}

/// True for a valid key: dot-separated parts, each a lower-case letter followed by
/// letters, digits or `_` ("error.diskFull").
pub fn is_valid_code(code: &str) -> bool {
    !code.is_empty()
        && code.split('.').all(|part| {
            let mut c = part.chars();
            c.next().is_some_and(|f| f.is_ascii_lowercase()) && c.all(|x| x.is_ascii_alphanumeric() || x == '_')
        })
}

/// True for a valid parameter name: an ASCII letter, then letters or digits.
pub fn is_valid_param(name: &str) -> bool {
    let mut c = name.chars();
    c.next().is_some_and(|f| f.is_ascii_alphabetic()) && c.all(|x| x.is_ascii_alphanumeric())
}

impl Message {
    /// A message with no parameters.
    ///
    /// # Panics
    /// In debug builds, if `code` is not a valid key ([`is_valid_code`]): codes are
    /// written in the program, so a bad one is a programming mistake.
    pub fn new(code: impl Into<String>) -> Self {
        let code = code.into();
        debug_assert!(is_valid_code(&code), "not a valid message code: {code:?}");
        Self { code, params: Vec::new() }
    }

    /// Adds (or replaces) parameter `name`.
    ///
    /// # Panics
    /// In debug builds, if `name` is not a valid parameter name ([`is_valid_param`]).
    #[must_use]
    pub fn with(mut self, name: impl Into<String>, value: impl ToString) -> Self {
        let name = name.into();
        debug_assert!(is_valid_param(&name), "not a valid parameter name: {name:?}");
        let value = value.to_string();
        match self.params.iter_mut().find(|(n, _)| *n == name) {
            Some(p) => p.1 = value,
            None => self.params.push((name, value)),
        }
        self
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    /// The parameters, in the order they were added.
    pub fn params(&self) -> &[(String, String)] {
        &self.params
    }

    pub fn param(&self, name: &str) -> Option<&str> {
        self.params.iter().find(|(n, _)| n == name).map(|(_, v)| v.as_str())
    }
}

/// For logs only, never for display: `code {name=value, …}`.
impl fmt::Display for Message {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.code)?;
        if !self.params.is_empty() {
            f.write_str(" {")?;
            for (i, (n, v)) in self.params.iter().enumerate() {
                if i > 0 {
                    f.write_str(", ")?;
                }
                write!(f, "{n}={v:?}")?;
            }
            f.write_str("}")?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_and_parameters() {
        let m = Message::new("error.http").with("status", 404).with("host", "a.example").with("status", 410);
        assert_eq!(m.code(), "error.http");
        assert_eq!(m.params(), &[("status".into(), "410".into()), ("host".into(), "a.example".into())]);
        assert_eq!(m.param("host"), Some("a.example"));
        assert_eq!(m.param("nope"), None);
        assert_eq!(m.to_string(), r#"error.http {status="410", host="a.example"}"#);
        assert_eq!(Message::new("common.ok").to_string(), "common.ok");
    }

    #[test]
    fn code_and_parameter_rules() {
        for ok in ["a", "error.diskFull", "video.update_failed", "a.b2.c"] {
            assert!(is_valid_code(ok), "{ok}");
        }
        for bad in ["", "A", "a.", ".a", "a..b", "a.B", "a-b", "a b", "1a", "fehler.ä"] {
            assert!(!is_valid_code(bad), "{bad}");
        }
        assert!(is_valid_param("count") && is_valid_param("x2"));
        assert!(!is_valid_param("") && !is_valid_param("2x") && !is_valid_param("a_b") && !is_valid_param("a.b"));
    }

    #[test]
    #[cfg(debug_assertions)]
    #[should_panic(expected = "not a valid message code")]
    fn a_bad_code_is_a_mistake() {
        let _ = Message::new("Not valid");
    }
}
