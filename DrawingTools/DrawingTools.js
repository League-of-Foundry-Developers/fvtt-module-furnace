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
      drawingsButton.tools = [{
          name: "select",
          title: "Select Drawings",
          icon: "fas fa-expand"
        },
        {
          name: "rectangle",
          title: "Draw Rectangle",
          icon: "fas fa-square",
          onClick: () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.RECTANGLE
        },
        {
          name: "ellipse",
          title: "Draw Ellipse",
          icon: "fas fa-circle",
          onClick: () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.ELLIPSE
        },
        {
          name: "polygon",
          title: "Draw Polygons",
          icon: "fas fa-draw-polygon",
          onClick: () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.POLYGON
        },
        {
          name: "freehand",
          title: "Draw Freehand",
          icon: "fas fa-signature",
          onClick: () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.FREEHAND
        },
        {
          name: "text",
          title: "Draw Text",
          icon: "fas fa-font",
          onClick: () => canvas.drawings._last_tool = CONST.DRAWING_TYPES.TEXT
        },
        {
          name: "clear",
          title: "Clear all Drawings",
          icon: "fas fa-trash",
          onClick: () => {
            canvas.drawings.deleteAll();
            ui.controls.control.activeTool = "select";
            ui.controls.render();
          }
        },
        {
          name: "configure",
          title: "Set Drawing Defaults",
          icon: "fas fa-cog",
          onClick: () => {
            canvas.drawings.configureStartingData();
            ui.controls.control.activeTool = "select";
            ui.controls.render();
          }
        }
      ]
    }
  }
}

Hooks.on('init', FurnaceDrawingTools.init)
Hooks.on('getSceneControlButtons', FurnaceDrawingTools.getSceneControlButtons)