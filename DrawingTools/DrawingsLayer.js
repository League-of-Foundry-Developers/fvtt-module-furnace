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
  // Can be removed entirely in core
  deleteAll() {
    const cls = this.constructor.placeableClass;
    if (!game.user.isGM) {
      throw new Error(`You do not have permission to delete ${cls.name} placeables from the Scene.`);
    }
    let layer = this;
    new Dialog({
      title: "Clear All Objects",
      content: `<p>Clear all ${cls.name} objects from this Scene?</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Yes",
          // FIXME: module-to-core: Add 'drawings' as the things to trigger a redraw in _onUpdate
          callback: () => FakeServer.setDrawings(canvas.scene, []).then(canvas.drawings.draw.bind(this))
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
    mergeObject(data, { id: 1, x: 0, y: 0, width: 0, height: 0, owner: null }, { overwrite: true })
    if (data.points) delete data.points
    if (data.content) delete data.content
    mergeObject(this.getStartingData(data.type), data, { overwrite: true })
    delete this._startingData[type].id
  }

  /**
   * Get the configuration sheet for the layer.
   * This allows a user to configure the default values for all tools
   */
  configureStartingData() {
    // We don't use a singleton because defaults could change between calls.
    new DrawingDefaultsConfig(this).render(true);
  }

  _getNewDataFromEvent(event) {
    if (!event.data.originalEvent.shiftKey && game.activeTool == "shape") {
      event.data.origin = canvas.grid.getSnappedPosition(event.data.origin.x,
        event.data.origin.y);
    }
    let type = game.activeTool;
    if (type == "shape") {
      if (event.data.originalEvent.ctrlKey)
        type = "ellipse";
      else
        type = "rectangle";
    }
    let data = mergeObject(this.getStartingData(type), event.data.origin, { inplace: false })
    if (type == "freehand" || type == "polygon")
      data.points.push([data.x, data.y])

    return data;
  }
  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Default handling of drag start events by left click + dragging
   * @private
   */
  _onDragStart(event) {
    super._onDragStart(event);
    if (game.activeTool == "clear") return;
    let data = this._getNewDataFromEvent(event);
    let drawing = new Drawing(data);
    drawing.draw();
    drawing._controlled = true;
    event.data.object = this.preview.addChild(drawing);
    event.data.createState = 2;
  }

  /* Difference with base class is that we don't need a minimum of half-grid to create the drawing  */
  _onDragCreate(event) {
    this.constructor.placeableClass.create(canvas.scene._id, event.data.object.data);
    this._onDragCancel(event);
  }

  /* -------------------------------------------- */

  /**
   * Default handling of mouse move events during a dragging workflow
   * @private
   */
  _onMouseMove(event) {
    super._onMouseMove(event);
    if (event.data.createState == 2) {
      let drawing = event.data.object;

      drawing.updateDragPosition(event.data.destination)
      drawing.refresh();
    }
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /**
   * Handle a DELETE keypress while the TilesLayer is active
   * @private
   */
  _onDeleteKey(event) {
    if (!game.user.isTrusted) throw new Error("You may not delete drawings!");
    this.placeables.filter(d => d._controlled && d.canEdit())
      .forEach(t => t.delete(canvas.scene._id));
  }
}
