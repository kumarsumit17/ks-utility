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
| OK | ठीक है | — | owner review |
| Close | बंद करें | — | owner review |
| Rename | नाम बदलें | — | owner review |
| Add | जोड़ें | — | owner review |
| Choose | चुनें | — | owner review |
| Copy | कॉपी करें | — | owner review |
| Yes | हां | — | owner review |
| No | नहीं | — | owner review |
| Back | वापस | — | owner review |
| Next | आगे बढ़ें | — | owner review |
| Done | हो गया | — | owner review |
| Unknown | पता नहीं | अज्ञात | owner review |
| Error | गड़बड़ी | त्रुटि | owner review |
| Language | भाषा | — | owner review |
| System | सिस्टम | — | owner review |
| Waiting | इंतज़ार में | — | owner review |
| Limit | लिमिट | — | owner review |
| Main queue | मुख्य क्यू | — | owner review |
| Connection | कनेक्शन | — | owner review |
| Other | अन्य | — | owner review |
| Prefer MP4 | MP4 को पहले चुनें | — | owner review |
| Video component | वीडियो कंपोनेंट | — | owner review |
| Leftover download files | बची हुई डाउनलोड फ़ाइलें | — | owner review |
| Queued | क्यू में | — | owner review |
| Paused | रुका हुआ | — | owner review |
| Interrupted | बीच में रुका | — | owner review |
| Unfinished | अधूरे | — | owner review |
| Size | साइज़ | आकार | owner review |
| Status | स्थिति | — | owner review |
| Progress | प्रोग्रेस | प्रगति | owner review |
| Problem | दिक्कत | समस्या | owner review |
| Filter | फ़िल्टर | फिल्टर | owner review |
| Date added | जोड़ने की तारीख | दिनांक | owner review |
| Temporary folder | अस्थायी फ़ोल्डर | — | owner review |
| Server | सर्वर | — | owner review |
| Checksum | चेकसम | — | owner review |
| Version | वर्ज़न | संस्करण | owner review |
| Quality | क्वालिटी | गुणवत्ता | owner review |
| Sign-in (as a requirement) | लॉगिन | साइन इन | owner review |
| Permission | इजाज़त | अनुमति | owner review |
| Available | उपलब्ध | — | owner review |
