# Parley for iPhone (App Store)

This folder is the native iOS app. It wraps the web app in `../parley` with
[Capacitor](https://capacitorjs.com), so the website and the iPhone app share
one codebase. You don't need a Mac: GitHub builds, signs and uploads the app
for you on its free macOS machines.

```
capacitor.config.json   app id (io.github.remtron970.parley) and name
ios/App/                the Xcode project (iOS 26+, iPhone only)
scripts/copy-web.mjs    copies ../parley into www/ before each build
ExportOptions.plist     tells Xcode to upload to App Store Connect
store/                  listing text, screenshots (6.9"), privacy answers, review notes
../../.github/workflows/ios.yml   build check + upload job
```

## What you need to do (only the Apple account holder can do these)

### 1. Join the Apple Developer Program
Go to <https://developer.apple.com/programs/enroll/>. It costs $99 a year.
Approval usually takes from a few hours to two days.

### 2. Create the app in App Store Connect
Open <https://appstoreconnect.apple.com>, then **Apps**, then **+** and **New App**:
- Platform: iOS. Name: **Parley: Private AI Chat**. If that name is taken, try
  something like "Parley AI: On-Device Chat".
- Bundle ID: register **io.github.remtron970.parley** first under
  Certificates, Identifiers & Profiles, then Identifiers, then **+** and App IDs.
- SKU: `parley-ios`.

### 3. Make an API key so GitHub can sign and upload
In App Store Connect, open **Users and Access**, then **Integrations**, then
**App Store Connect API**, then **+**.
Give it the **Admin** role, which cloud signing needs. Download the `.p8` file (you
can only download it once) and note the **Key ID** and **Issuer ID**. Your
**Team ID** is at <https://developer.apple.com/account> under Membership.

### 4. Add four secrets on GitHub
Go to Repo, **Settings**, then **Secrets and variables**, then **Actions**, then **New repository secret**:

| Name | Value |
| --- | --- |
| `APP_STORE_CONNECT_KEY_ID` | Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_KEY` | the whole text of the `.p8` file, including the BEGIN/END lines |
| `APPLE_TEAM_ID` | your 10-character Team ID |

This repo is a fork, so Actions is off by default. Turn it on in the **Actions** tab.

### 5. Build and upload
Merge this branch into `main`. Then, in the **Actions** tab, open **iOS app**, then **Run
workflow**. You can also push a tag like `ios-v1.0.0`. About 10–15 minutes later the build
appears in App Store Connect under **TestFlight**.

### 6. Test on your iPhone (strongly recommended)
Install **TestFlight** from the App Store, add yourself as an internal tester,
and try the app. Check that the model downloads, answers stream in, and it still
works in Airplane Mode after the download.

### 7. Fill in the listing and submit
Copy everything from `store/`:
- `listing.json`: name, subtitle, promotional text, description, keywords
- `screenshots/`: drag the four PNGs into the **6.9" iPhone** slot
- `app-privacy.md`: App Privacy answers, privacy policy URL, age rating, category
- `review-notes.md`: paste into App Review Information, then Notes

Pick the build, then **Add for Review**, then **Submit**. Review usually takes 1–3 days.

## Building on a Mac yourself (optional)

```bash
cd apps/parley-ios
npm ci
npm run sync      # copies ../parley into the iOS project
npm run open      # opens Xcode; pick your team under Signing, then Product → Archive
```

Whenever you change the web app, run `npm run sync` again. CI does this for you.

## Things to know before submitting

- **iOS 26 or later only.** The AI runs on WebGPU, which iPhones get in iOS 26.
  Phones with less memory (6 GB RAM or less) do best with the smaller models,
  so the app only offers models up to about 1.4 GB.
- **Review risk: guideline 2.5.2.** At launch the app downloads the WebLLM engine
  script and the model's compute kernels from public CDNs. Apple restricts apps
  that download executable code. Many on-device AI apps download model weights,
  which are data, but the engine script and kernels are code. If Apple rejects the
  app for this, the fix is to ship those files inside the app bundle, so that only
  weights are downloaded.
- **Review risk: guideline 4.2 (minimum functionality).** Apple sometimes rejects
  apps that are "just a website". Parley runs a full AI model on the device and works
  offline, which helps. Say so in the review notes, as `store/review-notes.md` does.
- **Screenshots** show the real app UI with sample conversations that were written
  for the listing. If you prefer, replace them with screenshots from your own
  iPhone (6.9" sizes: iPhone 16/17 Pro Max).
- **Name and trademark.** Search the App Store and USPTO for "Parley" before you
  submit. Apple rejects names that are already in use.
