/**
 * The DrawingsLayer subclass of :class:`PlaceablesLayer`
 *
 * This layer implements a container for drawings which are rendered immediately above the :class:`TilesLayer`
 * and immediately below the :class:`GridLayer`
 *
 * @type {PlaceablesLayer}
 */
class FurnaceDrawingsLayer extends PlaceablesLayer {
  // Override the constructor's name
  static get name() {
    return "DrawingsLayer"
  }
  constructor() {
    super()

    this._startingData = {};
  }

  /**
   * Define the source data array underlying the placeable objects contained in this layer
   * @type {Array}
   */
  static get dataArray() {
    return "drawings";
  }

  /**
   * Define a Container implementation used to render placeable objects contained in this layer
   * @type {PIXI.Container}
   */
  static get placeableClass() {
    return FurnaceDrawing;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  deleteAll() {
    const cls = this.constructor.placeableClass;
    let title = "Clear All Drawings"
    let content = `<p>Clear all Drawings from this Scene?</p>`
    let new_drawings = []
    if (!game.user.isGM) {
      if (game.user.isTrusted) {
        title = "Clear Your Drawings"
        content = `<p>Clear your Drawings from this Scene?</p>`
        new_drawings = canvas.scene.data.drawings.filter(d => d.author !== game.user.id)
      } else {
        throw new Error(`You do not have permission to delete Drawings from the Scene.`);
      }
    }
    
    new Dialog({
      title: title,
      content: content,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Yes",
          callback: () => canvas.scene.update({"drawings": new_drawings })
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "No"
        }
      },
      default: "yes"
    }).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Override the deactivation behavior of this layer.
   * Placeables on this layer remain visible even when the layer is inactive.
   */
  deactivate() {
    super.deactivate();
    this.releaseAll();
    if (this.objects) this.objects.visible = true;
  }

