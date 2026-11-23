package com.ks.utility.appupdate

/**
 * A small JSON reader (RFC 8259), enough to read a GitHub release. Internal: this library has
 * no dependencies. Objects become [Map], arrays [List], numbers stay as their text ([JsonNumber]).
 */
internal object Json {
    private const val MAX_DEPTH = 64

    @JvmInline
    value class JsonNumber(val text: String)

    /** The value, or null when [text] is not JSON. JSON `null` comes back as [Unit]. */
    fun parse(text: String): Any? {
        val p = Parser(text)
        return try {
            val v = p.value(0)
            p.ws()
            if (p.i == text.length) v else null
        } catch (_: IllegalArgumentException) {
            null
        } catch (_: IndexOutOfBoundsException) {
            null
        }
    }

    private class Parser(val s: String) {
        var i = 0

        fun ws() {
            while (i < s.length && s[i] in " \t\n\r") i++
        }

        fun eat(lit: String): Boolean = s.startsWith(lit, i).also { if (it) i += lit.length }

        fun fail(): Nothing = throw IllegalArgumentException("not JSON at $i")

        fun value(depth: Int): Any {
            if (depth > MAX_DEPTH) fail()
            ws()
            return when (s[i]) {
                '{' -> {
                    i++
                    val m = LinkedHashMap<String, Any>()
                    ws()
                    if (eat("}")) return m
                    while (true) {
                        ws()
                        val k = string()
                        ws()
                        if (!eat(":")) fail()
                        m.putIfAbsent(k, value(depth + 1))
                        ws()
                        if (eat("}")) return m
                        if (!eat(",")) fail()
                    }
                    @Suppress("UNREACHABLE_CODE")
                    m
                }
                '[' -> {
                    i++
                    val a = ArrayList<Any>()
                    ws()
                    if (eat("]")) return a
                    while (true) {
                        a.add(value(depth + 1))
                        ws()
                        if (eat("]")) return a
                        if (!eat(",")) fail()
                    }
                    @Suppress("UNREACHABLE_CODE")
                    a
                }
                '"' -> string()
                't' -> if (eat("true")) true else fail()
                'f' -> if (eat("false")) false else fail()
                'n' -> if (eat("null")) Unit else fail()
                else -> number()
            }
        }

        private fun digits(): Boolean {
            val start = i
            while (i < s.length && s[i] in '0'..'9') i++
            return i > start
        }

        fun number(): JsonNumber {
            val start = i
            eat("-")
            if (!digits()) fail()
            if (eat(".") && !digits()) fail()
            if (i < s.length && (s[i] == 'e' || s[i] == 'E')) {
                i++
                if (!eat("+")) eat("-")
                if (!digits()) fail()
            }
            return JsonNumber(s.substring(start, i))
        }

        private fun hex4(): Int {
            val h = s.substring(i, i + 4)
            if (!h.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) fail()
            i += 4
            return h.toInt(16)
        }

        fun string(): String {
            if (!eat("\"")) fail()
            val out = StringBuilder()
            while (true) {
                val c = s[i++]
                when {
                    c == '"' -> return out.toString()
                    c == '\\' -> when (s[i++]) {
                        '"' -> out.append('"')
                        '\\' -> out.append('\\')
                        '/' -> out.append('/')
                        'b' -> out.append('\b')
                        'f' -> out.append('\u000C')
                        'n' -> out.append('\n')
                        'r' -> out.append('\r')
                        't' -> out.append('\t')
                        'u' -> {
                            val hi = hex4()
                            if (hi in 0xD800..0xDBFF) {
                                if (!eat("\\u")) fail()
                                val lo = hex4()
                                if (lo !in 0xDC00..0xDFFF) fail()
                                out.append(hi.toChar()).append(lo.toChar())
                            } else if (hi in 0xDC00..0xDFFF) {
                                fail()
                            } else {
                                out.append(hi.toChar())
                            }
                        }
                        else -> fail()
                    }
                    c < ' ' -> fail()
                    else -> out.append(c)
                }
            }
        }
    }
}
