const FURNACE_DRAWING_FILL_TYPE = {
  NONE: 0,
  SOLID: 1,
  PATTERN: 2,
  STRETCH: 3,
  CONTOUR: 4,
  FRAME: 5
}

CONFIG.furnaceDrawingFillTypes = {
  0: "None",
  1: "Solid Color",
  2: "Tiled Pattern",
  3: "Stretched Texture",
  4: "Tiled Contour",
  5: "Stretched Contour"
}

CONFIG.furnaceDrawingTypes = {
  [DRAWING_TYPES.RECTANGLE]: "Rectangle",
  [DRAWING_TYPES.ELLIPSE]: "Ellipse",
  [DRAWING_TYPES.TEXT]: "Text",
  [DRAWING_TYPES.POLYGON]: "Polygon",
  [DRAWING_TYPES.FREEHAND]: "Freehand"
}


CONFIG.WebSafeFonts = {
  "Arial": "Arial, Helvetica, sans-serif",
  "Arial Black": '"Arial Black", Gadget, sans-serif',
  "Times New Roman": '"Times New Roman", Times, serif',
  "Comic Sans MS": '"Commic Sans MS", cursive, sans-serif',
  "Courier New": '"Courier New", Courier, monospace',
  // FIXME: There are more, but do we want to show all of the available options??
}
CONFIG.FREEHAND_SAMPLING_RATE = 50;

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
  }
  static async ready() {
    for (let scene of game.scenes.entities) {
      let drawings = scene.getFlag("furnace", "drawings")
      if (drawings !== undefined)
        await FurnaceDrawingTools.migrateDrawingsToCore(scene, drawings)
    }
    let hooks = ['hover', 'control', 'create', 'preCreate', 'create', 'preUpdate', 'update', 'preDelete', 'delete']
    for (let hook of hooks) {
      Hooks.on(hook + 'FurnaceDrawing', function () {
        if (hook.startsWith("pre"))
          return Hooks.call(hook + 'Drawing', ...arguments)
        else
          return Hooks.callAll(hook + 'Drawing', ...arguments)
      });
    }
  }
  static canvasInit(canvas) {
    if (!game.settings.get("furnace", "enableDrawingTools")) return;
    if (!(canvas.drawings instanceof FurnaceDrawingsLayer)) {
      canvas.hud.drawing = new FurnaceDrawingHUD()
      let gridIdx = canvas.stage.children.indexOf(canvas.drawings)
      canvas.stage.removeChild(canvas.drawings)
      canvas.drawings = canvas.stage.addChildAt(new FurnaceDrawingsLayer(), gridIdx)
      canvas.drawings.draw()
    }
  }
  
  static renderSceneControls(obj, html, data) {
    if (!game.settings.get("furnace", "enableDrawingTools")) return;
    if (obj.controls.drawings.furnace != true) {
      // Replace the drawings scene controls with our own
      obj.controls["drawings"] = {
        furnace: true,
        name: "Drawing Tools",
        layer: "FurnaceDrawingsLayer",
        icon: "fas fa-pencil-alt",
        visible: game.user.isTrusted,
        tools: {
          select: {
            name: "Select Drawings",
            icon: "fas fa-expand"
          },
          rectangle: {
            name: "Draw Rectangle",
            icon: "fas fa-square"
          },
          ellipse: {
            name: "Draw Ellipse",
            icon: "fas fa-circle"
          },
          polygon: {
            name: "Draw Polygons",
            icon: "fas fa-draw-polygon"
          },
          freehand: {
            name: "Draw Freehand",
            icon: "fas fa-signature"
          },
          text: {
            name: "Draw Text",
            icon: "fas fa-font"
          },
          clear: {
            name: "Clear all Drawings",
            icon: "fas fa-trash",
            onClick: () => {
              canvas.drawings.deleteAll();
              ui.controls.controls[ui.controls.activeControl].activeTool = "select";
              ui.controls.render();
            }
          },
          configure: {
            name: "Set Drawing Defaults",
            icon: "fas fa-cog",
            onClick: () => {
              canvas.drawings.configureStartingData();
              ui.controls.controls[ui.controls.activeControl].activeTool = "select";
              ui.controls.render();
            }
          }
        },
        activeTool: "select"
      }
      obj.render();
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
    let max_id = scene.data.drawings.reduce((a, v) => { return { id: Math.max(a.id, v.id) } }).id
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
      if (Object.values(DRAWING_FILL_TYPES).includes(data.fill))
        data.fillType = data.fill;
      else
        data.fillType = DRAWING_FILL_TYPES.NONE;
        
      if (data.fontSize == "")
        data.fontSize = 48;
      delete data.owner
      delete data.fill
      delete data.id
      delete data.textureWidth
      delete data.textureHeight
      delete data.textureAlpha
      mergeObject(data, default_data, { overwrite: false,  })
      
      if (drawing.type == "text") {
        data.type = "r"
        data.text = data.content
        data.textColor = data.fillColor
        data.textAlpha = data.strokeAlpha
        data.strokeWidth = 0
        data.fillType = FURNACE_DRAWING_FILL_TYPE.NONE
        delete data.content
      } else {
        data.type = data.type[0]
        if (data.points.length > 0) {
          mergeObject(data, Drawing._adjustPoints(0, 0, data.points))
        }
      }

      max_id += 1
      data.id = max_id
      if ((drawing.type == "polygon" || drawing.type == "freehand") && (data.width * data.height != 0)) {
        let scaleX = drawing.width / data.width
        let scaleY = drawing.height / data.height
        if (scaleX != 1 || scaleY != 1) {
          // TODO: Don't change point data. Just change width/height and scale dynamically.
          data.points = data.points.map(p => [Math.round(p[0] * scaleX), Math.round(p[1] * scaleY)]);
        }
      }
      new_drawings.push(data)
    }
    let flags = scene.data.flags.furnace || {}
    delete flags.drawings
    let final_drawings = duplicate(scene.data.drawings).concat(new_drawings)
    console.log("Migrating scene : ", scene, " with new data ", { "flags.furnace": flags, "drawings": final_drawings})
    //return scene.update({ "flags.furnace": flags, "drawings": final_drawings})
    return new Promise(r => r())
  }
  
  static DrawingDefaultData(type = "all") {
    return {
      // Special 'all' type which contains default values common to all types
      all: {
        id: 1,
        x: 0,
        y: 0,
        z: 0,
        width: 0,
        height: 0,
        author: null,
        hidden: false,
        locked: false,
        flags: {
          furnace: {
            textureWidth: 0,
            textureHeight: 0,
            textureAlpha: 1
          }
        },
        rotation: 0,
        fillType: FURNACE_DRAWING_FILL_TYPE.NONE,
        fillColor: "#ffffff",
        fillAlpha: 1.0,
        strokeColor: "#000000",
        strokeAlpha: 1.0,
        texture: null,
        fontFamily: "Arial",
        fontSize: 25,
        text: "",
        textAlpha: 1,
        textColor: "#FFFFFF",
        bezierFactor: 0
      },
      [DRAWING_TYPES.RECTANGLE]: {
        strokeWidth: 5,
      },
      [DRAWING_TYPES.ELLIPSE]: {
        strokeWidth: 5,
      },
      [DRAWING_TYPES.TEXT]: {
        // FIXME: Text should be Rectangle or add native text support in core
        fillType: FURNACE_DRAWING_FILL_TYPE.SOLID,
        strokeWidth: 2,
        content: "",
        fontFamily: "Arial",
        fontSize: 25,
        wordWrap: false
      },
      [DRAWING_TYPES.POLYGON]: {
        strokeWidth: 3,
        points: [],
        bezierFactor: 0
      },
      [DRAWING_TYPES.FREEHAND]: {
        strokeWidth: 3,
        points: [],
        bezierFactor: 0.5,
      }
    }[type]
  }
}

Hooks.on('canvasInit', FurnaceDrawingTools.canvasInit);
Hooks.on('renderSceneControls', FurnaceDrawingTools.renderSceneControls);
Hooks.on('init', FurnaceDrawingTools.init)
Hooks.on('ready', FurnaceDrawingTools.ready)