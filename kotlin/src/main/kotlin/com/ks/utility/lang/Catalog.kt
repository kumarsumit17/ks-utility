package com.ks.utility.lang

import com.ks.utility.appupdate.Json

/**
 * One entry of a language file in the suite's format
 * ([translation-format.md](https://github.com/kumarsumit17/ks-utility/blob/main/specs/translation-format.md)):
 * a text, or plural forms chosen by the `{count}` parameter.
 */
sealed interface Entry {
    data class Text(val text: String) : Entry

    /** Unicode CLDR category (`one`, `other`, …) to text. `other` is always present. */
    data class Plural(val forms: Map<String, String>) : Entry {
        init {
            require("other" in forms) { "plural forms need \"other\"" }
        }
    }
}

/** The texts of one language: key to [Entry]. Read from a language file with [parse]. */
class Catalog(val entries: Map<String, Entry>) {
    operator fun get(key: String): Entry? = entries[key]

    operator fun contains(key: String): Boolean = key in entries

    companion object {
        /**
         * The catalog in [json], one language file. Throws [IllegalArgumentException] when it is
         * not a JSON object of texts and plural forms; the language-file check finds the details.
         */
        fun parse(json: String): Catalog {
            val root = Json.parse(json) as? Map<*, *> ?: throw IllegalArgumentException("not a JSON object")
            val entries = LinkedHashMap<String, Entry>()
            for ((k, v) in root) {
                val key = k as String
                entries[key] = when (v) {
                    is String -> Entry.Text(v)
                    is Map<*, *> -> Entry.Plural(
                        v.entries.associate { (c, t) ->
                            (c as String) to (t as? String ?: throw IllegalArgumentException("\"$key\": the form \"$c\" is not a text"))
                        },
                    )
                    else -> throw IllegalArgumentException("\"$key\" is neither a text nor plural forms")
                }
            }
            return Catalog(entries)
        }
    }
}
