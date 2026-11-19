PWT Android APK (Capacitor) — কীভাবে বানাবেন
=============================================

১. GitHub-এ একটা নতুন repository বানান (যেমন: pwt-native)।
২. এই zip-এর সব ফাইল (লুকানো .github folder সহ) সেই repository-তে upload করুন, branch: main।
৩. GitHub-এ Actions tab → "Build Android APK" → Run workflow চাপুন। (main-এ push করলেও নিজে থেকে চলবে)
৪. ৫-১০ মিনিট পর সবুজ টিক এলে ওই run খুলুন → নিচে Artifacts → "PWT-apk" download করুন।
৫. zip খুলে app-debug.apk ফোনে পাঠিয়ে install করুন (Unknown sources allow করতে হবে)।

App প্রথমবার খুললে একসাথে চাইবে: Microphone, Notification, Bluetooth, আর Battery optimization ছাড়।
সবগুলোতে Allow দিন।

Web অংশ বদলালে (index.html, assets/ ইত্যাদি) আবার push করুন — নতুন APK তৈরি হবে।
