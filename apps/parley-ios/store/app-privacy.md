# App Store Connect: App Privacy answers

- **Data collection:** "No, we do not collect data from this app."
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
