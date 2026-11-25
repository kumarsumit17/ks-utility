package com.ks.utility.lang

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

/**
 * Plural rules and number formats per language, as `Intl.PluralRules` and
 * `Intl.NumberFormat(lang, { numberingSystem: "latn" })` give them, for [Translator]. Plain
 * Kotlin/JVM has no CLDR plural API, so the rules of the languages below are written out and
 * checked against values taken from `Intl` (`kotlin/src/test/resources/intl-vectors.json`).
 * A language not listed uses the English rule and format.
 */
object LanguageRules {
    /** The languages with their own rules here; others are treated like English. */
    val LANGUAGES: Set<String> = setOf(
        "en", "hi", "bn", "mr", "gu", "pa", "ta", "te", "kn", "ml", "ur",
        "es", "fr", "de", "pt", "pt-PT", "it", "nl", "ru", "uk", "pl", "ar",
        "ja", "zh", "ko", "tr", "id", "vi",
    )

    private const val NBSP = " "
    private const val NNBSP = " "
    private const val LRM = "‎"

    private class Format(val group: String, val decimal: String, val indian: Boolean = false, val minGroup: Int = 1, val minus: String = "-")

    private val EN = Format(",", ".")
    private val INDIAN = Format(",", ".", indian = true)
    private val DOT_COMMA = Format(".", ",")
    private val SPACE_COMMA = Format(NBSP, ",")
    private val RTL = Format(",", ".", minus = "$LRM-")

    private val FORMATS: Map<String, Format> = mapOf(
        "hi" to INDIAN, "bn" to INDIAN, "mr" to INDIAN, "gu" to INDIAN, "pa" to INDIAN,
        "ta" to INDIAN, "te" to INDIAN, "ml" to INDIAN,
        "ur" to RTL, "ar" to RTL,
        "de" to DOT_COMMA, "nl" to DOT_COMMA, "pt" to DOT_COMMA, "tr" to DOT_COMMA, "id" to DOT_COMMA, "vi" to DOT_COMMA,
        "es" to Format(".", ",", minGroup = 2), "it" to Format(".", ",", minGroup = 2),
        "fr" to Format(NNBSP, ","),
        "ru" to SPACE_COMMA, "uk" to SPACE_COMMA,
        "pl" to Format(NBSP, ",", minGroup = 2), "pt-PT" to Format(NBSP, ",", minGroup = 2),
    )

    /** The most specific listed form of [language]: `pt-PT` stays, `pt-BR` → `pt`, `hi-IN` → `hi`. */
    private fun key(language: String): String {
        val code = language.replace('_', '-')
        val parts = code.split('-')
        val lang = parts[0].lowercase()
        val region = parts.drop(1).firstOrNull { it.length == 2 }?.uppercase()
        val withRegion = if (region != null) "$lang-$region" else lang
        return if (withRegion in LANGUAGES) withRegion else lang
    }

    /** [n] rounded as `Intl.PluralRules` does (at most three decimals, half away from zero). */
    private fun rounded(n: BigDecimal): BigDecimal {
        val r = n.abs().setScale(3, RoundingMode.HALF_UP).stripTrailingZeros()
        return if (r.scale() < 0) r.setScale(0) else r
    }

    /** The Unicode CLDR plural category of [n] in [language]: `zero`, `one`, `two`, `few`, `many` or `other`. */
    fun pluralCategory(language: String, n: Number): String {
        val d = decimal(n) ?: return "other"
        val r = rounded(d)
        val v = r.scale()
        val i = r.toBigInteger()
        val int = v == 0
        val isZero = r.signum() == 0
        val isOne = r.compareTo(BigDecimal.ONE) == 0
        val i10 = i.mod(BigInteger.TEN).toInt()
        val i100 = i.mod(BigInteger.valueOf(100)).toInt()
        val million = int && i.signum() != 0 && i.mod(BigInteger.valueOf(1_000_000)).signum() == 0
        return when (key(language)) {
            "ja", "zh", "ko", "id" -> "other"
            "hi", "bn", "gu", "kn", "vi" -> if (i.signum() == 0 || isOne) "one" else "other"
            "pa" -> if (isZero || isOne) "one" else "other"
            "fr", "pt" -> when {
                i.signum() == 0 || i == BigInteger.ONE -> "one"
                million -> "many"
                else -> "other"
            }
            "es", "it", "pt-PT" -> when {
                isOne -> "one"
                million -> "many"
                else -> "other"
            }
            "ru", "uk" -> when {
                !int -> "other"
                i10 == 1 && i100 != 11 -> "one"
                i10 in 2..4 && i100 !in 12..14 -> "few"
                else -> "many"
            }
            "pl" -> when {
                !int -> "other"
                i == BigInteger.ONE -> "one"
                i10 in 2..4 && i100 !in 12..14 -> "few"
                else -> "many"
            }
            "ar" -> when {
                isZero -> "zero"
                isOne -> "one"
                r.compareTo(BigDecimal.valueOf(2)) == 0 -> "two"
                int && i100 in 3..10 -> "few"
                int && i100 in 11..99 -> "many"
                else -> "other"
            }
            else -> if (isOne) "one" else "other"
        }
    }

    /**
     * [n] with Latin digits as `Intl.NumberFormat` writes it in [language]: at most three
     * decimals (rounded half away from zero), the language's separators and grouping (Indian
     * grouping `12,34,567` for Hindi and most Indian languages; none below 10,000 where the
     * language groups only from five digits).
     */
    fun formatNumber(language: String, n: Number): String {
        val d = decimal(n) ?: return when {
            n.toDouble().isNaN() -> "NaN"
            n.toDouble() > 0 -> "∞"
            else -> "-∞"
        }
        val f = FORMATS[key(language)] ?: EN
        val r = d.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros()
        val plain = r.abs().toPlainString()
        val whole = plain.substringBefore('.')
        val fraction = plain.substringAfter('.', "")
        val grouped = when {
            whole.length < 4 || whole.length < 4 + f.minGroup - 1 -> whole
            f.indian -> groupIndian(whole, f.group)
            else -> whole.reversed().chunked(3).joinToString(f.group).reversed()
        }
        val sign = if (r.signum() < 0) f.minus else ""
        return sign + grouped + if (fraction.isEmpty()) "" else f.decimal + fraction
    }

    private fun groupIndian(digits: String, sep: String): String {
        val head = digits.dropLast(3).reversed().chunked(2).joinToString(sep).reversed()
        return head + sep + digits.takeLast(3)
    }

    /** [n] as an exact decimal; null for NaN and infinities. */
    internal fun decimal(n: Number): BigDecimal? = when (n) {
        is BigDecimal -> n
        is BigInteger -> BigDecimal(n)
        is Double -> if (n.isFinite()) BigDecimal.valueOf(n) else null
        is Float -> if (n.isFinite()) BigDecimal(n.toString()) else null
        is Long, is Int, is Short, is Byte -> BigDecimal.valueOf(n.toLong())
        else -> n.toDouble().takeIf { it.isFinite() }?.let { BigDecimal.valueOf(it) }
    }
}
