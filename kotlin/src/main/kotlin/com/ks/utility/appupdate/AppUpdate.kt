package com.ks.utility.appupdate

/*
 * App updates (specs/app-update.md): the decisions of "is there a newer version of this app,
 * and which file installs it here", without any network access. The app makes the one request
 * itself (to [GitHubRepo.latestReleaseApiUrl], with [GitHubRepo.requestHeaders]) and passes the
 * response body to [AppUpdate.evaluate]. Verify the download with [Sha256].
 *
 * An app whose platforms have their own versions (tags `mac-v1.3.0`, `android-v1.4.0`, see
 * [UpdatePlatform.tagPrefix]) asks [GitHubRepo.releasesApiUrl] instead and passes the body to
 * [AppUpdate.evaluateReleases], which takes the newest release for its platform.
 */

/** A GitHub repository, `owner/name`. Create it with [GitHubRepo.parse]. */
class GitHubRepo private constructor(val owner: String, val name: String) {
    /** The one request the check makes: `GET` this, unauthenticated. */
    val latestReleaseApiUrl: String get() = "https://api.github.com/repos/$owner/$name/releases/latest"

    /**
     * The newest releases, for an app whose platforms have their own tags: `releases/latest` may be
     * another platform's release. One page of [RELEASES_PER_PAGE], newest first.
     */
    val releasesApiUrl: String get() = "https://api.github.com/repos/$owner/$name/releases?per_page=$RELEASES_PER_PAGE"

    /** The page of one release, by its tag (e.g. `mac-v1.3.0`), for "Get the new version" links. */
    fun releasePageUrl(tag: String): String = "https://github.com/$owner/$name/releases/tag/$tag"

    /** The page of the newest release, for "Get the new version" links. */
    val latestReleasePageUrl: String get() = "https://github.com/$owner/$name/releases/latest"

    /** Every file the update may download starts with this. */
    val downloadPrefix: String get() = "https://github.com/$owner/$name/releases/download/"

    /** The only headers the request sends. No token, cookie or identifier. */
    val requestHeaders: Map<String, String>
        get() = mapOf("Accept" to "application/vnd.github+json", "X-GitHub-Api-Version" to "2022-11-28", "User-Agent" to name)

    override fun equals(other: Any?) = other is GitHubRepo && other.owner == owner && other.name == name
    override fun hashCode() = 31 * owner.hashCode() + name.hashCode()
    override fun toString() = "$owner/$name"

    companion object {
        /** How many releases [releasesApiUrl] asks for. */
        const val RELEASES_PER_PAGE = 30

        private val PART = Regex("^(?!\\.{1,2}$)[A-Za-z0-9._-]{1,100}$")

        /** Parses `owner/name`; null when it is not one. */
        fun parse(s: String): GitHubRepo? {
            val parts = s.trim().split('/')
            if (parts.size != 2 || !parts.all { PART.matches(it) }) return null
            return GitHubRepo(parts[0], parts[1])
        }
    }
}

/**
 * The system an installer is for. [GOOGLE_TV] is never detected: an Android app that is
 * running on a TV passes it, so it gets the TV build (`…-google-tv.apk`) and a phone never
 * does. When a release has no TV build, a TV takes the plain APK (a TV-only app's one APK,
 * or an app that still ships one APK for both). [CHROME] is never detected either: a Chrome
 * extension has no installer file (it opens the release page), so only its tag prefix matters.
 */
enum class UpdatePlatform(
    /**
     * The tag prefix of this platform's own releases (`mac-v1.3.0`), for an app whose platforms
     * have their own versions. Both macOS builds share `mac-`. A plain `v1.3.0` tag is a release
     * of every platform.
     */
    val tagPrefix: String,
) {
    MACOS_ARM64("mac-"), MACOS_X64("mac-"), WINDOWS_X64("windows-"), ANDROID("android-"), GOOGLE_TV("google-tv-"), CHROME("chrome-");

    companion object {
        /** The platform from the JVM's `os.name`, `os.arch` and `java.vm.name`; null for others. */
        fun detect(osName: String, osArch: String, vmName: String): UpdatePlatform? {
            val os = osName.lowercase()
            val arch = osArch.lowercase()
            return when {
                // Android's runtime (ART) still names itself Dalvik.
                vmName.contains("dalvik", ignoreCase = true) -> ANDROID
                os.contains("mac") && (arch == "aarch64" || arch == "arm64") -> MACOS_ARM64
                os.contains("mac") && (arch == "x86_64" || arch == "amd64") -> MACOS_X64
                os.contains("windows") && (arch == "amd64" || arch == "x86_64") -> WINDOWS_X64
                else -> null
            }
        }

        /** The platform this JVM runs on, if apps are released for it. */
        fun current(): UpdatePlatform? =
            detect(System.getProperty("os.name").orEmpty(), System.getProperty("os.arch").orEmpty(), System.getProperty("java.vm.name").orEmpty())
    }
}

