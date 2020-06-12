/**
 * The DrawingsLayer subclass of :class:`PlaceablesLayer`
 *
 * This layer implements a container for drawings which are rendered immediately above the :class:`TilesLayer`
 * and immediately below the :class:`GridLayer`
 *
 * @type {PlaceablesLayer}
 */
class FurnaceDrawingsLayer extends DrawingsLayer {
  // Override the constructor's name
  static get name() {
    return "DrawingsLayer"
  }
  constructor() {
    super()

    this._last_tool = CONST.DRAWING_TYPES.RECTANGLE
    this._startingData = game.settings.get("furnace", FurnaceDrawingsLayer.DEFAULT_CONFIG_SETTING);
  }

  static get layerOptions() {
    return mergeObject(super.layerOptions, {
      snapToGrid: false
    });
  }

  /**
   * Define a Container implementation used to render placeable objects contained in this layer
   * @type {PIXI.Container}
   */
  static get placeableClass() {
    return FurnaceDrawing;
  }
  get gridPrecision() {
    return 2;
  }


  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  deleteAll() {
    const cls = this.constructor.placeableClass;
    let title = "Clear All Drawings"
    let content = `<p>Clear all Drawings from this Scene?</p>`
    let placeables = this.placeables;
    if (!game.user.isGM) {
      if (game.user.can("DRAWING_CREATE")) {
        title = "Clear Your Drawings"
        content = `<p>Clear your Drawings from this Scene?</p>`
        placeables = this.placeables.filter(p => p.data.author == game.user.id)
      } else {
        return ui.notification.error(`You do not have permission to delete Drawings from the Scene.`);
      }
    }
    
    new Dialog({
      title: title,
      content: content,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Yes",
          callback: () => canvas.scene.deleteEmbeddedEntity('Drawing', placeables.map(o => o.id))
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
  /* -------------------------------------------- */

  
  static DrawingDefaultData(type = "all") {
    return {
      // Special 'all' type which contains default values common to all types
      all: {
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
        fillColor: game.user.color,
        fillAlpha: 1.0,
        strokeColor: game.user.color,
        strokeAlpha: 1.0,
        strokeWidth: 8,
        texture: null,
        fontFamily: "Signika",
        fontSize: 48,
        text: "",
        textAlpha: 1,
        textColor: game.user.color,
        bezierFactor: 0,
        points: [],
      },
      [CONST.DRAWING_TYPES.RECTANGLE]: {
      },
      [CONST.DRAWING_TYPES.ELLIPSE]: {
      },
      [CONST.DRAWING_TYPES.TEXT]: {
        fillType: FURNACE_DRAWING_FILL_TYPE.SOLID,
        strokeWidth: 2,
      },
      [CONST.DRAWING_TYPES.POLYGON]: {
        bezierFactor: 0
      },
      [CONST.DRAWING_TYPES.FREEHAND]: {
        bezierFactor: 0.5,
      }
    }[type]
  }
  getStartingData(type) {
    type = type[0]
    if (this._startingData[type] === undefined)
      this._startingData[type] = this.getDefaultData(type);
    delete this._startingData[type]._id;
    this._startingData[type].type = type;
    return this._startingData[type]
  }
  getDefaultData(type) {
    type = type[0]
    let defaultData = mergeObject(this.constructor.DrawingDefaultData("all"),
                                  this.constructor.DrawingDefaultData(type),
                                  { inplace: false });
    defaultData.type = type
    return defaultData;
  }

  updateStartingData(drawing) {
    let data = duplicate(drawing.data)
    mergeObject(data, { x: 0, y: 0, z: 0, width: 0, height: 0, author: null, rotation: 0 }, { overwrite: true })
    data.points = []
    data.text = ""
    this._startingData[data.type] = data
    game.settings.set("furnace", DrawingsLayer.DEFAULT_CONFIG_SETTING, this._startingData)
  }

  /**
   * Get the configuration sheet for the layer.
   * This allows a user to configure the default values for all tools
   */
  configureStartingData() {
    // We don't use a singleton because defaults could change between calls.
    new DrawingDefaultsConfig(this, this._last_tool).render(true);
  }

  _onClickLeft(event) {
    super._onClickLeft(event);
    // You can place a text by simply clicking, no need to drag it first.
    if (game.activeTool === "text") {
        canvas.mouseInteractionManager._handleDragStart(event);
        canvas.mouseInteractionManager._handleDragDrop(event);
        event.data.createState = 2;
    }
  }
  _onDragLeftStart(event) {
    // Snap to grid by default only for shapes and polygons
    if (!event.data.originalEvent.shiftKey && ["rectangle", "ellipse", "polygon"].includes(game.activeTool)) {
      event.data.origin = canvas.grid.getSnappedPosition(event.data.origin.x, event.data.origin.y, this.gridPrecision);
    }
    super._onDragLeftStart(event);
  }
  _onDragLeftDrop(event) {
    const { preview } = event.data;
    super._onDragLeftDrop(event);

    // Text objects create their sheets for users to enter the text, otherwise create the drawing
    if (preview.type == CONST.DRAWING_TYPES.TEXT) {
        // Render the preview sheet
        preview.sheet.preview = preview;
        preview.sheet.render(true);
        this.preview.addChild(preview);
      }
  }
  _getNewDrawingData(origin) {
    let type = game.activeTool;
    let data = mergeObject(this.getStartingData(type), origin, { inplace: false })
    if (type == "freehand" || type == "polygon") {
      data.points.push([data.x, data.y])
      data.x = data.y = 0;
    }

    return data;
  }
  _onDeleteKey(event) {
    // Skip the _onDeleteKey from DrawingsLayer which ignores Text drawings.
    PlaceablesLayer.prototype._onDeleteKey.call(this, event);
  }
}

// Needed so core doesn't break due to our change of the DrawingsLayer.
// We also don't want to derive from DrawingsLayer because it can cause issues
// with things like super._onDragStart
FurnaceDrawingsLayer.DEFAULT_CONFIG_SETTING = "defaultDrawingConfig";