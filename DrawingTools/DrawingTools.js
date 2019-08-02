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
 * and the sanity checking (like having to do Number(data.fill)).
 *
 * That's about it for the intro. I hope it's fine for you and the code fits your standard.
 * I tried to stay as close as possible to your coding style and design, but I know that you like
 * to add the semicolon to every line and I've had a lot of trouble doing that, sorry about that!
 * 
 * FIXME: copy/pasted drawings will have proper values in the server but for some reason will all
 * share the same id, so moving one will move all of them.
 */

const DRAWING_FILL_TYPE = {
  "NONE": 0,
  "SOLID": 1,
  "PATTERN": 2,
  "STRETCH": 3,
  "CONTOUR": 4,
  "FRAME": 5
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
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  text: "Text",
  polygon: "Polygon",
  freehand: "Freehand"
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

class FakeServer {
  // Firefox doesn't support static class fields
  static get updating() { return this._upating || false };
  static set updating(value) { this._upating = value };

  static DrawingDefaultData(type = "all") {
    return {
      // Special 'all' type which contains default values common to all types
      all: {
        id: 1,
        x: 0,
        y: 0, // FIXME: tiles have unused 'z', should drawings also have it now?
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
        strokeWidth: 3,
        points: [],
        bezierFactor: 0
      },
      freehand: {
        type: "freehand",
        strokeWidth: 3,
        points: [],
        bezierFactor: 0.5,
      }
    }[type]
  }

  static updateFlag(scene, drawings) {
    let promise = scene.setFlag("furnace", "drawings", drawings)
    // FIXME: module-to-core: problem here is if we delete multiple drawings at the same time,
    // we'll keep updating the list of drawings with the same original size and only one gets delete
    // by the time the server responds to all the requests. This shouldn't be necessary in the actual server
    scene.data.flags.furnace = { drawings: duplicate(drawings) };
    return promise;
  }

  static onMessage(data) {
    // FIXME: module-to-core: This is just to bypass the restriction on non-GM users from
    // modifying the scene. This would go away in the core, but you'll need to make trusted users
    // able to modify the scene.drawings data.
    // Some people in #vtt-modules requested the ability to allow individual users the ability to edit,
    // I don't know if "set/remove them as trusted" is the right answer here, but if you want to add
    // a flag for drawing tools or a more complicated system for permissions on individual features
    // then that needs to be done separately. Maybe create it as an issue for future releases.data => {
    console.log("Got message : ", data)
    if (data.updateFlags === true && game.user.isGM && data.target == game.user.id) {
      let scene = game.scenes.get(data.scene);
      return FakeServer.updateFlag(scene, data.drawings);
    }
  }

  static getDrawings(scene) {
    let drawings = scene.getFlag("furnace", "drawings") || []
    console.log("Get drawings for scene ", scene.id, " : ", drawings)
    return duplicate(drawings)
  }
  static async setDrawings(scene, drawings) {
    drawings = drawings.map(this.sanityCheck)
    console.log("Updating drawings database for scene ", scene.id, " : ", drawings)
    this.updating = true
    let ret = null;
    if (game.user.isGM) {
      ret = await this.updateFlag(scene, drawings);
    } else {
      // Only ask the first GM to update drawings to avoid race conditions in case more
      // than one with GM permissions are online at the same time.
      let target = game.users.entities.find(u => u.active && u.isGM);
      if (target) {
        let socketData = {
          updateFlags: true,
          scene: scene.id,
          target: target.id,
          drawings: drawings
        }
        let promise = new Promise((resolver) => this.update_promise_resolver = resolver);
        game.socket.emit('module.furnace', socketData);
        ret = await promise;
        this.update_promise_resolver = null;
      } else {
        ui.notifications.error("No GM is currently active. Drawings cannot be updated.")
        throw new Error("Cannot update drawings with no GM present");
      }
    }
    this.updating = false
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
    // FIXME: Should loop through the list of points and remove points that are at same coordinate
    // as the next point.
    for (let key of ["x", "y", "width", "height"]) {
      if (data[key]) data[key] = Math.round(data[key]);
    }
    if (!data.owner)
      data.owner = game.user.id
    if (!update) {
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

      // We duplicate because multiple pastes will cause multiple objects to share the same data
      return { parentId: parentId, created: duplicate(data) }
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
      return { parentId: parentId, updated: duplicate(data) }
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

  static onReady() {
    game.socket.on('module.furnace', FakeServer.onMessage);
  }

  static onUpdateScene(scene, updated) {
    // FIXME: module-to-core: Add 'drawings' as the things to trigger a redraw in scene._onUpdate
    // In the meantime, only update if a drawing got created or deleted.. issue with updates is that
    // it makes it hard to move/rotate drawings because the redraw makes you lose the selection.
    // We use this.updating to avoid the problem and so redraws happen only if another user is doing
    // the changes.
    
    if (updated["flags.furnace.drawings"] !== undefined && canvas.scene.id == scene.id) {
      if (!FakeServer.updating)
        canvas.drawings.draw()
      else if (FakeServer.update_promise_resolver)
        FakeServer.update_promise_resolver(updated["flags.furnace.drawings"]);
    }
        
  }
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
Hooks.on('updateScene', FurnaceDrawing.onUpdateScene);
Hooks.on('ready', FurnaceDrawing.onReady);