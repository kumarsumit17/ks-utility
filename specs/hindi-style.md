---
type: Policy
title: Hindi style guide
description: How every KS-Suite app writes Hindi interface text, with the term list and the alternatives that are not used.
tags: [hindi, language, style, terms]
---

# Hindi style guide

Every KS-Suite app offers English and Hindi ([Languages](languages.md)). This guide applies to every Hindi string, shared or app-specific.

## Style
- Natural app Hindi with familiar Devanagari transliterations. No stiff or Sanskritised words.
- Polite, clear action verbs: चुनें, दर्ज करें, आगे बढ़ें.
- Button and tab text is brief, so it fits compact interface slots.
- Latin digits (0-9) and symbols (₹, %) stay as they are. Devanagari digits are never used.
- One term per concept, everywhere, in every app.
- Spell consistently with the term list: फ़ाइल, फ़ोल्डर, हटाएं, खोलें (with the nukta, and with the anusvara in हटाएं).
- **One exception to the anusvara spelling:** "Yes" is हाँ, with the chandrabindu (owner, final Hindi review). It applies to this word only: हटाएं, यहां, वहां and the rest keep the anusvara. The check matches whole words, so the avoided हां never matches inside यहां.
- **Remove** (हटाएं) takes something out of a list; **Delete** (डिलीट करें) deletes it permanently. A button that deletes from disk but is labelled Remove says so in its confirmation (डिलीट हो जाएंगे).
- A term not in the list: choose one in the same style, add it to the table below **and** to `lang/hindi-terms.json`, and mark it **owner review** until the owner approves it.

## Term list

