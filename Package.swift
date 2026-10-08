// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PHCPlanner",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "PHCKit", targets: ["PHCKit"]),
        .library(name: "PHCUI", targets: ["PHCUI"]),
    ],
    targets: [
        .target(name: "PHCKit", resources: [.process("Resources")]),
        .target(name: "PHCUI", dependencies: ["PHCKit"]),
        .testTarget(name: "PHCKitTests", dependencies: ["PHCKit"]),
    ]
)
