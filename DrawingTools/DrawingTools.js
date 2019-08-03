/**
 * Hey Atropos!
 *
 * This is the main file which has the stuff that doesn't get copied 'mostly as is'.
 * the biggest part being the FakeServer class which just sort of emulates the server
 *  side of things as I replaced the call to SocketInterface.trigger by FakeServer.trigger
 * in the DrawingsLayer class.
 * It was done this way to minimize the impact on the code for the rest of the 
 * implementation and make it easier to integrate into core.
 * I'm sure you know better on how the server side needs to be done, so I won't
 * say any more on that.
 * There are a couple of hooks here, I'm sure you'll know where to place the code from
 * there into the appropriate places inside the core, and some new config/global vars.
 * 
 * You'll find in all/most of the files notes in comments prefixed with 
 * '// FIXME: module-to-core', those are things that shouldn't be there in the final
 * code and are just hacks to make it work seamlessly as a module. It's mostly stuff to
 * use the FakeServer instead of SocketInterface or other similar things to make use of the
 * flags instead of a scene.data.drawings. You can usually delete the code following the FIXME,
 * unless specified otherwise. There are also some other "FIXME" lines that aren't really needing
 * of fixes but are there because I want to read that specific comment or that asks a question
 * about the implementation.
 * 
 * My biggest issue might be the "default settings" per drawing, since the sanity checking
 * has to be done on the server, I'm thinking maybe a temporary object could be created to validate
 * the config data and stored, otherwise client side needs to keep track of all the default values
 * and the sanity checking (like having to do Number(data.fillType)).
 *
 * That's about it for the intro. I hope it's fine for you and the code fits your standard.
 * I tried to stay as close as possible to your coding style and design, but I know that you like
 * to add the semicolon to every line and I've had a lot of trouble doing that, sorry about that!
 * 
 * FIXME: copy/pasted drawings will have proper values in the server but for some reason will all
 * share the same id, so moving one will move all of them.
 */

const DRAWING_FILL_TYPE = {
  NONE: 0,
  SOLID: 1,
  PATTERN: 2,
  STRETCH: 3,
  CONTOUR: 4,
  FRAME: 5
}

const DRAWING_TYPE = {
  RECTANGLE: "r",
  ELLIPSE: "e",
  TEXT: "t",
  POLYGON: "p",
  FREEHAND: "f"
}


CONFIG.drawingFillTypes = {
  0: "None",
  1: "Solid Color",
  2: "Tiled Pattern",
  3: "Stretched Texture",
  4: "Tiled Contour",
  5: "Stretched Contour"
}

// FIXME: module-to-core
CONFIG.Drawing = duplicate(CONFIG.Tile)
CONFIG.drawingTypes = {
  r: "Rectangle",
  e: "Ellipse",
  t: "Text",
  p: "Polygon",
  f: "Freehand"
}


CONFIG.WebSafeFonts = {
  "Arial": "Arial, Helvetica, sans-serif",
  "Arial Black": '"Arial Black", Gadget, sans-serif',
  "Times New Roman": '"Times New Roman", Times, serif',
  "Comic Sans MS": '"Commic Sans MS", cursive, sans-serif',
  "Courier New": '"Courier New", Courier, monospace',
  // FIXME: There are more, but do we want to show all of the available options??
}
CONFIG.FREEHAND_SAMPLING_RATE = 100;

class FurnaceDrawing {
  static canvasInit() {
    if (canvas.drawings === undefined) {
      canvas.hud.drawing = new DrawingHUD()
      let gridIdx = canvas.stage.children.indexOf(canvas.grid)
      canvas.drawings = canvas.stage.addChildAt(new DrawingsLayer(), gridIdx)
    }
    // Should probably 'await' this, but the hook isn't async
    canvas.drawings.draw()
  }

  // FIXME: module-to-core: Add 'drawings' as the things to trigger a redraw in scene._onUpdate
  // In the meantime, only update if a drawing got created or deleted.. issue with updates is that
  // it makes it hard to move/rotate drawings because the redraw makes you lose the selection.
  // We use this.updating to avoid the problem and so redraws happen only if another user is doing
  // the changes.
    
  // FIXME: module-to-core: you know where this goes :)
  static renderSceneControls(obj, html, data) {
    if (obj.controls.drawings == undefined) {
      // FIXME: module-to-core: currently, trusted players can't update a scene.
      // Having them able to modify the drawings field would be great. Otherwise, this 
      // needs to become isGM.
      let isTrusted = game.user.isTrusted;
      let controls = obj.controls

      // Rebuild the object so I can place the Drawings layer right after the Tiles layer
      obj.controls = {}
      for (let control in controls) {
        obj.controls[control] = controls[control]
        if (control == "tiles") {
          obj.controls["drawings"] = {
            name: "Drawing Tools",
            layer: "DrawingsLayer",
            icon: "fas fa-pencil-alt",
            tools: {
              select: {
                name: "Select Drawings",
                icon: "fas fa-expand",
                visible: isTrusted
              },
              shape: {
                name: "Draw Shapes",
                icon: "fas fa-shapes",
                visible: isTrusted
              },
              polygon: {
                name: "Draw Polygons",
                icon: "fas fa-draw-polygon",
                visible: isTrusted
              },
              freehand: {
                name: "Draw Freehand",
                icon: "fas fa-signature",
                visible: isTrusted
              },
              text: {
                name: "Draw Text",
                icon: "fas fa-font",
                visible: isTrusted
              },
              clear: {
                name: "Clear all Drawings",
                icon: "fas fa-trash",
                onClick: () => {
                  canvas.drawings.deleteAll();
                  ui.controls.controls[ui.controls.activeControl].activeTool = "select";
                  ui.controls.render();
                },
                visible: isTrusted
              },
              configure: {
                name: "Clear all Drawings",
                icon: "fas fa-cog",
                onClick: () => {
                  canvas.drawings.configureStartingData();
                  ui.controls.controls[ui.controls.activeControl].activeTool = "select";
                  ui.controls.render();
                },
                visible: isTrusted
              }
            },
            activeTool: "select"
          }
        }
      }

      obj.render();
    }
  }
}

Hooks.on('canvasInit', FurnaceDrawing.canvasInit);
Hooks.on('renderSceneControls', FurnaceDrawing.renderSceneControls);