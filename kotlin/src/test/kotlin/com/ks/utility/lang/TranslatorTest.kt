package com.ks.utility.lang

import java.io.File
import java.math.BigInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TranslatorTest {
    private fun layer(en: String, hi: String) = mapOf("en" to Catalog.parse(en), "hi" to Catalog.parse(hi))

    private val shared = layer(
        """{"common.ok":"OK","common.items":{"one":"{count} item","other":"{count} items"},"x.only":"English only"}""",
        """{"common.ok":"ठीक","common.items":{"one":"{count} आइटम","other":"{count} आइटम"}}""",
    )
    private val app = layer(
        """{"common.ok":"Fine","app.of":"{done} of {total}","app.files":{"one":"One file","other":"{count} files"}}""",
        """{"app.of":"{total} में से {done}","app.files":{"one":"{count} फ़ाइल","other":"{count} फ़ाइलें"}}""",
    )

    @Test
    fun layersAreSearchedLastToFirstWithEnglishFallback() {
        val en = Translator("en", shared, app)
        val hi = Translator("hi", shared, app)
        assertEquals("Fine", en.t("common.ok"), "the app's layer wins")
        assertEquals("ठीक", hi.t("common.ok"), "Hindi in a lower layer comes before English in a higher one")
        assertEquals("English only", hi.t("x.only"))
        assertEquals("no.such.key", hi.t("no.such.key"))
        assertTrue(hi.has("x.only"))
        assertFalse(hi.has("no.such.key"))
    }

    @Test
    fun placeholders() {
        val hi = Translator("hi", shared, app)
        assertEquals("1,00,000 में से 12,345", hi("app.of", "done" to 12345, "total" to 100000))
        assertEquals("{total} में से 3", hi("app.of", "done" to 3), "a placeholder without a value stays")
        assertEquals("2024 of v1.2", Translator("en", app)("app.of", "done" to "2024", "total" to "v1.2"), "strings as they are")
    }

    @Test
    fun plurals() {
        val en = Translator("en", shared, app)
        val hi = Translator("hi", shared, app)
        assertEquals("One file", en("app.files", "count" to 1))
        assertEquals("0 files", en("app.files", "count" to 0))
        assertEquals("1,200 files", en("app.files", "count" to 1200))
        assertEquals("0 फ़ाइल", hi("app.files", "count" to 0), "Hindi one covers 0")
        assertEquals("1 फ़ाइल", hi("app.files", "count" to 1))
        assertEquals("2 फ़ाइलें", hi("app.files", "count" to 2))
        assertEquals("One file", en("app.files", "count" to "1"), "a count given as text")
        assertEquals("{count} files", en.t("app.files"), "no count: other")
    }

    @Test
    fun pluralRulesMatchCldr() {
        // Expected values from Intl.PluralRules (Node 23).
        val cases = listOf(0, 1, 2, 0.5, 1.5, -1, 1.0)
        assertEquals(listOf("other", "one", "other", "other", "other", "one", "one"), cases.map { Translator.pluralCategory("en", it) })
        assertEquals(listOf("one", "one", "other", "one", "other", "one", "one"), cases.map { Translator.pluralCategory("hi", it) })
        assertEquals("one", Translator.pluralCategory("hi-IN", 0))
        assertEquals("other", Translator.pluralCategory("hi", Double.NaN))
    }

    @Test
    fun numbersMatchIntl() {
        // Expected values from Intl.NumberFormat(lang, { numberingSystem: "latn" }) (Node 23).
        val cases = listOf<Number>(0, 999, 1000, 12345, 123456, 1234567, -1234567, 1234.5678, 0.0005, -2.5, 1e21, BigInteger("9007199254740993"))
        assertEquals(
            listOf("0", "999", "1,000", "12,345", "123,456", "1,234,567", "-1,234,567", "1,234.568", "0.001", "-2.5",
                "1,000,000,000,000,000,000,000", "9,007,199,254,740,993"),
            cases.map { Translator.formatNumber("en", it) },
        )
        assertEquals(
            listOf("0", "999", "1,000", "12,345", "1,23,456", "12,34,567", "-12,34,567", "1,234.568", "0.001", "-2.5",
                "1,00,00,00,00,00,00,00,00,00,000", "9,00,71,99,25,47,40,993"),
            cases.map { Translator.formatNumber("hi", it) },
        )
        assertEquals("-9,223,372,036,854,775,808", Translator.formatNumber("en", Long.MIN_VALUE))
        assertEquals("NaN", Translator.formatNumber("en", Double.NaN))
    }

    @Test
    fun theSharedCatalogueParses() {
        // Gradle runs tests in kotlin/; the shared catalogue is in lang/common of this repository.
        val dir = File("../lang/common")
        val en = Catalog.parse(File(dir, "en.json").readText())
        val hi = Catalog.parse(File(dir, "hi.json").readText())
        assertEquals(en.entries.keys, hi.entries.keys)
        val tr = Translator("hi", mapOf("en" to en, "hi" to hi))
        assertEquals("ठीक है", tr.t("common.ok"))
        assertEquals("12,34,567", tr("common.items", "count" to 1234567).substringBefore(' '))
        assertEquals("You're offline. Check your network connection.", Translator("en", mapOf("en" to en)).t("common.error.offline"))
    }

    @Test
    fun malformedFilesFail() {
        assertFailsWith<IllegalArgumentException> { Catalog.parse("[]") }
        assertFailsWith<IllegalArgumentException> { Catalog.parse("""{"a":1}""") }
        assertFailsWith<IllegalArgumentException> { Catalog.parse("""{"a":{"one":"x"}}""") }
        assertFailsWith<IllegalArgumentException> { Catalog.parse("""{"a":{"other":2}}""") }
    }
}
