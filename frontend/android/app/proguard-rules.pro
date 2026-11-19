# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- The Pigsty ---
# Keep line numbers so Play and Sentry stack traces stay readable after R8
# renames everything. Costs nothing in obfuscation score.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# MainActivity is referenced from AndroidManifest, which R8 keeps automatically;
# Capacitor plugin classes are covered by the consumer rules in
# @capacitor/android and @capgo/capacitor-social-login.