/** A release file that may be downloaded: this repository's, a safe name, a size, and GitHub's SHA-256. */
data class ReleaseAsset(
    val name: String,
    val size: Long,
    val url: String,
    /** 64 lowercase hex digits, from GitHub's `sha256:` digest. */
    val sha256: String,
)

data class Release(
    /** Without the `v` or a platform prefix. */
    val version: String,
    /** Only the files that pass the rules of [ReleaseAsset]; others are left out. */
    val assets: List<ReleaseAsset>,
    /** The release's tag as it is (`v1.3.0`, `mac-v1.3.0`), for [GitHubRepo.releasePageUrl]. */
    val tag: String = "v$version",
) {
    /** The first usable file whose name passes [matches] (for apps with their own names). */
    fun find(matches: (String) -> Boolean): ReleaseAsset? = assets.firstOrNull { matches(it.name) }
}

/** What a check found. */
sealed interface UpdateOutcome {
    /** Nothing newer; [version] is the running one. */
    data class UpToDate(val version: String) : UpdateOutcome

    /** A newer version with a usable installer for this platform. */
    data class Available(val version: String, val asset: ReleaseAsset) : UpdateOutcome

    /** A newer version, but no usable installer for this platform (yet). */
    data class NoInstaller(val version: String) : UpdateOutcome
}

object AppUpdate {
    /** The version of a build made from source without a tag. It never checks by itself. */
    const val DEV_VERSION = "0.0.0"

    /** The automatic check runs at most once in this time (ms). */
    const val CHECK_INTERVAL_MS = 24L * 60 * 60 * 1000

    /** The automatic check waits this long after start-up (ms). */
    const val STARTUP_DELAY_MS = 10L * 1000

    /** While the app runs, it asks [isCheckDue] again this often (ms). */
    const val RECHECK_EVERY_MS = 60L * 60 * 1000

    /** The most of the response body the app should read. */
    const val MAX_RESPONSE_BYTES = 1 shl 20

    private val VERSION = Regex("^v?(\\d{1,9}(?:\\.\\d{1,9}){0,3})$")
    private val DIGEST = Regex("^sha256:[0-9a-fA-F]{64}$")
    private val ARM = listOf("aarch64", "arm64", "apple-silicon")
    private val X64 = listOf("x64", "x86_64", "amd64", "intel")
    /** A TV build names itself: `ks-app-v1.2.0-google-tv.apk` (also `googletv`, `android-tv`, `-tv.`). */
    private val TV = Regex("google-?tv|android-?tv|[-_.]tv[-_.]")

    /** `vMAJOR.MINOR.PATCH` (one to four numeric parts, optional leading `v`) as numbers. */
    fun parseVersion(s: String): List<Long>? = VERSION.matchEntire(s.trim())?.groupValues?.get(1)?.split('.')?.map { it.toLong() }

    /** True for `0.0.0` (with or without `v`). */
    fun isDevVersion(v: String): Boolean = parseVersion(v)?.all { it == 0L } == true

    /** [candidate] is a higher version than [current]; false when either is not a version. */
    fun isNewer(candidate: String, current: String): Boolean {
        val a = parseVersion(candidate) ?: return false
        val b = parseVersion(current) ?: return false
        for (i in 0 until maxOf(a.size, b.size)) {
            val x = a.getOrElse(i) { 0 }
            val y = b.getOrElse(i) { 0 }
            if (x != y) return x > y
        }
        return false
    }

    /**
     * The automatic check should run now: the switch is on, the build has a real version, and no
     * check ran in the last day. A last check in the future (clock set back) counts as due.
     * Times are milliseconds since 1970; [lastCheck] is null when never checked.
     */
    fun isCheckDue(enabled: Boolean, current: String, lastCheck: Long?, now: Long): Boolean {
        if (!enabled || parseVersion(current) == null || isDevVersion(current)) return false
        if (lastCheck == null) return true
        return now < lastCheck || now - lastCheck >= CHECK_INTERVAL_MS
    }

    /**
     * The version a tag gives [platform]: `v1.3.0` (every platform) or its own `<prefix>v1.3.0`
     * ([UpdatePlatform.tagPrefix]) gives `1.3.0`; another platform's tag gives null.
     */
    fun tagVersion(tag: String, platform: UpdatePlatform): String? {
        val t = tag.trim()
        val bare = if (t.startsWith(platform.tagPrefix)) t.substring(platform.tagPrefix.length) else t
        if (!bare.startsWith('v') && bare != t) return null
        return bare.takeIf { parseVersion(it) != null }?.removePrefix("v")
    }

    private fun safeJson(json: String): Any? = runCatching { Json.parse(json) }.getOrNull()

    /** Reads a `releases/latest` response; null when it is not JSON or its tag is not a version. */
    fun parseRelease(json: String, repo: GitHubRepo): Release? {
        val v = Json.parse(json) as? Map<*, *> ?: return null
        val tag = (v["tag_name"] as? String)?.trim() ?: return null
        if (parseVersion(tag) == null) return null
        return Release(tag.removePrefix("v"), assetsOf(v, repo), tag)
    }

