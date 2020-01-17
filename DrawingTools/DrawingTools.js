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
  static async ready() {
    // Only migrate drawings if we're a GM
    if (game.user.isGM) {
      for (let scene of game.scenes.entities) {
        let drawings = scene.getFlag("furnace", "drawings")
        if (drawings !== undefined)
          await FurnaceDrawingTools.migrateDrawingsToCore(scene, drawings)
      }
    }
  }

  static migrateDrawingsToCore(scene, drawings) {
    const default_data = {
      bezierFactor: 0.1,
      fillType: 0,
      flags: {},
      fontFamily: "Signika",
      fontSize: 48,
      hidden: false,
      locked: false,
      points: [],
      rotation: 0,
      strokeWidth: 0,
      textAlpha: 1,
      textColor: "#FFFFFF",
      z: 0
    }
    let new_drawings = []

    for (let drawing of drawings) {
      let data = duplicate(drawing);
      data.flags = {
        furnace: {
          textureWidth: data.textureWidth,
          textureHeight: data.textureHeight,
          textureAlpha: data.textureAlpha,
          fillType: data.fill
        }
      }
      data.author = data.owner
      if (Object.values(CONST.DRAWING_FILL_TYPES).includes(data.fill))
        data.fillType = data.fill;
      else
        data.fillType = CONST.DRAWING_FILL_TYPES.PATTERN;

      if (data.fontSize == "")
        data.fontSize = 48;
      delete data.owner
      delete data.fill
      delete data.id
      delete data.textureWidth
      delete data.textureHeight
      delete data.textureAlpha
      mergeObject(data, default_data, { overwrite: false, })

      data.type = data.type[0]
      if (drawing.type == "text") {
        data.text = data.content
        data.textColor = data.fillColor
        data.textAlpha = data.strokeAlpha
        data.fillType = FURNACE_DRAWING_FILL_TYPE.NONE
        data.flags.furnace.fillType = FURNACE_DRAWING_FILL_TYPE.NONE
        delete data.content
      } else {
        if (data.points.length > 0) {
          // Data is already using the shifted x/y so we use _adjustPoints only to adjust 
          // the actual points, not the x/y/width/height
          let { points, width, height } = Drawing._adjustPoints(0, 0, data.points)
          mergeObject(data, { points })
          if ((drawing.type == "polygon" || drawing.type == "freehand") && (width * height != 0)) {
            let scaleX = drawing.width / width
            let scaleY = drawing.height / height
            if (scaleX != 1 || scaleY != 1)
              data.points = data.points.map(p => [p[0] * scaleX, p[1] * scaleY]);
          }
        }
      }

      data._id = randomId(16)
      new_drawings.push(data)
    }
    
    let final_drawings = scene.data.drawings.concat(new_drawings)

    FurnaceDebug.log("Migrating scene : ", scene, " with new drawings: ", final_drawings)
    return scene.update({ "flags.furnace.-=drawings": null, "drawings": final_drawings })
  }
}

Hooks.on('init', FurnaceDrawingTools.init)
Hooks.on('getSceneControlButtons', FurnaceDrawingTools.getSceneControlButtons)
Hooks.on('ready', FurnaceDrawingTools.ready)