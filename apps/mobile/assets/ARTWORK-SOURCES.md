# StudyBuddy artwork

`study-background.png` reproduces the gradient and dotted CSS background already present in `web/styles.css` and `reference/screens/home.html` from `UI.html`.

`study-avatar.svg` and `icons/*.svg` preserve the original placeholder portrait and five navigation paths from `reference/screens/home.html`. The matching PNGs are deterministic browser rasterizations at 4× size for use by React Native without an additional SVG library. The background is exported at 2× size.

Regenerate with Chrome and the workspace dependencies installed:

```sh
node apps/mobile/assets/generate-study-art.mjs
```

Set `CHROME_PATH` when Chrome is not installed in its standard location. No generated artwork or external images are used.
