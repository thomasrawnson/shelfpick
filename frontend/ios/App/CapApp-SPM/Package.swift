// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.0"),
        .package(name: "AparajitaCapacitorSecureStorage", path: "../../../../../../../pluto-night-labs/apps/shelfpick/frontend/node_modules/@aparajita/capacitor-secure-storage"),
        .package(name: "CapacitorCommunityInAppReview", path: "../../../../../../../pluto-night-labs/apps/shelfpick/frontend/node_modules/@capacitor-community/in-app-review"),
        .package(name: "CapacitorHaptics", path: "../../../../../../../pluto-night-labs/apps/shelfpick/frontend/node_modules/@capacitor/haptics")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "AparajitaCapacitorSecureStorage", package: "AparajitaCapacitorSecureStorage"),
                .product(name: "CapacitorCommunityInAppReview", package: "CapacitorCommunityInAppReview"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics")
            ]
        )
    ]
)
