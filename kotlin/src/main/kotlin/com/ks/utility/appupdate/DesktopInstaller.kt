package com.ks.utility.appupdate

import java.io.File
import kotlin.system.exitProcess

/**
 * Opens a downloaded desktop update and quits the app so it can be replaced (specs/app-update.md,
 * "How each platform installs"). Nothing is installed silently: the system's own installer or
 * Finder does the rest, with the person watching.
 *
 * - **Windows:** marks the installer as downloaded from the internet (`Zone.Identifier`, zone 3,
 *   so SmartScreen checks it), starts it (`msiexec /i` for an `.msi`), calls [beforeQuit] and quits
 *   at once (`common.appUpdate.openedWindows` is shown by the installer's own window).
 * - **macOS:** quarantines the disk image as a browser download would (so Gatekeeper checks it),
 *   opens it, and returns [Opened.MAC] so the app shows `common.appUpdate.openedMacCloses`; after
 *   [quitAfterMs] it calls [beforeQuit] and quits, because Finder cannot replace a running app.
 *
 * [beforeQuit] saves what the app must keep (settings, a playlist position). The other
 * parameters are for tests.
 */
class DesktopInstaller(
    /** The app's name as people see it, recorded in the macOS quarantine mark (e.g. KS JaiPlayer). */
    private val appName: String,
    private val beforeQuit: () -> Unit,
    private val quitAfterMs: Long = MAC_QUIT_AFTER_MS,
    private val osName: String = System.getProperty("os.name").orEmpty(),
    private val run: (List<String>, Boolean) -> Unit = ::runProcess,
    private val exit: () -> Unit = { exitProcess(0) },
    private val later: (Long, () -> Unit) -> Unit = ::afterDelay,
) {
    enum class Opened { MAC, WINDOWS }

    private val windows get() = osName.startsWith("Windows", ignoreCase = true)
    private val mac get() = osName.lowercase().let { it.contains("mac") || it.contains("darwin") }

    /** Opens [file] (a `.dmg`, `.msi` or `.exe`); throws for another system or file, so the app shows `openFailed`. */
    fun open(file: File): Opened {
        val name = file.name.lowercase()
        if (windows) {
            require(name.endsWith(".msi") || name.endsWith(".exe")) { "not a Windows installer: ${file.name}" }
            markFromInternet(file)
            run(windowsCommand(file), false)
            beforeQuit()
            exit()
            return Opened.WINDOWS
        }
        require(mac) { "updates are installed by this helper only on macOS and Windows" }
        require(name.endsWith(".dmg")) { "not a disk image: ${file.name}" }
        runCatching { run(listOf("xattr", "-w", "com.apple.quarantine", quarantineValue(appName), file.path), true) }
        run(listOf("open", file.path), true)
        later(quitAfterMs) {
            beforeQuit()
            exit()
        }
        return Opened.MAC
    }

    companion object {
        /** How long the Mac app shows that it now closes before it quits (6 s). */
        const val MAC_QUIT_AFTER_MS = 6_000L

        /** The command that starts a Windows installer. */
        fun windowsCommand(file: File): List<String> =
            if (file.name.endsWith(".msi", ignoreCase = true)) listOf("msiexec", "/i", file.path) else listOf(file.path)

        /** The `com.apple.quarantine` value of a download: flags 0081, no time, the app as the downloader. */
        fun quarantineValue(appName: String): String = "0081;00000000;${appName.replace(";", " ")};"

        /** The internet zone mark of a Windows download. */
        const val ZONE_IDENTIFIER = "[ZoneTransfer]\r\nZoneId=3\r\n"

        private fun markFromInternet(file: File) {
            runCatching { File(file.path + ":Zone.Identifier").writeText(ZONE_IDENTIFIER) }
        }

        private fun runProcess(command: List<String>, wait: Boolean) {
            val p = ProcessBuilder(command).start()
            if (wait) p.waitFor()
        }

        private fun afterDelay(ms: Long, action: () -> Unit) {
            Thread({
                Thread.sleep(ms)
                action()
            }, "update-quit").apply { isDaemon = true }.start()
        }
    }
}