  /* -------------------------------------------- */

  
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
        fontFamily: "Signika",
        fontSize: 48,
        text: "",
        textAlpha: 1,
        textColor: "#FFFFFF",
        bezierFactor: 0
      },
      [DRAWING_TYPES.RECTANGLE]: {
        strokeWidth: 8,
      },
      [DRAWING_TYPES.ELLIPSE]: {
        strokeWidth: 8,
      },
      [DRAWING_TYPES.TEXT]: {
        // FIXME: Text should be Rectangle or add native text support in core
        fillType: FURNACE_DRAWING_FILL_TYPE.SOLID,
        strokeWidth: 2,
        content: "",
        fontFamily: "Signika",
        fontSize: 48,
        wordWrap: false
      },
      [DRAWING_TYPES.POLYGON]: {
        strokeWidth: 8,
        points: [],
        bezierFactor: 0
      },
      [DRAWING_TYPES.FREEHAND]: {
        strokeWidth: 8,
        points: [],
        bezierFactor: 0.5,
      }
    }[type]
  }
  getStartingData(type) {
    type = type[0]
    if (this._startingData[type] === undefined)
      this._startingData[type] = this.getDefaultData(type);
    delete this._startingData[type].id
    return this._startingData[type]
  }
  getDefaultData(type) {
    type = type[0]
    let defaultData = mergeObject(this.constructor.DrawingDefaultData("all"),
                                  this.constructor.DrawingDefaultData(type),
                                  { inplace: false });
    defaultData.type = type
    // Set default colors as the user color
    if (type == DRAWING_TYPES.TEXT) {
      defaultData.textColor = game.user.color;
    }
    else {
      defaultData.strokeColor = game.user.color;
      defaultData.fillColor = game.user.color;
    }
    return defaultData;
  }

  updateStartingData(drawing) {
    let data = duplicate(drawing.data)
    mergeObject(data, { id: 1, x: 0, y: 0, z: 0, width: 0, height: 0, author: null, rotation: 0 }, { overwrite: true })
    if (data.points) delete data.points
    if (data.text) delete data.text
    mergeObject(this.getStartingData(data.type), data, { overwrite: true })
  }

  /**
   * Get the configuration sheet for the layer.
   * This allows a user to configure the default values for all tools
   */
  configureStartingData() {
    // We don't use a singleton because defaults could change between calls.
    new DrawingDefaultsConfig(this).render(true);
  }

  getPosition(event, point) {
    // Snap to grid by default only for shapes and polygons
    let position = duplicate(point)
    if (!event.data.originalEvent.shiftKey && ["rectangle", "ellipse", "polygon"].includes(game.activeTool)) {
      position = canvas.grid.getSnappedPosition(position.x, position.y);
    }
    return position;
  }

  _getNewDataFromEvent(event) {
    let type = game.activeTool;
    let origin = this.getPosition(event, event.data.origin)
    let data = mergeObject(this.getStartingData(type), origin, { inplace: false })
    if (type == "freehand" || type == "polygon")
      data.points.push([data.x, data.y])

    return data;
  }
  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Sequence of events : 
   * Normal operation : 
   * _onMouseDown --> (createState == 0)
   *   --> _onDragStart --> createState = 1 --> if (type == text --> createState = 2)
   * _onMouseMove --> createState = 2
   * _onMouseUp --> (createState == 2)
   *   --> _onDragCreate
   *        --> Drawing.create
   *        --> _onDragCancel --> createState = 0
   * 
   * Simple click, no move (non polygon)
   * _onMouseDown --> (createState == 0)
   *   --> _onDragStart --> createState = 1 --> (type == text --> createState = 2)
   * _onMouseUp --> (createState == 1) --> (type != polygon)
   *   --> _onDragCancel --> createState = 0
   * 
   * Simple click, (polygon) followed by move
   * _onMouseDown --> (createState == 0)
   *   --> _onDragStart --> createState = 1 --> (type == text --> createState = 2)
   * _onMouseUp --> (createState == 1) --> (type == polygon)
   * _onMouseMove --> createState = 2
   * _onMouseDown --> (createState >= 1) --> (type == polygon)
   *   --> object.addPolygonPoint --> createState = 1
   *  == return to state @ line 3 == 
   *
   */

  /**
   * Default handling of drag start events by left click + dragging
   * @private
   */
  _onDragStart(event) {
    super._onDragStart(event);
    canvas.app.view.oncontextmenu = ev => this._onRightClick(event);
    let data = this._getNewDataFromEvent(event);
    let drawing = new FurnaceDrawing(data);
    drawing.draw();
    drawing._controlled = true;
    event.data.object = this.preview.addChild(drawing);
    // You can place a text by simply clicking, no need to drag it first.
    if (drawing.type == DRAWING_TYPES.TEXT)
      event.data.createState = 2;
    event.data.createTime = Date.now();
  }

  /* Difference with base class is that we don't need a minimum of half-grid to create the drawing  */
  _onDragCreate(event) {
    // A single click could create 
    let object = event.data.object;
    this._onDragCancel(event);
    // Text objects create their sheets for users to enter the text, otherwise create the drawing
    if (object.type == DRAWING_TYPES.TEXT) {
      // Render the preview sheet
      object.sheet.preview = this.preview;
      object.sheet.render(true);

      // Re-render the preview text
      this.preview.addChild(object);
      object.refresh();
    } else if (!object.data.points || object.data.points.length > 1) {
      // Only create the object if it's not a polygon/freehand or if it has at least 2 points
      this.constructor.placeableClass.create(canvas.scene._id, object.data);
    }
  }

  _onRightClick(event) {
    let { createState, object } = event.data;
    if (createState >= 1 && object && object.type == DRAWING_TYPES.POLYGON) {
      // Remove the current mouse position
      let position = object.data.points.pop()
      // If it was the last point, cancel the thing.
      if (object.data.points.length > 1) {
        // Remove the last point and re-add our cursor position
        object.data.points.pop()
        object.data.points.push(position);
        object.refresh();
      } else {
        this._onDragCancel(event);
      }
    } else {
      this._onDragCancel(event);
    }
  }

  /* -------------------------------------------- */

  _onMouseDown(event) {
    if (event.data.createState >= 1) {
      event.stopPropagation();

      // Add point to polygon and reset the state
      let drawing = event.data.object;
      if (drawing && drawing.type == DRAWING_TYPES.POLYGON) {
        let destination = this.getPosition(event, event.data.destination);
        drawing.addPolygonPoint(destination);
        drawing.refresh();
        event.data.createState = 1;
        let now = Date.now();
        let timeDiff = now - (event.data.createTime || 0);
        event.data.doubleclick = timeDiff < 250;
        event.data.createTime = now;
      }
    } else {
      super._onMouseDown(...arguments)
    }
  }
  /**
   * Default handling of mouse move events during a dragging workflow
   * @private
   */
  _onMouseMove(event) {
    super._onMouseMove(event);
    if (event.data.createState >= 1) {
      let drawing = event.data.object;
      let [gx, gy] = [event.data.originalEvent.x, event.data.originalEvent.y];

      // If the cursor has moved close to the edge of the window
      this._panCanvasEdge(gx, gy);

      drawing.updateDragPosition(event.data.destination)
      drawing.refresh();
      event.data.createState = 2;
    }
  }

  _onMouseUp(event) {
    let { createState, object, createTime } = event.data;

    if (object && object.type == DRAWING_TYPES.POLYGON) {
      // Check for moving mouse during a polygon waypoint click
      if (createState == 2) {
        let now = Date.now();
        let timeDiff = now - (createTime || 0);
        if (keyboard.isCtrl(event) || timeDiff < 250)
          createState = 1;
      }
      // Check for clicking on the origin point or the last point position
      if (createState == 1 && object.data.points.length > 2) {
        // The last point is our current cursor/end position. The last clicked point is the one before that
        let origin = object.data.points[0];
        let position = object.data.points[object.data.points.length - 1];
        // Check distance between origin point and current cursor position
        let originDistance = Math.hypot(origin[0] - position[0], origin[1] - position[1]);
        // Check if user double clicked on the end point.
        if (originDistance < this.gridPrecision || event.data.doubleclick) {
          // We're done, pop the last cursor position
          object.data.points.pop()
          createState = 2;
        }
      }
    }

    // Handle single clicks with no moves
    if (createState === 1) {
      event.stopPropagation();
      // Don't cancel a click for polygons
      if (!object || object.type != DRAWING_TYPES.POLYGON)
        this._onDragCancel(event);
      // Handle successful creation and chaining
    } else if (createState === 2) {
      this._onDragCreate(event);
      event.data.createState = 0;
    }
  }
  /* -------------------------------------------- */

  // FIXME: taken as is from WallsLayer, maybe should move into PlaceablesLayer
  /**
   * Pan the canvas view when the cursor position gets close to the edge of the frame
   * @private
   */
  _panCanvasEdge(x, y) {
    const pad = 50,
      shift = 500 / canvas.stage.scale.x;
    let dx = 0;
    if (x < pad) dx = -shift;
    else if (x > window.innerWidth - pad) dx = shift;
    let dy = 0;
    if (y < pad) dy = -shift;
    else if (y > window.innerHeight - pad) dy = shift;
    if ((dx || dy) && !this._panning) {
      this._panning = true;
      canvas.animatePan({ x: canvas.stage.pivot.x + dx, y: canvas.stage.pivot.y + dy }, { duration: 100 }).then(() => {
        this._panning = false;
      })
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle a DELETE keypress while the TilesLayer is active
   * @private
   */
  async _onDeleteKey(event) {
    if (!game.user.isTrusted) throw new Error("You may not delete drawings!");
    
    // If the user is a GM, we can do a batch deletion by modifying the scene directly
    if ( game.user.isGM ) {
      const toDelete = new Set(Object.keys(this._controlled).map(Number));
      const objects = canvas.scene.data[this.constructor.dataArray].filter(o => !toDelete.has(o.id));
      canvas.scene.update({[this.constructor.dataArray]: objects});
    }

    // Otherwise we need to use the Drawing.delete API
    else {
      for ( let obj of Object.values(this._controlled) ) {
        await obj.delete(obj.scene._id);
      }
    }
  }
}

// Needed so core doesn't break due to our change of the DrawingsLayer.
// We also don't want to derive from DrawingsLayer because it can cause issues
// with things like super._onDragStart
FurnaceDrawingsLayer.DEFAULT_CONFIG_SETTING = "defaultDrawingConfig";