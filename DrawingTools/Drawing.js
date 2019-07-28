// FIXME: keep as is or copy paste the functions?
// Derive from Tile so we don't need to copy/paste all the scale-handle/rotate/dimension/control
// functions here as they would be mostly the same.
class Drawing extends Tile {
  /**
   * Provide a reference to the canvas layer which contains placeable objects of this type
   * @type {PlaceablesLayer}
   */
  static get layer() {
    return DrawingsLayer;
  }

  /**
   * Provide a singleton reference to the DrawingConfig sheet for this Drawing instance
   * @type {TileConfig}
   */
  get sheet() {
    if (!this._sheet) this._sheet = new DrawingConfig(this);
    return this._sheet;
  }

  canChain() {
    return ["polygon", "freehand"].includes(this.data.type)
  }

  canEdit() {
    return game.user.isGM || this.owner == game.user.id
  }
  get type() {
    return this.data.type;
  }
  get fillColor() {
    return this.data.fillColor ? this.data.fillColor.replace("#", "0x") : 0x000000;
  }
  get strokeColor() {
    return this.data.strokeColor ? this.data.strokeColor.replace("#", "0x") : 0x000000;
  }
  get usesFill() {
    return [DRAWING_FILL_TYPE.SOLID,
    DRAWING_FILL_TYPE.PATTERN,
    DRAWING_FILL_TYPE.STRETCH].includes(this.data.fill) &&
      this.type != "text"
  }
  get usesTexture() {
    return [DRAWING_FILL_TYPE.PATTERN,
    DRAWING_FILL_TYPE.STRETCH,
    DRAWING_FILL_TYPE.CONTOUR].includes(this.data.fill) &&
      this.data.texture
  }

  // FIXME: Server side code - unmodified create/update/delete functions other than for
  // using FakeServer instead of SocketInterface.
  static async create(sceneId, data, options = {}) {
    const name = this.name,
      preHook = 'preCreate' + name,
      eventData = { parentId: sceneId, data: data };
    return FakeServer.trigger('create' + name, eventData, options, preHook, this).then(response => {
      const object = this.layer._createPlaceableObject(response);
      if (options.displaySheet) object.sheet.render(true);
      return object;
    });
  }
  async update(sceneId, data, options = {}) {
    const name = this.constructor.name,
      preHook = 'preUpdate' + name;

    // Diff the update data
    delete data.id;
    let changed = {};
    for (let [k, v] of Object.entries(data)) {
      let c = getProperty(this.data, k);
      if (c !== v) changed[k] = v;
    }
    if (!Object.keys(changed).length) return Promise.resolve(this);
    changed.id = this.id;

    // Trigger the socket event and handle response
    const eventData = { parentId: sceneId, data: changed };
    await FakeServer.trigger('update' + name, eventData, options, preHook, this).then(response => {
      return this.constructor.layer._updatePlaceableObject(response);
    });
  }
  async delete(sceneId, options = {}) {
    const name = this.constructor.name,
      preHook = 'preDelete' + name,
      eventData = { parentId: sceneId, childId: this.id };
    return await FakeServer.trigger('delete' + name, eventData, options, preHook, this).then(response => {
      return this.constructor.layer._deletePlaceableObject(response);
    });
  }

  /* -------------------------------------------- */
  /* Rendering                                    */
  /* -------------------------------------------- */

  /**
   * Draw a single tile
   * @return {Promise}
   */
  async draw() {
    this.clear();
    // Create child elements
    this.texture = null;
    if (this.usesTexture) {
      try {
        this.texture = await loadTexture(this.data.texture);
        // Ensure playback state for videos
        let source = this.texture.baseTexture.source;
        if (source && source.tagName === "VIDEO") {
          source.loop = true;
          source.muted = true;
          source.play();
        }
      } catch {
        this.texture = null;
      }
    }
    if (this.texture) {
      this.bg = this.addChild(new PIXI.Container());
      let sprite = null
      if (this.data.fill == DRAWING_FILL_TYPE.PATTERN)
        sprite = new PIXI.extras.TilingSprite(this.texture)
      else if (this.data.fill == DRAWING_FILL_TYPE.STRETCH || this.data.fill == DRAWING_FILL_TYPE.CONTOUR)
        sprite = new PIXI.Sprite(this.texture);
      this.bg.tile = this.bg.addChild(sprite)
    } else {
      this.bg = null
    }

    if (this.data.type == "text")
      this.img = this.addChild(new PIXI.Text(''));
    else
      this.img = this.addChild(new PIXI.Graphics());
    this.frame = this.addChild(new PIXI.Graphics());
    this.scaleHandle = this.addChild(new PIXI.Graphics());

    // Render the Tile appearance
    this.refresh();

    // Enable interaction - only if the Tile has an ID
    if (this.id) {
      this.interactive = true;

      // Tile control
      new HandleManager(this, this.layer, {
        mouseover: event => this._onMouseOver(event),
        mouseout: event => this._onMouseOut(event),
        mousemove: event => this._onMouseMove(event),
        mousedown: event => this._onMouseDown(event),
        mouseup: event => this._onMouseUp(event),
        doubleleft: event => this._onDoubleLeft(event),
        rightdown: event => this._onRightDown(event),
        cancel: event => this._onDragCancel(event)
      }, {
          candrag: event => !this.data.locked,
          canright: event => this._controlled,
          canclick: event => this._controlled || game.activeTool == "select",
          canhover: event => this._controlled || game.activeTool == "select"
        });

      // Scale handler
      new HandleManager(this.scaleHandle, this.layer, {
        mouseover: event => this._onHandleMouseOver(event),
        mouseout: event => this._onHandleMouseOut(event),
        mousedown: event => this._onHandleMouseDown(event),
        mousemove: event => this._onHandleMouseMove(event),
        mouseup: event => this._onHandleMouseUp(event)
      }, {
          canclick: event => !this.data.locked
        });
    }

    // Return the drawn Tile
    return this;
  }