The data file `lang/hindi-terms.json` holds the same rows; a test fails if this table and the file differ. The language-file check ([usage](usage.md#language-files)) fails when a Hindi string uses a word from the **Avoid** column (matched as whole words, so प्रगति does not match गति).

| English | Hindi | Avoid | Status |
|---|---|---|---|
| Settings | सेटिंग्स | समायोजन | approved |
| Account | अकाउंट | — | approved |
| Profile | प्रोफ़ाइल | प्रोफाइल | approved |
| Backup | बैकअप | — | approved |
| Restore | रीस्टोर | पुनर्स्थापित करें | approved |
| Update | अपडेट | अद्यतन | approved |
| Download | डाउनलोड | — | approved |
| Upload | अपलोड | — | approved |
| Login | लॉगिन | — | approved |
| Sign out | लॉग आउट | — | approved |
| Password | पासवर्ड | कूटशब्द | approved |
| OTP | ओटीपी | — | approved |
| Search | खोजें | सर्च करें | approved |
| Save | सेव करें | सहेजें | approved |
| Cancel | रद्द करें | कैंसल, कैंसिल | approved |
| Remove (from a list) | हटाएं | हटाएँ | approved |
| Delete (permanently) | डिलीट करें | मिटाएं, मिटाएँ | approved |
| Retry | फिर से कोशिश करें | पुनः प्रयास करें | approved |
| Loading... | लोड हो रहा है... | — | approved |
| Network | नेटवर्क | — | approved |
| Offline | ऑफ़लाइन | ऑफलाइन | approved |
| Sync | सिंक करें | — | approved |
| Subtitles | सबटाइटल | उपशीर्षक | approved |
| Audio | ऑडियो | — | approved |
| Playback Speed | प्लेबैक स्पीड | — | approved |
| Pause | रोकें | पॉज़ करें | approved |
| Resume | फिर शुरू करें | — | approved |
| Open | खोलें | — | approved |
| Open folder | फ़ोल्डर खोलें | — | approved |
| File | फ़ाइल | फाइल | approved |
| Folder | फ़ोल्डर | फोल्डर | approved |
| Link | लिंक | — | approved |
| Paste | पेस्ट करें | चिपकाएं | approved |
| Queue | क्यू | कतार | approved |
| Speed | स्पीड | गति | approved |
| Time left | बचा समय | शेष समय | approved |
| Finished | पूरा हुआ | — | approved |
| Failed | नहीं हो पाया | विफल | approved |
| Video | वीडियो | — | approved |
| Images | इमेज | छवियां, छवियाँ | approved |
| Category | कैटेगरी | श्रेणी | approved |
| OK | ठीक है | — | approved |
| Close | बंद करें | — | approved |
| Rename | नाम बदलें | — | approved |
| Add | जोड़ें | — | approved |
| Choose | चुनें | — | approved |
| Copy | कॉपी करें | — | approved |
| Yes | हाँ | हां | approved |
| No | नहीं | — | approved |
| Back | वापस | — | approved |
| Next | आगे बढ़ें | — | approved |
| Done | हो गया | — | approved |
| Unknown | पता नहीं | अज्ञात | approved |
| Error | गड़बड़ी | त्रुटि | approved |
| Language | भाषा | — | approved |
| System | सिस्टम | — | approved |
| Waiting | इंतज़ार में | — | approved |
| Limit | लिमिट | — | approved |
| Main queue | मुख्य क्यू | — | approved |
| Connection | कनेक्शन | — | approved |
| Other | अन्य | — | approved |
| Prefer MP4 | MP4 को पहले चुनें | — | approved |
| Video component | वीडियो कंपोनेंट | — | approved |
| Leftover download files | बची हुई डाउनलोड फ़ाइलें | — | approved |
| Queued | क्यू में | — | approved |
| Paused | रुका हुआ | — | approved |
| Interrupted | बीच में रुका | — | approved |
| Unfinished | अधूरे | — | approved |
| Size | साइज़ | आकार | approved |
| Status | स्टेटस | स्थिति | approved |
| Progress | प्रोग्रेस | प्रगति | approved |
| Problem | दिक्कत | समस्या | approved |
| Filter | फ़िल्टर | फिल्टर | approved |
| Date added | जोड़ने की तारीख | दिनांक | approved |
| Temporary folder | टेंप फ़ोल्डर | अस्थायी | approved |
| Server | सर्वर | — | approved |
| Checksum | चेकसम | — | approved |
| Version | वर्ज़न | संस्करण | approved |
| Quality | क्वालिटी | गुणवत्ता | approved |
| Sign-in (as a requirement) | लॉगिन | साइन इन | approved |
| Permission | इजाज़त | अनुमति | approved |
| Available | उपलब्ध | — | approved |
| Playlist | प्लेलिस्ट | सूची | approved |
| Thumbnail | थंबनेल | लघुचित्र | approved |
| Select all | सभी चुनें | — | approved |
| Hide | छिपाएं | छिपाएँ | approved |
| Show | दिखाएं | दिखाएँ | approved |
| App | ऐप | एप | owner review |
| Install | इंस्टॉल करें | स्थापित | owner review |
| Installer | इंस्टॉलर | — | owner review |
| Check (for updates) | जांच करें | जाँच | owner review |
| Disk image | डिस्क इमेज | — | owner review |
| Unknown apps (Android) | अनजान ऐप | अज्ञात | owner review |
| Expense | खर्च | — | owner review |
| Amount | रकम | राशि | owner review |
| Note | नोट | टिप्पणी | owner review |
| Date | तारीख | दिनांक | owner review |
| Export | एक्सपोर्ट | निर्यात | owner review |
| Spreadsheet | स्प्रेडशीट | — | owner review |
| Food | खाना | भोजन | owner review |
| Transport | ट्रांसपोर्ट | यातायात | owner review |
| Shopping | शॉपिंग | खरीदारी | owner review |
| Bills | बिल | — | owner review |
| Health | सेहत | स्वास्थ्य | owner review |
| Entertainment | मनोरंजन | — | owner review |
| Hidden | छिपी हुई | — | owner review |
| Vault | वॉल्ट | — | owner review |
| Pattern | पैटर्न | — | owner review |
| Lock | लॉक | — | owner review |
| Unlock | अनलॉक करें | — | owner review |
| Title | शीर्षक | — | owner review |
| Encrypt | एन्क्रिप्ट | — | owner review |
| Dot | बिंदु | — | owner review |
