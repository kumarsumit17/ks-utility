package com.ks.utility.appupdate

import java.io.File
import java.io.InputStream
import java.security.MessageDigest

/** SHA-256 (the JVM's own `MessageDigest`), to check a download against its published checksum. */
object Sha256 {
    private val HEX = Regex("^[0-9a-fA-F]{64}$")

    /** The SHA-256 of [bytes] as 64 lowercase hex digits. */
    fun hex(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).toHex()

    /** The SHA-256 of everything [input] yields (not closed here), as 64 lowercase hex digits. */
    fun hex(input: InputStream): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            md.update(buf, 0, n)
        }
        return md.digest().toHex()
    }

    /** The SHA-256 of a file, as 64 lowercase hex digits. */
    fun hex(file: File): String = file.inputStream().use { hex(it) }

    /** True when [expected] is 64 hex digits (any case) equal to [actual]. */
    fun matches(actual: String, expected: String): Boolean = HEX.matches(expected) && actual.equals(expected, ignoreCase = true)

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
}
