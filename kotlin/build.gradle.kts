import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Plain Kotlin/JVM library: no Android SDK, so Android, TV and desktop apps can all use it.
plugins {
    alias(libs.plugins.kotlin.jvm)
}

group = "com.ks"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    // Part of Kotlin itself; test-only.
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
