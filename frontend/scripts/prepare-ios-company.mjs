import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(frontend, "ios")
const companyAssets = join(frontend, "company-ios-assets")
const approvedIcon = join(frontend, "public/branding/social-profile-1024.png")
const sourceConfig = JSON.parse(readFileSync(join(source, "App/App/capacitor.config.json"), "utf8"))

if (sourceConfig.appId !== "com.shelfpick.prototype" || sourceConfig.appName !== "ShelfPick Prototype") {
  throw new Error("The source iOS project is no longer the expected Personal Team prototype")
}
if (sourceConfig.ios?.zoomEnabled !== true) {
  throw new Error("Build and sync the iOS assets with pinch zoom enabled first: npm run build:ios")
}

const stage = mkdtempSync(join(tmpdir(), "shelfpick-company-ios-"))
const stagedIos = join(stage, "ios")
cpSync(source, stagedIos, { recursive: true })
// Capacitor's local Swift package paths resolve from the staged project.
symlinkSync(join(frontend, "node_modules"), join(stage, "node_modules"), "dir")

const companyConfig = {
  ...sourceConfig,
  appId: "com.plutonightlabs.shelfpick",
  appName: "ShelfPick",
}
writeFileSync(join(stagedIos, "App/App/capacitor.config.json"), `${JSON.stringify(companyConfig, null, 2)}\n`)

// Keep the prototype project intact. Give the staged Xcode target the
// approved company identity for both Debug and Release configurations.
const projectPath = join(stagedIos, "App/App.xcodeproj/project.pbxproj")
let project = readFileSync(projectPath, "utf8")
function replaceExpected(before, after, count) {
  const found = project.split(before).length - 1
  if (found !== count) throw new Error(`Unexpected Xcode project layout for ${before}: ${found}`)
  project = project.replaceAll(before, after)
}
replaceExpected("PRODUCT_BUNDLE_IDENTIFIER = com.shelfpick.prototype;", "PRODUCT_BUNDLE_IDENTIFIER = com.plutonightlabs.shelfpick;", 2)
replaceExpected('TARGETED_DEVICE_FAMILY = "1,2";', "TARGETED_DEVICE_FAMILY = 1;", 2)
replaceExpected("INFOPLIST_FILE = App/Info.plist;", "INFOPLIST_FILE = App/Info-Company.plist;", 2)
replaceExpected('DEVELOPMENT_TEAM = "";', "DEVELOPMENT_TEAM = 9CDNVY8UKQ;", 1)
replaceExpected("CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tINFOPLIST_FILE = App/Info-Company.plist;", "CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tDEVELOPMENT_TEAM = 9CDNVY8UKQ;\n\t\t\t\tINFOPLIST_FILE = App/Info-Company.plist;", 1)
writeFileSync(projectPath, project)

// Only the staged company candidate receives the approved ShelfPick artwork.
const catalog = join(stagedIos, "App/App/Assets.xcassets")
cpSync(approvedIcon, join(catalog, "AppIcon.appiconset/AppIcon-512@2x.png"))
rmSync(join(catalog, "Splash.imageset"), { recursive: true })
const launchImageSet = join(catalog, "ShelfPickLaunch.imageset")
mkdirSync(launchImageSet)
cpSync(approvedIcon, join(launchImageSet, "ShelfPickLaunch.png"))
writeFileSync(join(launchImageSet, "Contents.json"), `${JSON.stringify({
  images: [{ idiom: "universal", filename: "ShelfPickLaunch.png" }],
  info: { author: "xcode", version: 1 },
}, null, 2)}\n`)
cpSync(join(companyAssets, "LaunchBackground.colorset"), join(catalog, "LaunchBackground.colorset"), { recursive: true })
cpSync(join(companyAssets, "LaunchScreen.storyboard"), join(stagedIos, "App/App/Base.lproj/LaunchScreen.storyboard"))

console.log(stagedIos)
