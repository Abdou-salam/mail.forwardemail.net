#!/usr/bin/env node
/**
 * Inject Firebase/FCM configuration into the Tauri-generated Android project.
 *
 * Called in CI after `tauri android init` regenerates gen/android/.
 *
 * Handles:
 *   1. Copies google-services.json into the app module (from env var path or default location)
 *   2. Adds the google-services Gradle plugin to the build
 *   3. Adds Firebase BOM + messaging dependency to build.gradle.kts
 *   4. Adds required permissions to AndroidManifest.xml
 *
 * Environment variables:
 *   GOOGLE_SERVICES_JSON - Path to google-services.json (default: scripts/android/google-services.json)
 */
const fs = require('fs');
const path = require('path');

const GEN_ANDROID = path.resolve(__dirname, '..', 'src-tauri', 'gen', 'android');
const APP_DIR = path.join(GEN_ANDROID, 'app');

// ── 1. Copy google-services.json ────────────────────────────────────────────

const googleServicesSource =
  process.env.GOOGLE_SERVICES_JSON || path.resolve(__dirname, 'android', 'google-services.json');

const googleServicesDest = path.join(APP_DIR, 'google-services.json');

if (fs.existsSync(googleServicesSource)) {
  fs.copyFileSync(googleServicesSource, googleServicesDest);
  console.log('✓ Copied google-services.json to', googleServicesDest);
} else {
  console.warn(
    '⚠ google-services.json not found at',
    googleServicesSource,
    '\n  FCM will not work without it. Set GOOGLE_SERVICES_JSON env var or place it in scripts/android/',
  );
}

// ── 2. Add google-services plugin to project-level build.gradle.kts ─────────

const projectGradlePath = path.join(GEN_ANDROID, 'build.gradle.kts');
if (fs.existsSync(projectGradlePath)) {
  let projectGradle = fs.readFileSync(projectGradlePath, 'utf8');

  if (!projectGradle.includes('google-services')) {
    // Add to plugins block
    projectGradle = projectGradle.replace(
      /plugins\s*\{/,
      `plugins {\n    id("com.google.gms.google-services") version "4.4.2" apply false`,
    );
    fs.writeFileSync(projectGradlePath, projectGradle);
    console.log('✓ Added google-services plugin to project build.gradle.kts');
  }
}

// ── 3. Add Firebase dependencies to app-level build.gradle.kts ──────────────

const appGradlePath = path.join(APP_DIR, 'build.gradle.kts');
if (fs.existsSync(appGradlePath)) {
  let appGradle = fs.readFileSync(appGradlePath, 'utf8');

  // Apply google-services plugin
  if (!appGradle.includes('com.google.gms.google-services')) {
    appGradle = appGradle.replace(
      /plugins\s*\{/,
      `plugins {\n    id("com.google.gms.google-services")`,
    );
  }

  // Add Firebase BOM and messaging dependency
  if (!appGradle.includes('firebase-messaging')) {
    appGradle = appGradle.replace(
      /dependencies\s*\{/,
      `dependencies {\n    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))\n    implementation("com.google.firebase:firebase-messaging")`,
    );
  }

  fs.writeFileSync(appGradlePath, appGradle);
  console.log('✓ Added Firebase dependencies to app build.gradle.kts');
}

// ── 4. Add permissions and service to AndroidManifest.xml ───────────────────

const manifestPath = path.join(APP_DIR, 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  // Add POST_NOTIFICATIONS permission (Android 13+)
  if (!manifest.includes('POST_NOTIFICATIONS')) {
    manifest = manifest.replace(
      /<manifest/,
      `<manifest\n    xmlns:tools="http://schemas.android.com/tools"`,
    );
    manifest = manifest.replace(
      /<application/,
      `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n\n    <application`,
    );
  }

  // The tauri-plugin-remote-push handles the FirebaseMessagingService registration
  // automatically via its own AndroidManifest merge, so we don't need to add it manually.

  fs.writeFileSync(manifestPath, manifest);
  console.log('✓ Updated AndroidManifest.xml with notification permissions');
}

console.log('\n✅ Android FCM injection complete');