  updateMovePosition(position) {
    let type = this.data.type;

    console.log("Update move position : ", position)
    if (type == "rectangle" || type == "ellipse") {
      this._updateDimensions(position, { snap: false })
    } else if (type == "freehand") {
      this.data.points.push([position.x, position.y])
    } else if (type == "polygon") {
      if (this.data.points.length > 1)
        this.data.points.pop()
      this.data.points.push([position.x, position.y])
    }
  }
  /* -------------------------------------------- */
  refresh() {
    // PIXI.Text doesn't have a `.clear()`
    if (this.img instanceof PIXI.Graphics)
      this.img.clear().lineStyle(this.data.strokeWidth, this.strokeColor, this.data.strokeAlpha)
    if (this.usesFill)
      this.img.beginFill(this.fillColor, this.data.fillAlpha);
    if (this.data.type == "rectangle") {
      this.renderRectangle()
    } else if (this.data.type == "ellipse") {
      this.renderEllipse()
    } else if (this.data.type == "polygon") {
      this.renderPolygon()
    } else if (this.data.type == "freehand") {
      this.renderFreehand()
    } else if (this.data.type == "text") {
      this.renderText()
    }

    // Handle Filling data
    if (this.usesFill) {
      this.img.endFill()
    }

    if (this.bg) {
      this.bg.alpha = this.data.textureAlpha
      if (this.data.fill == DRAWING_FILL_TYPE.PATTERN) {
        this.bg.tile.width = this.data.width;
        this.bg.tile.height = this.data.height;
      } else {
        // PIXI.Sprite does not like negative width/height, and the TilingSprite does not like having its position set.
        this.bg.tile.position.set(this.data.width > 0 ? 0 : this.data.width, this.data.height > 0 ? 0 : this.data.height)
        this.bg.tile.width = Math.abs(this.data.width);
        this.bg.tile.height = Math.abs(this.data.height);
      }
      if (this.data.fill == DRAWING_FILL_TYPE.PATTERN &&
        this.data.textureWidth > 0 && this.data.textureHeight > 0) {
        let scale_x = this.data.textureWidth / this.texture.width;
        let scale_y = this.data.textureHeight / this.texture.height;
        this.bg.tile.tileScale.set(scale_x, scale_y)
      }
      // Can't clone a PIXI.Text
      if (this.img instanceof PIXI.Graphics) {
        if (this.bg.tile.mask) this.bg.removeChild(this.bg.tile.mask).destroy({ children: true })
        this.bg.tile.mask = this.bg.addChild(this.img.clone());
      } else {
        this.bg.tile.mask = this.img;
      }
      // In case of polygons being out of bounds/scaled, the `this.img.cone()`
      // does not copy the position/scale so we need to do it manually.
      this.bg.tile.mask.position = this.img.position;
      this.bg.tile.mask.scale = this.img.scale;
    }

    // Set Tile position, rotation and alpha
    this.alpha = 1;
    this.pivot.set(this.data.width / 2, this.data.height / 2);
    this.rotation = toRadians(this.data.rotation);
    this.position.set(this.data.x + this.pivot.x, this.data.y + this.pivot.y);
    this.img.alpha = this.data.hidden ? 0.5 : 1.0;

    // Draw scale handle
    this.scaleHandle.position.set(this.data.width, this.data.height);
    this.scaleHandle.clear().lineStyle(2.0, 0x000000).beginFill(0xFF9829, 1.0).drawCircle(0, 0, 6.0);

    // Draw border frame
    this.frame.clear().lineStyle(2.0, 0x000000).drawRect(0, 0, this.data.width, this.data.height);

    // Toggle visibility
    this.visible = !this.data.hidden || game.user.isGM;
    this.frame.visible = this._controlled && this.id;
    this.scaleHandle.visible = this.frame.visible && !this.data.locked;

    // Reset hit area. img doesn't set a hit area automatically if we don't use 'fill',
    // so we need to manually define it. Also take into account negative width/height.
    let hit_x = this.data.width > 0 ? 0 : this.data.width;
    let hit_y = this.data.height > 0 ? 0 : this.data.height;
    this.img.hitArea = this.img.getLocalBounds()

  }

