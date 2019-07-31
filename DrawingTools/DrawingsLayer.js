/**
 * The DrawingsLayer subclass of :class:`PlaceablesLayer`
 *
 * This layer implements a container for drawings which are rendered immediately above the :class:`TilesLayer`
 * and immediately below the :class:`GridLayer`
 *
 * @type {PlaceablesLayer}
 */
class DrawingsLayer extends PlaceablesLayer {
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
    return Drawing;
  }

  /* -------------------------------------------- */
  /*  Rendering
/* -------------------------------------------- */

  /**
   * Draw the DrawingsLayer.
   * Draw each contained drawing within the scene as a child of the objects container
   * @return {DrawingsLayer}
   */
  draw() {
    // FIXME: module-to-core: remove
    canvas.scene.data.drawings = FakeServer.getDrawings(canvas.scene)
    super.draw();
    return this;
  }

  // FIXME: module-to-core : use of FakeServer.setDrawings instead of canvas.scene.update()
  // The reason for not just deleting this is that a trusted player could delete all drawings
  // that he owns, but not others' drawings, so the title and new list needs to be different.
  // This would need to be checked by the server I guess ?
  deleteAll() {
    const cls = this.constructor.placeableClass;
    let title = "Clear All Drawings"
    let content = `<p>Clear all Drawings from this Scene?</p>`
    let new_drawings = []
    if (!game.user.isGM) {
      if (game.user.isTrusted) {
        title = "Clear Your Drawings"
        content = `<p>Clear your Drawings from this Scene?</p>`
        new_drawings = FakeServer.getDrawings(canvas.scene).filter(d => d.owner !== game.user.id)
      } else {
        throw new Error(`You do not have permission to delete ${cls.name} placeables from the Scene.`);
      }
    }
    let layer = this;
    new Dialog({
      title: title,
      content: content,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Yes",
          // FIXME: module-to-core: Add 'drawings' as the things to trigger a redraw in _onUpdate
          callback: () => FakeServer.setDrawings(canvas.scene, new_drawings).then(canvas.drawings.draw.bind(this))
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

  getStartingData(type) {
    if (this._startingData[type] === undefined)
      this._startingData[type] = this.getDefaultData(type);
    delete this._startingData[type].id
    return this._startingData[type]
  }
  getDefaultData(type) {
    let defaultData = mergeObject(FakeServer.DrawingDefaultData("all"), FakeServer.DrawingDefaultData(type), { inplace: false });
    // Set default colors as the user color
    if (type == "text") {
      defaultData.fillColor = game.user.color;
    }
    else {
      defaultData.strokeColor = game.user.color;
      defaultData.fillColor = game.user.color;
    }
    return defaultData;
  }

  updateStartingData(drawing) {
    let data = duplicate(drawing.data)
    mergeObject(data, { id: 1, x: 0, y: 0, width: 0, height: 0, owner: null, rotation: 0 }, { overwrite: true })
    if (data.points) delete data.points
    if (data.content) delete data.content
    mergeObject(this.getStartingData(drawing.type), data, { overwrite: true })
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
    // Snap to grid by default only for shapes
    // FIXME: maybe for polygons too? would make sense but having to press shift
    // constantly for non snapping could be annoying.
    let position = duplicate(point)
    if (!event.data.originalEvent.shiftKey && ["shape", "polygon"].includes(game.activeTool)) {
      position = canvas.grid.getSnappedPosition(position.x, position.y);
    }
    return position;
  }

  _getNewDataFromEvent(event) {
    let type = game.activeTool;
    let origin = this.getPosition(event, event.data.origin)
    if (type == "shape") {
      if (event.data.originalEvent.ctrlKey)
        type = "ellipse";
      else
        type = "rectangle";
    }
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
    let drawing = new Drawing(data);
    drawing.draw();
    drawing._controlled = true;
    event.data.object = this.preview.addChild(drawing);
    // You can place a text by simply clicking, no need to drag it first.
    if (drawing.type == "text")
      event.data.createState = 2;
    event.data.createTime = Date.now();
  }

  /* Difference with base class is that we don't need a minimum of half-grid to create the drawing  */
  _onDragCreate(event) {
    // A single click could create 
    let object = event.data.object;
    this._onDragCancel(event);
    // Text objects create their sheets for users to enter the text, otherwise create the drawing
    if (object.type == "text") {
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
    if (createState >= 1 && object && object.type == "polygon") {
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
      if (drawing && drawing.type == "polygon") {
        let destination = this.getPosition(event, event.data.destination);
        drawing.addPolygonPoint(destination);
        drawing.refresh();
        event.data.createState = 1;
        event.data.createTime = Date.now();
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

    if (object && object.type == "polygon") {
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
        let destination = object.data.points[object.data.points.length - 2];
        let previousPoint = object.data.points[object.data.points.length - 3];
        // Check distance between origin point and current cursor position
        let originDistance = Math.hypot(origin[0] - position[0], origin[1] - position[1]);
        // Check distance between the last 2 points to see if user clicked on the last point twice.
        let destinationDistance = Math.hypot(destination[0] - previousPoint[0], destination[1] - previousPoint[1]);
        if (originDistance < this.gridPrecision || destinationDistance < this.gridPrecision) {
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
      if (!object || object.type != "polygon")
        this._onDragCancel(event);
      // Handle successful creation and chaining
    } else if (createState === 2) {
      this._onDragCreate(event);
      event.data.createState = 0;
    }
  }
  /* -------------------------------------------- */

  // FIXME: taken as is from WallsLayer, maybe should move into PlaceablesLayer
  get gridPrecision() {
    let size = canvas.dimensions.size;
    if (size >= 128) return 16;
    else if (size >= 64) return 8;
    else if (size >= 32) return 4;
    else if (size >= 16) return 2;
  }

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
  _onDeleteKey(event) {
    if (!game.user.isTrusted) throw new Error("You may not delete drawings!");
    this.placeables.filter(d => d._controlled && d.owner)
      .forEach(t => t.delete(canvas.scene._id));
  }
}
