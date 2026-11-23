package com.ks.utility.lang

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

/**
 * Look-up of interface text in the suite's language files, the Kotlin twin of the TypeScript
 * `createTranslator` ([translation-format.md](https://github.com/kumarsumit17/ks-utility/blob/main/specs/translation-format.md)),
 * for Kotlin code that does not use Android or Compose resources (a server, a command-line tool).
 *
 * [layers] are catalogs per language code (`mapOf("en" to …, "hi" to …)`), searched from last
 * to first, so an app passes the shared catalogue first and its own files after it. A key
 * missing in [language] is taken from English; a key missing everywhere is returned as it is.
 */
class Translator(val language: String, layers: List<Map<String, Catalog>>) {
    constructor(language: String, vararg layers: Map<String, Catalog>) : this(language, layers.toList())

    private val layers = layers.toList()
    private val order = if (language == FALLBACK_LANGUAGE) listOf(language) else listOf(language, FALLBACK_LANGUAGE)

    /** True when [key] has a text in [language] or English. */
    fun has(key: String): Boolean = order.any { lang -> layers.any { it[lang]?.contains(key) == true } }

    /**
     * The text of [key], with each `{name}` that has a value in [params] filled in. Numbers are
     * formatted for the language ([formatNumber]); other values with `toString()`. Plural forms
     * are chosen by the `count` parameter ([pluralCategory]); without a number, `other` is used.
     */
    fun t(key: String, params: Map<String, Any?> = emptyMap()): String {
        for (lang in order) {
            for (i in layers.indices.reversed()) {
                val entry = layers[i][lang]?.get(key) ?: continue
                val text = when (entry) {
                    is Entry.Text -> entry.text
                    is Entry.Plural -> {
                        val n = when (val c = params[COUNT]) {
                            is Number -> c
                            is String -> c.trim().toBigDecimalOrNull()
                            else -> null
                        }
                        val category = n?.let { pluralCategory(lang, it) } ?: "other"
                        entry.forms[category] ?: entry.forms.getValue("other")
                    }
                }
                return fill(lang, text, params)
            }
        }
        return key
    }

    /** Shorthand for [t]: `tr("downloads.added", "name" to file)`. */
    operator fun invoke(key: String, vararg params: Pair<String, Any?>): String = t(key, params.toMap())

    companion object {
        /** The language every app falls back to. */
        const val FALLBACK_LANGUAGE = "en"

        /** The parameter that chooses the plural form. */
        const val COUNT = "count"

        private val PLACEHOLDER = Regex("""\{([A-Za-z][A-Za-z0-9]*)}""")

        private fun base(language: String) = language.substringBefore('-').substringBefore('_').lowercase()

        private fun fill(language: String, text: String, params: Map<String, Any?>): String {
            if (params.isEmpty()) return text
            return PLACEHOLDER.replace(text) { m ->
                when (val v = params[m.groupValues[1]]) {
                    null -> m.value
                    is Number -> formatNumber(language, v)
                    else -> v.toString()
                }
            }
        }

        /**
         * The Unicode CLDR plural category of [n]: Hindi `one` is 0 to 1 (integer part 0, or
         * exactly 1); English `one` is exactly 1. Other languages use the English rule.
         */
        fun pluralCategory(language: String, n: Number): String {
            val d = decimal(n)?.abs() ?: return "other"
            val isOne = d.compareTo(BigDecimal.ONE) == 0
            val one = if (base(language) == "hi") isOne || d < BigDecimal.ONE else isOne
            return if (one) "one" else "other"
        }

        /**
         * [n] with Latin digits, as `Intl.NumberFormat` writes it: at most three decimals
         * (rounded half away from zero), grouped by thousands, or the Indian way for Hindi
         * (`12,34,567`).
         */
        fun formatNumber(language: String, n: Number): String {
            val d = decimal(n) ?: return when {
                n.toDouble().isNaN() -> "NaN"
                n.toDouble() > 0 -> "∞"
                else -> "-∞"
            }
            val rounded = d.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros()
            val plain = rounded.abs().toPlainString()
            val whole = plain.substringBefore('.')
            val fraction = plain.substringAfter('.', "")
            val grouped = if (base(language) == "hi") groupIndian(whole) else groupThousands(whole)
            val sign = if (rounded.signum() < 0) "-" else ""
            return sign + grouped + if (fraction.isEmpty()) "" else ".$fraction"
        }

        /** [n] as an exact decimal; null for NaN and infinities. */
        private fun decimal(n: Number): BigDecimal? = when (n) {
            is BigDecimal -> n
            is BigInteger -> BigDecimal(n)
            is Double -> if (n.isFinite()) BigDecimal.valueOf(n) else null
            is Float -> if (n.isFinite()) BigDecimal(n.toString()) else null
            is Long, is Int, is Short, is Byte -> BigDecimal.valueOf(n.toLong())
            else -> n.toDouble().takeIf { it.isFinite() }?.let { BigDecimal.valueOf(it) }
        }

        private fun groupThousands(digits: String) = digits.reversed().chunked(3).joinToString(",").reversed()

        private fun groupIndian(digits: String): String {
            if (digits.length <= 3) return digits
            val head = digits.dropLast(3).reversed().chunked(2).joinToString(",").reversed()
            return head + "," + digits.takeLast(3)
        }
    }
}