  renderRectangle() {
    let half_stroke = this.data.strokeWidth / 2;
    this.img.drawRect(half_stroke, half_stroke, this.data.width - 2 * half_stroke, this.data.height - 2 * half_stroke);
  }

  renderEllipse() {
    let half_width = this.data.width / 2;
    let half_height = this.data.height / 2;
    let half_stroke = this.data.strokeWidth / 2;
    this.img.drawEllipse(half_width, half_height, Math.abs(half_width) - half_stroke, Math.abs(half_height) - half_stroke);
  }

  renderFreehand() {
    let point = this.data.points[0]
    let ox = point[0];
    let oy = point[1];
    this.img.moveTo(0, 0)
    // FIXME: why the strokeWidth / 4? in theory the width is in pixels, so half of it
    // means the radius of the 
    this.img.arc(0, 0, this.data.strokeWidth / 4, 0, Math.PI * 2)

    for (let i = 1; i < this.data.points.length; i++) {
      //for (let point of this.data.points) {
      point = this.data.points[i];
      this.img.lineTo(point[0] - ox, point[1] - oy)
      //this.img.arc(point[0] - ox, point[1] - oy, this.data.strokeWidth /2, 0, Math.PI * 2)
    }
    this.img.arc(point[0] - ox, point[1] - oy, this.data.strokeWidth / 4, 0, Math.PI * 2)
    this._handlePolygonBounds(this.img)
  }
  renderPolygon() {
    this.renderFreehand()
  }

  _handlePolygonBounds() {
    this._handleUnshapedBounds()
    let bounds = this.img.getLocalBounds()
    if (this.id === undefined) {
      /* If the polygon is currently being drawn and we move to negative values
       * from our starting point, then shift our x/y position appropriately to have
       * the correct hit area and background pattern.
       */
      this.data.x = this.data.points[0][0] + bounds.x;
      this.data.y = this.data.points[0][1] + bounds.y;
    }
    this.img.position.set(-bounds.x * this.img.scale.x, -bounds.y * this.img.scale.y)
  }
  _handleUnshapedBounds() {
    let bounds = this.img.getLocalBounds()
    let scale_x = 1;
    let scale_y = 1;
    if (this.id || this.id === null) {
      if (bounds.width > 0 && bounds.height > 0) {
        scale_x = this.data.width / bounds.width;
        scale_y = this.data.height / bounds.height;
      }
    } else if (this.id === undefined) {
      /* A bit ugly but `this.id == null` means we're moving the drawing,
       * and `this.id == undefined` means it's being currently drawn.
       * Here, we update the width/height and set the polygon position relative
       * to the starting point's bounds.
       */
      this.data.width = bounds.width;
      this.data.height = bounds.height;
    }
    this.img.scale.set(scale_x, scale_y)
  }

  renderText() {
    this.img.style = {
      fontFamily: this.data.fontFamily,
      fontSize: this.data.fontSize,
      fill: this.data.fillColor,
      stroke: this.data.strokeColor,
      strokeThickness: this.data.strokeWidth,
      wordWrap: this.data.wordWrap
    }
    this.img.text = this.data.content || "Hello World!"
    this._handleUnshapedBounds()
  }


  /* -------------------------------------------- */

  /**
   * Update the tile dimensions given a requested destination point
   * @param {Object} dest
   * @param {Boolean} snap
   * @param {Boolean} constrain
   * @private
   */
  _updateDimensions(dest, { snap = true } = {}) {

    // Determine destination position
    if (snap) dest = canvas.grid.getSnappedPosition(dest.x, dest.y);

    // Determine change
    let dx = dest.x - this.data.x,
      dy = dest.y - this.data.y;
    if (dx === 0) dest.x = this.data.x + canvas.dimensions.size * Math.sign(this.data.width);
    if (dy === 0) dest.y = this.data.y + canvas.dimensions.size * Math.sign(this.data.height);

    // Resize, ignoring aspect ratio
    this.data.width = dest.x - this.data.x;
    this.data.height = dest.y - this.data.y;

  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */


  /**
   * Handle click event on a hovered tile
   * @private
   */
  _onMouseDown(event) {
    // Remove the active Tile HUD
    canvas.hud.drawing.clear();
    // Control the Tile
    this.control();
  }

  /**
   * Event-handling logic for a right-mouse click event on the Tile container
   * @param {PIXI.interaction.InteractionEvent} event
   * @private
   */
  _onRightDown(event) {
    const hud = canvas.hud.drawing,
      state = hud._displayState;
    if (hud.object === this && state !== hud.constructor.DISPLAY_STATES.NONE) hud.clear();
    else hud.bind(this);
  }

}
