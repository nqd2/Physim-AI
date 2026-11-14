# StudyBuddy fonts

These unmodified static TTF files are bundled locally so Android, iOS and Web do not fetch fonts at runtime.

| File | Weight | Intended use |
| --- | --- | --- |
| `Fredoka_600SemiBold.ttf` | 600 | The original StudyBuddy Latin wordmark, numbers and supported display text. |
| `Nunito_400Regular.ttf` | 400 | Regular text where needed. |
| `Nunito_700Bold.ttf` | 700 | Supporting Vietnamese text. |
| `Nunito_800ExtraBold.ttf` | 800 | Main Vietnamese text and headings, matching the original interface's heavy rounded typography. |

Nunito covers all 134 checked precomposed Vietnamese letters and all eight required combining marks. The upstream Fredoka font lacks 102 of those Vietnamese letters and three combining marks; use Nunito for Vietnamese rather than relying on an unpredictable platform fallback. Normalizing text to decomposed Unicode does not fill those missing glyphs.

The files come from the official npm registry packages `@expo-google-fonts/fredoka` 0.4.1 and `@expo-google-fonts/nunito` 0.4.2. Package SHA-512 integrity was checked before extraction. `provenance.json` records package URLs, upstream paths and SHA-256 values; `verification.json` records static-font, weight and character-coverage checks.

Keep `FREDOKA-OFL.txt` and `NUNITO-OFL.txt` with redistributed fonts. These contain the upstream SIL Open Font License and copyright notices.
