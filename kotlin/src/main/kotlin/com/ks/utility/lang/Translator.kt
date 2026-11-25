package com.ks.utility.lang

/**
 * Look-up of interface text in the suite's language files, the Kotlin twin of the TypeScript
 * `createTranslator` ([translation-format.md](https://github.com/kumarsumit17/ks-utility/blob/main/specs/translation-format.md)),
 * for Kotlin code that does not use Android or Compose resources (a server, a command-line tool).
 *
 * [layers] are catalogs per language code (`mapOf("en" to …, "hi" to …, "fr" to …)`), searched
 * from last to first, so an app passes the shared catalogue first and its own files after it.
 * A key missing in [language] is taken from its less specific forms (`pt-BR`, then `pt`) and
 * then from English; a key missing everywhere is returned as it is.
 */
class Translator(val language: String, layers: List<Map<String, Catalog>>) {
    constructor(language: String, vararg layers: Map<String, Catalog>) : this(language, layers.toList())

    private val layers = layers.toList()
    private val order = fallbacks(language)

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

        /**
         * The languages a text is looked up in, most specific first, ending in English:
         * `pt-BR` → `pt-BR`, `pt`, `en`.
         */
        fun fallbacks(language: String): List<String> {
            val parts = language.split('-')
            val out = (parts.size downTo 1).map { parts.take(it).joinToString("-") }.toMutableList()
            if (FALLBACK_LANGUAGE !in out) out += FALLBACK_LANGUAGE
            return out
        }

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
         * The Unicode CLDR plural category of [n] in [language], as `Intl.PluralRules` gives it,
         * for the languages of [LanguageRules.LANGUAGES]; others use the English rule.
         */
        fun pluralCategory(language: String, n: Number): String = LanguageRules.pluralCategory(language, n)

        /**
         * [n] with Latin digits, as `Intl.NumberFormat` writes it: at most three decimals
         * (rounded half away from zero), the language's separators and grouping (Indian for
         * Hindi, `12,34,567`). Languages outside [LanguageRules.LANGUAGES] are formatted as English.
         */
        fun formatNumber(language: String, n: Number): String = LanguageRules.formatNumber(language, n)
    }
}
