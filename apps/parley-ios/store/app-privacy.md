# App Store Connect: App Privacy answers

- **Data collection:** The developer collects nothing. The optional Create tab
  sends the person's prompt and any photo they pick to fal.ai, a third-party
  service they connect with their own key. To be safe, declare in App Store Connect:
  **User Content → Photos or Videos** and **User Content → Other User Content**,
  used for **App Functionality**, **not linked** to identity, **not used for tracking**.
  The free FLUX model sends prompts to pollinations.ai in the same way, so the same
  "Other User Content" answer covers it.
  Optional accounts (username, display name, salted password hash), chats and settings are stored only on the device (WebView local storage and
  IndexedDB). Nothing is sent to the developer or any third party.
- **Network requests the app makes:** model files are downloaded from public CDNs
  (cdn.jsdelivr.net for the engine script; huggingface.co / raw.githubusercontent.com
  for model files). These are plain file downloads; no user content or identifiers
  are sent.
- **Tracking:** none. No App Tracking Transparency prompt is needed.
- **Privacy policy URL:** https://remtron970.github.io/replica-skill/privacy.html
- **Support URL:** https://github.com/Remtron970/replica-skill/issues

## Age rating questionnaire
Answer "None" to every content category. For "Unrestricted web access" answer No.
Apple's current questionnaire also asks about AI-generated content / chatbots:
answer Yes. Expect a rating of 13+ (or what the questionnaire assigns).

## Category
Primary: Productivity. Secondary: Utilities.

## Price
Free. No in-app purchases.
