const FURNACE_DRAWING_FILL_TYPE = {
  NONE: 0,
  SOLID: 1,
  PATTERN: 2,
  STRETCH: 3,
  CONTOUR: 4,
  FRAME: 5
}

CONFIG.furnaceDrawingFillTypes = {
  [FURNACE_DRAWING_FILL_TYPE.NONE]: "None",
  [FURNACE_DRAWING_FILL_TYPE.SOLID]: "Solid Color",
  [FURNACE_DRAWING_FILL_TYPE.PATTERN]: "Tiled Pattern",
  [FURNACE_DRAWING_FILL_TYPE.STRETCH]: "Stretched Texture",
  [FURNACE_DRAWING_FILL_TYPE.CONTOUR]: "Tiled Contour",
  [FURNACE_DRAWING_FILL_TYPE.FRAME]: "Stretched Contour"
}

CONFIG.furnaceDrawingTypes = {
  [CONST.DRAWING_TYPES.RECTANGLE]: "Rectangle",
  [CONST.DRAWING_TYPES.ELLIPSE]: "Ellipse",
  [CONST.DRAWING_TYPES.TEXT]: "Text",
  [CONST.DRAWING_TYPES.POLYGON]: "Polygon",
  [CONST.DRAWING_TYPES.FREEHAND]: "Freehand"
}


CONFIG.WebSafeFonts = {
  "Arial": "Arial, Helvetica, sans-serif",
  "Arial Black": '"Arial Black", Gadget, sans-serif',
  "Times New Roman": '"Times New Roman", Times, serif',
  "Comic Sans MS": '"Commic Sans MS", cursive, sans-serif',
  "Courier New": '"Courier New", Courier, monospace',
  // FIXME: There are more, but do we want to show all of the available options??
}

class FurnaceDrawingTools {

  static init() {
    // Register module configuration settings
    game.settings.register("furnace", "enableDrawingTools", {
      name: "Advanced Drawing Tools",
      hint: "Replaces the core drawing tools with the Furnace's drawing tools, which provides more advanced features, such as tiled/stretched textures and live preview of config changes (Requires reload).",
      scope: "world",
      config: true,
      default: true,
      type: Boolean,
      onChange: value => window.location.reload()
    })
    game.settings.register("furnace", "freehandSampleRate", {
      name: "Freehand Sample Rate",
      hint: "The sample rate in millisecond for the smoothing of Freehand drawings. Lower value means more accurate drawings but less smooth and containing more points",
      scope: "core",
      config: true,
      choices: { 25: "25 ms", 50: "50 ms", 75: "75 ms", 100: "100 ms" },
      default: 50,
      type: Number,
      onChange: value => {
        Drawing.FREEHAND_SAMPLE_RATE = value
      }
    })
    game.settings.register("furnace", FurnaceDrawingsLayer.DEFAULT_CONFIG_SETTING, {
      name: "Default Drawing Configuration",
      scope: "client",
      config: false,
      default: {},
      type: Object,
    })
    if (game.settings.get("furnace", "enableDrawingTools")) {
      Drawing = FurnaceDrawing;
      DrawingsLayer = FurnaceDrawingsLayer;
      DrawingHUD = FurnaceDrawingHUD;
      DrawingConfig = FurnaceDrawingConfig;
    }
    Drawing.FREEHAND_SAMPLE_RATE = game.settings.get("furnace", "freehandSampleRate");
  }
  static getSceneControlButtons(buttons) {
    if (!game.settings.get("furnace", "enableDrawingTools")) return;

    let drawingsButton = buttons.find(b => b.name == "drawings")
    // Replace the drawings scene controls with our own
    if (drawingsButton) {
        // Replace the tools we want modified
        drawingsButton.tools[1].name  = "rectangle";
        drawingsButton.tools[1].onClick = () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.RECTANGLE;
        drawingsButton.tools[2].onClick = () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.ELLIPSE;
        drawingsButton.tools[3].onClick = () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.POLYGON;
        drawingsButton.tools[4].onClick = () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.FREEHAND;
        drawingsButton.tools[5].onClick = () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.TEXT;
        drawingsButton.tools[6].onClick = () => {
            canvas.drawings.configureStartingData();
            ui.controls.control.activeTool = "select";
            ui.controls.render();
        };
    }
  }
}

Hooks.on('init', FurnaceDrawingTools.init)
Hooks.on('getSceneControlButtons', FurnaceDrawingTools.getSceneControlButtons)