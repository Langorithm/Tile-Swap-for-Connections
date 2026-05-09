# Tile Swap for Connections

A Chrome extension that lets you drag and drop tiles to reorder them in [NYT Connections](https://www.nytimes.com/games/connections).

![Tile Swap logo](https://github.com/Langorithm/Tile-Swap-for-Connections/blob/main/publish/icon.png?raw=true)

## What it does

NYT Connections shows your 16 tiles in a fixed order. This extension makes every tile draggable so you can group related words together before you commit to an answer — without affecting how the game itself works.

- Drag any tile and drop it onto another to swap their positions
- Your custom order survives category solves (solved tiles disappear, the rest stay put)
- The built-in **Shuffle** button still works and resets your arrangement
- Smooth FLIP animation plays on every swap

## Installation

### From the Chrome Web Store

*(Coming soon — submission in progress)*

### Load unpacked (developer mode)

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the `plugin/` folder

## How it works

The extension injects a content script (`plugin/content.js`) into `nytimes.com/games/connections*`. It:

1. Uses a `MutationObserver` to detect when Connections renders or updates tiles
2. Attaches HTML5 drag-and-drop event listeners to each tile
3. Swaps tiles by changing CSS `order` values (never touching the React DOM), so the game's state is completely unaffected
4. Re-applies your ordering after each category solve, and resets it when you click Shuffle

## Project structure

```
src/             Chrome extension source
  manifest.json
  content.js
  content.css
publish/         Icons and Chrome Web Store submission guide
webpage/         Promotional page
```


## License

MIT
