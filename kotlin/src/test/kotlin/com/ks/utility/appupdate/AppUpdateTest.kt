package com.ks.utility.appupdate

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AppUpdateTest {
    private val repo = GitHubRepo.parse("someone/ks-app")!!
    private fun sha(c: Char) = "sha256:" + c.toString().repeat(64)
    private fun asset(
        name: String,
        size: Long = 1,
        digest: String = sha('a'),
        url: String = "https://github.com/someone/ks-app/releases/download/v1.2.0/$name",
    ) = """{"name":"$name","size":$size,"digest":"$digest","browser_download_url":"$url"}"""
    private fun release(tag: String, vararg assets: String) =
        """{"tag_name":"$tag","body":"notes \"quoted\" \u00e9","draft":false,"assets":[${assets.joinToString(",")}]}"""

    @Test
    fun versions() {
        assertEquals(listOf(1L, 2L, 3L), AppUpdate.parseVersion("v1.2.3"))
        for (bad in listOf("1.2.3.4.5", "1..2", "../evil", "1.2.3-beta", "")) assertNull(AppUpdate.parseVersion(bad), bad)
        assertTrue(AppUpdate.isNewer("0.1.10", "0.1.9"))
        assertTrue(AppUpdate.isNewer("v1.0.0", "0.9.9"))
        assertTrue(AppUpdate.isNewer("1.0.1", "1.0"))
        assertFalse(AppUpdate.isNewer("1.0.0", "1"))
        assertFalse(AppUpdate.isNewer("0.1.3", "0.1.3"))
        assertFalse(AppUpdate.isNewer("0.1.2", "0.1.3"))
        assertFalse(AppUpdate.isNewer("x", "0.1.3"))
        assertTrue(AppUpdate.isDevVersion("0.0.0") && AppUpdate.isDevVersion("v0.0.0") && !AppUpdate.isDevVersion("0.0.1"))
    }

    @Test
    fun dailyCheck() {
        val now = System.currentTimeMillis()
        assertTrue(AppUpdate.isCheckDue(true, "1.0.0", null, now))
        assertFalse(AppUpdate.isCheckDue(false, "1.0.0", null, now), "switch off")
        assertFalse(AppUpdate.isCheckDue(true, AppUpdate.DEV_VERSION, null, now), "built from source")
        assertFalse(AppUpdate.isCheckDue(true, "1.0.0", now - 60_000, now))
        assertTrue(AppUpdate.isCheckDue(true, "1.0.0", now - AppUpdate.CHECK_INTERVAL_MS, now))
        assertTrue(AppUpdate.isCheckDue(true, "1.0.0", now + 3_600_000, now), "clock set back")
    }

    @Test
    fun repoAndUrls() {
        assertEquals("https://api.github.com/repos/someone/ks-app/releases/latest", repo.latestReleaseApiUrl)
        assertEquals("https://github.com/someone/ks-app/releases/latest", repo.latestReleasePageUrl)
        assertEquals(setOf("Accept", "X-GitHub-Api-Version", "User-Agent"), repo.requestHeaders.keys)
        for (bad in listOf("someone", "a/b/c", "../x", "a/..", "a b/c", "/x", "a/")) assertNull(GitHubRepo.parse(bad), bad)
    }

    @Test
    fun platforms() {
        assertEquals(UpdatePlatform.ANDROID, UpdatePlatform.detect("Linux", "aarch64", "Dalvik"))
        assertEquals(UpdatePlatform.MACOS_ARM64, UpdatePlatform.detect("Mac OS X", "aarch64", "OpenJDK 64-Bit Server VM"))
        assertEquals(UpdatePlatform.MACOS_X64, UpdatePlatform.detect("Mac OS X", "x86_64", "OpenJDK 64-Bit Server VM"))
        assertEquals(UpdatePlatform.WINDOWS_X64, UpdatePlatform.detect("Windows 11", "amd64", "OpenJDK 64-Bit Server VM"))
        assertNull(UpdatePlatform.detect("Linux", "amd64", "OpenJDK 64-Bit Server VM"))
    }

    @Test
    fun installerForEachPlatform() {
        val r = AppUpdate.parseRelease(
            release(
                "v1.2.0",
                asset("ks-app-v1.2.0-macos-arm64.dmg", 10),
                asset("ks-app-v1.2.0-macos-x64.dmg", 11),
                asset("ks-app-v1.2.0-windows-x64-setup.exe", 12),
                asset("ks-app-v1.2.0.apk", 13),
                asset("ks-app-extension-v1.2.0.zip", 14),
                asset("ffmpeg.exe", 99),
            ),
            repo,
        )!!
        assertEquals("1.2.0", r.version)
        fun pick(p: UpdatePlatform) = AppUpdate.pickAsset(r.assets, p, repo)?.name
        assertEquals("ks-app-v1.2.0-macos-arm64.dmg", pick(UpdatePlatform.MACOS_ARM64))
        assertEquals("ks-app-v1.2.0-macos-x64.dmg", pick(UpdatePlatform.MACOS_X64))
        assertEquals("ks-app-v1.2.0-windows-x64-setup.exe", pick(UpdatePlatform.WINDOWS_X64))
        assertEquals("ks-app-v1.2.0.apk", pick(UpdatePlatform.ANDROID))
        assertEquals(14L, r.find { it.endsWith(".zip") }?.size)
    }

    @Test
    fun phoneAndTvBuildsNeverSwap() {
        val split = AppUpdate.parseRelease(release("1.2.0", asset("ks-app-v1.2.0.apk", 5), asset("ks-app-v1.2.0-google-tv.apk", 9), asset("ks-app-v1.2.0.aab", 20)), repo)!!
        assertEquals("ks-app-v1.2.0.apk", AppUpdate.pickAsset(split.assets, UpdatePlatform.ANDROID, repo)?.name)
        assertEquals("ks-app-v1.2.0-google-tv.apk", AppUpdate.pickAsset(split.assets, UpdatePlatform.GOOGLE_TV, repo)?.name)
        // One APK for both (or a TV-only app): a TV takes it; a phone never takes a TV build.
        val one = AppUpdate.parseRelease(release("1.2.0", asset("ks-app-v1.2.0.apk", 5)), repo)!!
        assertEquals("ks-app-v1.2.0.apk", AppUpdate.pickAsset(one.assets, UpdatePlatform.GOOGLE_TV, repo)?.name)
        val tvOnly = AppUpdate.parseRelease(release("1.2.0", asset("ks-app-v1.2.0-google-tv.apk", 5)), repo)!!
        assertNull(AppUpdate.pickAsset(tvOnly.assets, UpdatePlatform.ANDROID, repo))
    }

    @Test
    fun universalFilesAndSize() {
        val r = AppUpdate.parseRelease(release("1.2.0", asset("ks-app.dmg", 5), asset("ks-app.msi", 6), asset("small.apk", 1), asset("universal.apk", 9)), repo)!!
        fun pick(p: UpdatePlatform) = AppUpdate.pickAsset(r.assets, p, repo)?.name
        assertEquals("ks-app.dmg", pick(UpdatePlatform.MACOS_ARM64))
        assertEquals("ks-app.dmg", pick(UpdatePlatform.MACOS_X64))
        assertEquals("ks-app.msi", pick(UpdatePlatform.WINDOWS_X64))
        assertEquals("universal.apk", pick(UpdatePlatform.ANDROID))
    }

    @Test
    fun unsafeOrUncheckedFilesAreDropped() {
        val r = AppUpdate.parseRelease(
            release(
                "v1.2.0",
                asset("nodigest.apk", digest = "md5:abc"),
                asset("short.apk", digest = "sha256:abc"),
                asset("empty.apk", size = 0),
                asset(".hidden.apk"),
                asset("a.apk", url = "https://example.com/a.apk"),
                asset("a.apk", url = "https://github.com/someone/ks-app-evil/releases/download/v1/a.apk"),
            ),
            repo,
        )!!
        assertEquals(emptyList(), r.assets)
        assertNull(AppUpdate.parseRelease(release("../evil"), repo))
        assertNull(AppUpdate.parseRelease("not json", repo))
    }

    @Test
    fun outcomes() {
        val json = release("v1.2.0", asset("ks-app-v1.2.0.apk", 3, sha('A')))
        val a = assertIs<UpdateOutcome.Available>(AppUpdate.evaluate(json, repo, "1.1.0", UpdatePlatform.ANDROID))
        assertEquals("1.2.0", a.version)
        assertEquals("a".repeat(64), a.asset.sha256)
        assertEquals(UpdateOutcome.UpToDate("1.2.0"), AppUpdate.evaluate(json, repo, "1.2.0", UpdatePlatform.ANDROID))
        assertEquals(UpdateOutcome.NoInstaller("1.2.0"), AppUpdate.evaluate(json, repo, "1.1.0", UpdatePlatform.WINDOWS_X64))
        assertNull(AppUpdate.evaluate("{}", repo, "1.1.0", UpdatePlatform.ANDROID))
    }

    @Test
    fun json() {
        val v = Json.parse("""{"a":[1,-2.5e3,true,false,null],"b":"x\"\u00e9\ud83d\ude00\n","c":{}}""") as Map<*, *>
        assertEquals(5, (v["a"] as List<*>).size)
        assertEquals("x\"é😀\n", v["b"])
        for (bad in listOf("", "{", "[1,]", "{\"a\" 1}", "\"\\ud800\"", "1 2", "tru", "\"a\nb\"")) assertNull(Json.parse(bad), bad)
        assertNull(Json.parse("[".repeat(100) + "]".repeat(100)), "too deep")
    }

    @Test
    fun sha256() {
        val abc = Sha256.hex("abc".toByteArray())
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", abc)
        assertEquals(abc, Sha256.hex("abc".byteInputStream()))
        assertTrue(Sha256.matches(abc, abc.uppercase()))
        assertFalse(Sha256.matches(abc, ""))
    }

    @Test
    fun platformTags() {
        assertEquals("1.3.0", AppUpdate.tagVersion("mac-v1.3.0", UpdatePlatform.MACOS_ARM64))
        assertEquals("1.3.0", AppUpdate.tagVersion("mac-v1.3.0", UpdatePlatform.MACOS_X64))
        assertEquals("1.2.0", AppUpdate.tagVersion("v1.2.0", UpdatePlatform.GOOGLE_TV), "a plain tag is every platform's")
        assertNull(AppUpdate.tagVersion("android-v1.4.0", UpdatePlatform.GOOGLE_TV), "another platform's tag")
        assertNull(AppUpdate.tagVersion("google-tv-v1.4.0", UpdatePlatform.ANDROID))
        assertEquals("2.1.0", AppUpdate.tagVersion("chrome-v2.1.0", UpdatePlatform.CHROME))
        assertNull(AppUpdate.tagVersion("chrome-v2.1.0", UpdatePlatform.WINDOWS_X64))
        assertEquals("2.0.0", AppUpdate.tagVersion("v2.0.0", UpdatePlatform.CHROME))
        assertNull(AppUpdate.tagVersion("mac-1.3.0", UpdatePlatform.MACOS_ARM64), "the v is required after a prefix")
        assertNull(AppUpdate.tagVersion("mac-v1.3.0-beta", UpdatePlatform.MACOS_ARM64))
        assertEquals("https://api.github.com/repos/someone/ks-app/releases?per_page=30", repo.releasesApiUrl)
        assertEquals("https://github.com/someone/ks-app/releases/tag/mac-v1.3.0", repo.releasePageUrl("mac-v1.3.0"))
    }

    @Test
    fun releaseListPicksThisPlatformsNewest() {
        val list = "[" + listOf(
            release("windows-v2.0.0", asset("ks-app-v2.0.0-windows-x64.msi")),
            release("android-v1.4.0", asset("ks-app-v1.4.0.apk")),
            release("google-tv-v1.6.0", asset("ks-app-v1.6.0-google-tv.apk")).replace("\"draft\":false", "\"draft\":true"),
            release("google-tv-v1.5.0", asset("ks-app-v1.5.0-google-tv.apk")),
            release("v1.2.0", asset("ks-app-v1.2.0.apk"), asset("ks-app-v1.2.0-google-tv.apk")),
        ).joinToString(",") + "]"
        val tv = AppUpdate.parseReleases(list, repo, UpdatePlatform.GOOGLE_TV)!!
        assertEquals("1.5.0", tv.version, "the draft is skipped")
        assertEquals("google-tv-v1.5.0", tv.tag)
        assertEquals("1.4.0", AppUpdate.parseReleases(list, repo, UpdatePlatform.ANDROID)!!.version)
        assertEquals("1.2.0", AppUpdate.parseReleases(list, repo, UpdatePlatform.MACOS_ARM64)!!.version, "only the plain tag is for macOS")
        val outcome = AppUpdate.evaluateReleases(list, repo, "1.3.0", UpdatePlatform.ANDROID)
        assertIs<UpdateOutcome.Available>(outcome)
        assertEquals("ks-app-v1.4.0.apk", outcome.asset.name)
        assertIs<UpdateOutcome.UpToDate>(AppUpdate.evaluateReleases(list, repo, "2.0.0", UpdatePlatform.WINDOWS_X64))
        assertNull(AppUpdate.parseReleases(release("v1.0.0"), repo, UpdatePlatform.ANDROID), "not a list")
        assertNull(AppUpdate.parseReleases("not json", repo, UpdatePlatform.ANDROID))
        assertNull(AppUpdate.parseReleases("[]", repo, UpdatePlatform.ANDROID))
    }
}
