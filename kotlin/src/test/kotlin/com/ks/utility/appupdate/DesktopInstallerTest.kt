package com.ks.utility.appupdate

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class DesktopInstallerTest {
    private class Recorder(os: String) {
        val events = mutableListOf<String>()
        var delayed: Pair<Long, () -> Unit>? = null
        val installer = DesktopInstaller(
            appName = "KS App",
            beforeQuit = { events += "beforeQuit" },
            osName = os,
            run = { cmd, wait -> events += "run(${cmd.joinToString(" ")}, wait=$wait)" },
            exit = { events += "exit" },
            later = { ms, action -> delayed = ms to action },
        )
    }

    @Test
    fun macOpensTheQuarantinedDiskImageThenQuitsLater() {
        val r = Recorder("Mac OS X")
        val dmg = File("/tmp/ks-app-v1.2.0-macos-arm64.dmg")
        assertEquals(DesktopInstaller.Opened.MAC, r.installer.open(dmg))
        assertEquals(
            listOf("run(xattr -w com.apple.quarantine 0081;00000000;KS App; ${dmg.path}, wait=true)", "run(open ${dmg.path}, wait=true)"),
            r.events,
            "nothing quits before the person has seen the sentence",
        )
        val (ms, action) = r.delayed!!
        assertEquals(6_000L, ms)
        action()
        assertEquals(listOf("beforeQuit", "exit"), r.events.takeLast(2))
    }

    @Test
    fun windowsStartsTheInstallerAndQuitsAtOnce() {
        val r = Recorder("Windows 11")
        val dir = kotlin.io.path.createTempDirectory("ks-install").toFile()
        val msi = File(dir, "ks-app-v1.2.0-windows-x64.msi").apply { writeText("x") }
        assertEquals(DesktopInstaller.Opened.WINDOWS, r.installer.open(msi))
        assertEquals(listOf("run(msiexec /i ${msi.path}, wait=false)", "beforeQuit", "exit"), r.events)
        assertEquals(listOf("setup.exe"), DesktopInstaller.windowsCommand(File("setup.exe")))
        dir.deleteRecursively()
    }

    @Test
    fun refusesOtherFilesAndSystems() {
        assertFailsWith<IllegalArgumentException> { Recorder("Mac OS X").installer.open(File("a.msi")) }
        assertFailsWith<IllegalArgumentException> { Recorder("Windows 10").installer.open(File("a.dmg")) }
        assertFailsWith<IllegalArgumentException> { Recorder("Linux").installer.open(File("a.dmg")) }
        assertTrue(Recorder("Linux").events.isEmpty())
    }

    @Test
    fun quarantineValueKeepsItsFourFields() {
        assertEquals("0081;00000000;A B;", DesktopInstaller.quarantineValue("A;B"))
    }
}
