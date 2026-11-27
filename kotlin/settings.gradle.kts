pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
        // Google's mirror of Maven Central, a second source when Central does not answer a
        // GitHub runner (specs/usage.md, "Kotlin apps").
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
        // The same mirror, for the build's own dependencies.
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
    }
}

// Apps include this build with includeBuild("ks-utility/kotlin") and depend on "com.ks:utility".
rootProject.name = "utility"