    /**
     * Reads a [GitHubRepo.releasesApiUrl] response (a list) and returns the newest release for
     * [platform]: its own tag (`android-v1.4.0`) or a plain one (`v1.2.0`), never a draft or a
     * pre-release; null when it is not a list or none is for this platform.
     */
    fun parseReleases(json: String, repo: GitHubRepo, platform: UpdatePlatform): Release? {
        val list = safeJson(json) as? List<*> ?: return null
        var best: Release? = null
        for (item in list) {
            val v = item as? Map<*, *> ?: continue
            if (v["draft"] == true || v["prerelease"] == true) continue
            val tag = (v["tag_name"] as? String)?.trim() ?: continue
            val version = tagVersion(tag, platform) ?: continue
            if (best == null || isNewer(version, best.version)) best = Release(version, assetsOf(v, repo), tag)
        }
        return best
    }

    private fun assetsOf(v: Map<*, *>, repo: GitHubRepo): List<ReleaseAsset> {
        val prefix = repo.downloadPrefix
        return (v["assets"] as? List<*>).orEmpty().mapNotNull { a ->
            a as? Map<*, *> ?: return@mapNotNull null
            val name = a["name"] as? String ?: return@mapNotNull null
            if (name.isEmpty() || name.startsWith('.') || name.any { it == '/' || it == '\\' || it.isISOControl() }) return@mapNotNull null
            val url = a["browser_download_url"] as? String ?: return@mapNotNull null
            if (!url.startsWith(prefix) || url.contains("..")) return@mapNotNull null
            val digest = a["digest"] as? String ?: return@mapNotNull null
            if (!DIGEST.matches(digest)) return@mapNotNull null
            val size = (a["size"] as? Json.JsonNumber)?.text?.toLongOrNull()?.takeIf { it > 0 } ?: return@mapNotNull null
            ReleaseAsset(name, size, url, digest.substring(7).lowercase())
        }
    }

    private fun rank(name: String, platform: UpdatePlatform, repo: GitHubRepo): Int {
        val n = name.lowercase()
        fun any(words: List<String>) = words.any { n.contains(it) }
        return when (platform) {
            UpdatePlatform.MACOS_ARM64, UpdatePlatform.MACOS_X64 -> when {
                !n.endsWith(".dmg") -> 0
                any(if (platform == UpdatePlatform.MACOS_ARM64) ARM else X64) -> 2
                any(ARM) || any(X64) -> 0
                else -> 1
            }
            UpdatePlatform.WINDOWS_X64 -> {
                val installer = n.endsWith(".msi") ||
                    (n.endsWith(".exe") && (any(listOf("setup", "install")) || n.startsWith(repo.name.lowercase())))
                when {
                    any(ARM) || !installer -> 0
                    any(X64) -> 2
                    else -> 1
                }
            }
            UpdatePlatform.ANDROID -> if (!n.endsWith(".apk") || TV.containsMatchIn(n)) 0 else 2
            UpdatePlatform.GOOGLE_TV -> if (!n.endsWith(".apk")) 0 else if (TV.containsMatchIn(n)) 2 else 1
            UpdatePlatform.CHROME -> 0
        }
    }

    /** The installer for [platform]: a file made for it beats a universal one; of two, the larger wins. */
    fun pickAsset(assets: List<ReleaseAsset>, platform: UpdatePlatform, repo: GitHubRepo): ReleaseAsset? =
        assets.filter { rank(it.name, platform, repo) > 0 }
            .maxWithOrNull(compareBy<ReleaseAsset>({ rank(it.name, platform, repo) }, { it.size }))

    /** Decides from a parsed release and the app's choice of file. */
    fun decide(release: Release, current: String, asset: ReleaseAsset?): UpdateOutcome = when {
        !isNewer(release.version, current) -> UpdateOutcome.UpToDate(current.trim().removePrefix("v"))
        asset != null -> UpdateOutcome.Available(release.version, asset)
        else -> UpdateOutcome.NoInstaller(release.version)
    }

    /** Reads the response and decides; null when the response cannot be read. */
    fun evaluate(json: String, repo: GitHubRepo, current: String, platform: UpdatePlatform): UpdateOutcome? {
        val release = parseRelease(json, repo) ?: return null
        return decide(release, current, pickAsset(release.assets, platform, repo))
    }

    /** Reads a [GitHubRepo.releasesApiUrl] response and decides; null when it cannot be read or has no release for [platform]. */
    fun evaluateReleases(json: String, repo: GitHubRepo, current: String, platform: UpdatePlatform): UpdateOutcome? {
        val release = parseReleases(json, repo, platform) ?: return null
        return decide(release, current, pickAsset(release.assets, platform, repo))
    }
}
