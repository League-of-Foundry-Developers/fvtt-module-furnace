/**
 * Hey Atropos!
 *
 * This is the main file which has the stuff that doesn't get copied 'mostly as is'.
 * the biggest part being the FakeServer class which just sort of emulates the server side of things
 * as I replaced the call to SocketInterface.trigger by FakeServer.trigger in the DrawingsLayer class.
 * I'm sure you know better on how the server side needs to be done, so I won't say any more.
 * There are a couple of hooks, I'm sure you'll know where to place the code from there into the
 * appropriate place inside the core, and some new config/global vars.
 * 
 * You'll find in all/most of the files notes in comments prefixed with 'FIXME: module-to-core',
 * those are things that shouldn't be there in the final code and are just hacks
 * to make it work as a module. It's mostly stuff to use the FakeServer instead of SocketInterface
 * or other similar things, you can usually delete the code following the FIXME, unless specified
 *
 */

// FIXME: All indentations would need to be fixed. emacs seems to think tabs are a good thing
// and it also uses 4 spaces per tab instead of 2...

const DRAWING_FILL_TYPE = {
  "NONE": 0,
  "SOLID": 1,
  "PATTERN": 2,
  "STRETCH": 3,
  "CONTOUR": 4
}

// FIXME: module-to-core
CONFIG.Drawing = duplicate(CONFIG.Tile)
CONFIG.drawingTypes = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  text: "Text",
  polygon: "Polygon",
  freehand: "Freehand"
}

CONFIG.drawingFillTypes = {
  0: "None",
  1: "Solid Color",
  2: "Tiled Pattern",
  3: "Stretched Texture",
  4: "Contour Texture"
}




class FakeServer {
  static DrawingDefaultData(type = "all") {
    return {
      all: {
        id: 1,
        x: 0,
        y: 0, // FIXME: tiles have unused 'z', should this also add it?
        width: 0,
        height: 0,
        owner: null,
        hidden: false,
        locked: false,
        flags: {}, // lol
        rotation: 0,
        fill: DRAWING_FILL_TYPE.NONE,
        fillColor: "#ffffff",
        fillAlpha: 1.0,
        strokeColor: "#000000",
        strokeAlpha: 1.0,
        texture: null,
        textureWidth: 0,
        textureHeight: 0,
        textureAlpha: 1
      },
      rectangle: {
        type: "rectangle",
        strokeWidth: 5,
      },
      ellipse: {
        type: "ellipse",
        strokeWidth: 5,
      },
      text: {
        type: "text",
        fill: DRAWING_FILL_TYPE.SOLID,
        strokeWidth: 2,
        content: "",
        fontFamily: "Arial",
        fontSize: 25,
        wordWrap: false
      },
      polygon: {
        type: "polygon",
        strokeWidth: 2,
        points: [],
      },
      freehand: {
        type: "freehand",
        strokeWidth: 2,
        points: [],
      }
    }[type]
  }

  static getDrawings(scene) {
    let drawings = scene.getFlag("furnace", "drawings") || []
    console.log("Get drawings for scene ", scene.id, " : ", drawings)
    return duplicate(drawings)
  }
  static async setDrawings(scene, drawings) {
    let original = scene.getFlag("furnace", "drawings") || []
    drawings = drawings.map(this.sanityCheck)
    console.log("Updating drawings database for scene ", scene.id, " : ", drawings)
    let ret = await scene.setFlag("furnace", "drawings", drawings)
    // FIXME: module-to-core: Add 'drawings' as the things to trigger a redraw in scene._onUpdate
    // In the meantime, only update if a drawing got created or deleted.. issue with updates is that
    // it makes it hard to move/rotate drawings because the redraw makes you lose the selection.
    //if (original.length != drawings.length && canvas.scene.id == scene.id) canvas.drawings.draw()
    // TODO: onupdate check if flags changes.. issue with rotate
    // TODO: the ghost drawings issue is because of canvasInit, a canvas.draw() causes them maybe ?
    return ret

  }
  static sanityCheck(data, update = false) {
    if (data.id !== undefined) data.id = Number(data.id)
    if (data.fill !== undefined) {
      data.fill = Number(data.fill)
      if (!Object.values(DRAWING_FILL_TYPE).includes(data.fill))
        data.fill = DRAWING_FILL_TYPE.NONE
    }
    /* Float points is unnecessary */
    if (data.points !== undefined)
      data.points = data.points.map(c => [Math.round(c[0]), Math.round(c[1])])
    if (!update) {
      if (!data.owner)
        data.owner = game.user.id
      /* Sanitize content to have default values. Should do more, like ensure id exists and
       * is unique, type is known, values are not out bounds, etc..
       */
      mergeObject(data, FakeServer.DrawingDefaultData("all"), { overwrite: false })
      mergeObject(data, FakeServer.DrawingDefaultData(data.type), { overwrite: false })
    }
    return data
  }

  static async trigger(hook, eventData, options = {}, preHook, context) {
    // Dispatch the pre-hook
    if (preHook) {
      let hookArgs = context ? Array(context, ...Object.values(eventData)) : Object.values(eventData);
      let allowed = Hooks.call(preHook, ...hookArgs);
      if (allowed === false) {
        console.log(`${vtt} | ${eventName} submission prevented by ${preHook} hook`);
        return new Promise(resolve => null);   // Deliberately return an unresolved Promise
      }
    }
    if (hook == "createDrawing") {
      let { parentId, data } = eventData
      const scene = game.scenes.get(parentId);
      if (!scene) throw new Error(`Parent Scene ${parentId} not found`);
      let id = 1;

      // Get the current drawings and assign a new id
      let drawings = FakeServer.getDrawings(scene)
      for (let drawing of drawings) {
        if (drawing.id >= id)
          id = drawing.id + 1
      }
      data.id = id

      // Add to database
      drawings.push(data)
      await FakeServer.setDrawings(scene, drawings)

      return { parentId: parentId, created: data }
    } else if (hook == "updateDrawing") {
      let { parentId, data } = eventData
      const scene = game.scenes.get(parentId);
      if (!scene) throw new Error(`Parent Scene ${parentId} not found`);

      // Update database
      let drawings = FakeServer.getDrawings(scene)
      let original = drawings.find(o => o.id === Number(data.id));
      if (!original) throw new Error(`Drawing ${parentId} not found`);

      mergeObject(original, data, { inplace: true });
      await FakeServer.setDrawings(scene, drawings)

      this.sanityCheck(data, true)
      return { parentId: parentId, updated: data }
    } else if (hook == "deleteDrawing") {
      let { parentId, childId } = eventData
      const scene = game.scenes.get(parentId);
      if (!scene) throw new Error(`Parent Scene ${parentId} not found`);

      // Update database
      let drawings = FakeServer.getDrawings(scene)
      let idx = drawings.findIndex(o => o.id === Number(childId));
      if (idx !== -1) {
        drawings.splice(idx, 1);
        await FakeServer.setDrawings(scene, drawings)
      }

      return { parentId: parentId, deleted: childId }
    } else {
      throw new Error("Idontknow")
    }
  }
}

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

  // FIXME: module-to-core: you know where this goes :)
  static renderSceneControls(obj, html, data) {
    if (obj.controls.drawings == undefined) {
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
