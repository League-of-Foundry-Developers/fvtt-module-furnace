
// Derive from Tile so we don't need to copy/paste all the scale-handle/rotate/dimension/control
// functions here as they would be mostly the same.
// FIXME: keep as is or derive from PlaceableObject and copy/paste the functions we need?
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
   * @type {DrawingConfig}
   */
  get sheet() {
    if (!this._sheet) this._sheet = new DrawingConfig(this);
    return this._sheet;
  }

  /**
   * A Boolean flag for whether the current game User has permission to control this token
   * @type {Boolean}
   */
  get owner() {
    return game.user.isGM || (game.user.isTrusted && this.data.owner == game.user.id)
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
    DRAWING_FILL_TYPE.STRETCH].includes(this.data.fill)
  }
  get usesTexture() {
    return [DRAWING_FILL_TYPE.PATTERN,
    DRAWING_FILL_TYPE.STRETCH,
    DRAWING_FILL_TYPE.CONTOUR,
    DRAWING_FILL_TYPE.FRAME].includes(this.data.fill) &&
      this.data.texture
  }
  get isTiled() {
    return [DRAWING_FILL_TYPE.PATTERN,
    DRAWING_FILL_TYPE.CONTOUR].includes(this.data.fill)
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
    this.bg = null;

    // Try to load the texture if one is set
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

        if (this.texture) {
          let sprite = null
          if (this.isTiled)
            sprite = new PIXI.extras.TilingSprite(this.texture)
          else
            sprite = new PIXI.Sprite(this.texture);
          this.bg = this.addChild(new PIXI.Container());
          this.bg.tile = this.bg.addChild(sprite)
        }
      } catch {
        this.texture = null;
        this.bg = null;
      }
    }

    if (this.type == "text")
      this.img = this.addChild(new PIXI.Text());
    else
      this.img = this.addChild(new PIXI.Graphics());
    this.frame = this.addChild(new PIXI.Graphics());
    this.scaleHandle = this.addChild(new PIXI.Graphics());
    this.rotateHandle = this.addChild(new PIXI.Graphics());

    // Render the Tile appearance
    this.refresh();

    // Enable interaction - only if the Drawing has an ID (not a preview)
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
          canclick: event => this._controlled || (this.owner && game.activeTool == "select"),
          canhover: event => this._controlled || (this.owner && game.activeTool == "select")
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

      // Rotate handler
      new HandleManager(this.rotateHandle, this.layer, {
        mouseover: event => this._onRotateMouseOver(event),
        mouseout: event => this._onRotateMouseOut(event),
        mousedown: event => this._onHandleMouseDown(event),
        mousemove: event => this._onRotateMouseMove(event),
        mouseup: event => this._onRotateMouseUp(event)
      }, {
          canclick: event => !this.data.locked
        });
    }

    // Return the drawn Tile
    return this;
  }

  updateDragPosition(position) {
    if (this.type == "freehand") {
      let now = Date.now();
      let lastMove = this._lastMoveTime || 0
      if (this.data.points.length > 1 && now - lastMove < CONFIG.FREEHAND_SAMPLING_RATE)
        this.data.points.pop();
      else
        this._lastMoveTime = now;

      this.addPolygonPoint(position)
    } else if (this.type == "polygon") {
      if (this.data.points.length > 1)
        this.data.points.pop()
      this.data.points.push([parseInt(position.x), parseInt(position.y)])
    } else {
      this._updateDimensions(position, { snap: false })
    }
  }

  addPolygonPoint(position) {
    // Points should always have at least one point in it (the origin)
    let points = this.data.points;
    let drag = this.data.points.pop();
    let last_point = drag;

    let point = [parseInt(position.x), parseInt(position.y)]

    // Always keep our origin point as the first point
    if (this.data.points.length == 0)
      points.push(drag)
    else
      last_point = points[points.length - 1];
    // First add our polygon point if it's a new point.
    if (point[0] != last_point[0] || point[1] != last_point[1])
      points.push(point)
    // then add our drag position back to the list
    points.push(drag)
  }

  /* -------------------------------------------- */
  refresh() {
    // PIXI.Text doesn't have a `.clear()`
    if (this.img instanceof PIXI.Graphics) {
      this.img.clear().lineStyle(this.data.strokeWidth, this.strokeColor, this.data.strokeAlpha)

      // Set fill if needed
      if (this.usesFill)
        this.img.beginFill(this.fillColor, this.data.fillAlpha);
    }
    // Render the actual shape/drawing
    if (this.type == "rectangle") {
      this.renderRectangle(this.img)
    } else if (this.type == "ellipse") {
      this.renderEllipse(this.img)
    } else if (this.type == "polygon") {
      this.renderPolygon(this.img)
    } else if (this.type == "freehand") {
      this.renderFreehand(this.img)
    } else if (this.type == "text") {
      this.renderText(this.img)
    }

    // Finish filling data
    if (this.img instanceof PIXI.Graphics && this.usesFill)
      this.img.endFill()

    // If a texture background was set, then we render/mask it here.
    if (this.bg) {
      this.bg.alpha = this.data.textureAlpha
      if (this.isTiled) {
        this.bg.tile.width = this.data.width;
        this.bg.tile.height = this.data.height;
      } else {
        // PIXI.Sprite does not like negative width/height, and the TilingSprite does not like having its position set.
        this.bg.tile.position.set(this.data.width > 0 ? 0 : this.data.width, this.data.height > 0 ? 0 : this.data.height)
        this.bg.tile.width = Math.abs(this.data.width);
        this.bg.tile.height = Math.abs(this.data.height);
      }
      if (this.isTiled &&
        this.data.textureWidth > 0 && this.data.textureHeight > 0) {
        let scale_x = this.data.textureWidth / this.texture.width;
        let scale_y = this.data.textureHeight / this.texture.height;
        this.bg.tile.tileScale.set(scale_x, scale_y)
      }
      // Can't clone a PIXI.Text, if mask onto a text, we re-render it.
      if (this.bg.tile.mask) this.bg.removeChild(this.bg.tile.mask).destroy({ children: true })
      if (this.type == "text") {
        this.bg.tile.mask = this.bg.addChild(new PIXI.Text());
        this.renderText(this.bg.tile.mask)
        // Mask is only applied on the red channel for some reason.
        this.bg.tile.mask.alpha = 1.0;
        this.bg.tile.mask.style.fill = 0xFFFFFF;
      } else {
        this.bg.tile.mask = this.bg.addChild(this.img.clone());
      }
      // In case of polygons being out of bounds/scaled, the `this.img.cone()`
      // does not copy the position/scale so we need to do it manually.
      this.bg.tile.mask.position = this.img.position;
      this.bg.tile.mask.scale = this.img.scale;
    }

    // Set Tile position, rotation and alpha
    this.pivot.set(this.data.width / 2, this.data.height / 2);
    this.rotation = toRadians(this.data.rotation);
    this.position.set(this.data.x + this.pivot.x, this.data.y + this.pivot.y);
    this.alpha = this.data.hidden ? 0.5 : 1.0;

    // Draw scale handle
    this.scaleHandle.position.set(this.data.width, this.data.height);
    this.scaleHandle.clear().lineStyle(2.0, 0x000000).beginFill(0xFF9829, 1.0).drawCircle(0, 0, 6.0);

    // Draw Rotation handle
    this._drawRotateHandle()

    // Draw border frame
    this.frame.clear().lineStyle(2.0, 0x000000).drawRect(0, 0, this.data.width, this.data.height);

    // Toggle visibility
    this.visible = !this.data.hidden || game.user.isGM;
    // Don't show the frame when we're creating a new drawing, unless it's text.
    this.frame.visible = this._controlled && (this.id || this.type == "text");
    this.scaleHandle.visible = this.rotateHandle.visible = this.frame.visible && !this.data.locked;

    // Reset hit area. img doesn't set a hit area automatically if we don't use 'fill',
    // so we need to manually define it. Also take into account negative width/height.
    let hit_x = this.data.width > 0 ? 0 : this.data.width;
    let hit_y = this.data.height > 0 ? 0 : this.data.height;
    this.img.hitArea = this.img.getLocalBounds()

  }

  renderRectangle(graphics) {
    let half_stroke = this.data.strokeWidth / 2;
    graphics.drawRect(half_stroke, half_stroke, this.data.width - 2 * half_stroke, this.data.height - 2 * half_stroke);
  }

  renderEllipse(graphics) {
    let half_width = this.data.width / 2;
    let half_height = this.data.height / 2;
    let half_stroke = this.data.strokeWidth / 2;
    graphics.drawEllipse(half_width, half_height, Math.abs(half_width) - half_stroke, Math.abs(half_height) - half_stroke);
  }

  // Attribution : 
  // The equations for how to calculate the bezier control points are derived from
  // Rob Spencer's article from 2010.
  // http://scaledinnovation.com/analytics/splines/aboutSplines.html
  // Returns the cp1 of the previous point and cp0 of the current point.
  // This is so it's a bit more optimized than calculating the distances
  // twice for each point.
  _bezierControlPoints(factor, previous, point, next) {
    // Get vector of the opposite line
    let vector = { x: next.x - previous.x, y: next.y - previous.y };

    // Calculate the proportional sizes of each neighboring line
    let precedingDistance = Math.hypot(previous.x - point.x, previous.y - point.y);
    let followingDistance = Math.hypot(point.x - next.x, point.y - next.y);
    let totalDistance = precedingDistance + followingDistance;
    let cp0Distance = factor * (precedingDistance / totalDistance);
    let cp1Distance = factor * (followingDistance / totalDistance);
    if (totalDistance == 0)
      cp0Distance = cp1Distance = 0;
    // Calculate the control points as porportional from our point in the direction of the
    // hypothenus' vector, in either direction from our central point
    return {
      cp1: {
        x: point.x - vector.x * cp0Distance,
        y: point.y - vector.y * cp0Distance
      },
      next_cp0: {
        x: point.x + vector.x * cp1Distance,
        y: point.y + vector.y * cp1Distance
      }
    }
  }

  _adjust(origin, point) {
    return {
      x: point[0] - origin[0],
      y: point[1] - origin[1]
    }
  }

  renderFreehand(graphics) {
    let points = this.data.points;
    let origin = points[0];
    let bezierFactor = this.data.bezierFactor || 0;

    graphics.moveTo(0, 0)
    if (points.length > 2) {
      let point = this._adjust(origin, points[1]);
      let previous = this._adjust(origin, origin); // {x:0, y:0};
      let next = this._adjust(origin, points[2]);
      let last = this._adjust(origin, points[points.length - 1]);
      let closedLoop = (last.x == previous.x && last.y == previous.y)
      let cp0;

      // Verify if we're closing a loop here and calculate the previous bezier control point
      if (closedLoop) {
        last = this._adjust(origin, points[points.length - 2]);
        let { next_cp0 } = this._bezierControlPoints(bezierFactor, last, previous, point);
        cp0 = next_cp0;
      }
      // Draw the first line
      let { cp1, next_cp0 } = this._bezierControlPoints(bezierFactor, previous, point, next);
      if (closedLoop)
        graphics.bezierCurveTo(cp0.x, cp0.y, cp1.x, cp1.y, point.x, point.y);
      else
        graphics.quadraticCurveTo(cp1.x, cp1.y, point.x, point.y);
      previous = point;
      point = next;
      cp0 = next_cp0;

      // Draw subsequent lines
      for (let i = 2; i < points.length; i++) {
        if (i == points.length - 1)
          next = this._adjust(origin, points[1]);
        else
          next = this._adjust(origin, points[i + 1]);
        let { cp1, next_cp0 } = this._bezierControlPoints(bezierFactor, previous, point, next);
        // If the last line, draw it as quadratic if it's not a closed loop.
        if (i == points.length - 1 && !closedLoop)
          graphics.quadraticCurveTo(cp0.x, cp0.y, point.x, point.y);
        else
          graphics.bezierCurveTo(cp0.x, cp0.y, cp1.x, cp1.y, point.x, point.y);
        previous = point;
        point = next;
        cp0 = next_cp0;
      }
    } else if (points.length == 2) { // if point.length < 2, don't do anything
      let point = this._adjust(origin, points[1]);
      graphics.lineTo(point.x, point.y)
    }

    // Draw circles on each end point to make it look nicer.
    // an arc with radius 0 makes it not draw anything. so we put radius of 0.1 and let the
    // strokeWidth take care of actually drawing our circle.
    // We also need to move to the angle 0 of the arc otherwise we'd cause a small line
    // from(0, 0) to(0.1, 0) which can have huge effects visually if the stroke width is large enough.
    graphics.moveTo(0.1, 0)
    graphics.arc(0, 0, 0.1, 0, Math.PI * 2)
    if (points.length > 1) {
      let point = this._adjust(origin, points[points.length - 1]);
      graphics.moveTo(point.x + 0.1, point.y)
      this.img.arc(point.x, point.y, 0.1, 0, Math.PI * 2)
    }
    this._handlePolygonBounds(graphics)
  }

  renderPolygon(graphics) {
    this.renderFreehand(graphics)
  }

  renderText(sprite) {
    let lineHeight = this.data.height / this.data.content.split("\n").length
    sprite.style = {
      fontFamily: this.data.fontFamily,
      fontSize: this.data.fontSize,
      fill: this.usesFill ? this.data.fillColor : "transparent",
      stroke: this.data.strokeColor,
      strokeThickness: this.data.strokeWidth,
      wordWrap: this.data.wordWrap,
      wordWrapWidth: this.data.width,
      lineHeight: this.data.wordWrap ? lineHeight : undefined
    }
    sprite.alpha = this.data.strokeAlpha;
    sprite.text = this.data.content;
    this._handleUnshapedBounds(sprite)
  }

  _handlePolygonBounds(graphics) {
    this._handleUnshapedBounds(graphics)
    let bounds = graphics.getLocalBounds()
    if (this.id === undefined) {
      /* If the polygon is currently being drawn and we move to negative values
       * from our starting point, then shift our x/y position appropriately to have
       * the correct hit area and background pattern.
       */
      this.data.x = this.data.points[0][0] + bounds.x;
      this.data.y = this.data.points[0][1] + bounds.y;
    }
    graphics.position.set(-bounds.x * graphics.scale.x, -bounds.y * graphics.scale.y)
  }
  _handleUnshapedBounds(graphics) {
    let bounds = graphics.getLocalBounds()
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
    graphics.scale.set(scale_x, scale_y)
  }


  /* -------------------------------------------- */

  /**
   * Get coordinates of a point after a rotation around another point
   * @param {Object} dest
   */
  _rotatePosition(coordinates, axis, angle) {
    // No need to do the math if there is no rotation
    if (angle) {
      // Translate the coordinates so the rotation axis is (0, 0) 
      let x = coordinates.x - axis.x;
      let y = coordinates.y - axis.y;
      
      /**
       *  Formula from https://academo.org/demos/rotation-about-point/
       * x′ = x*cos(θ) − y*sin(θ)
       * y′ = y*cos(θ) + x*sin(θ)
       */
      let new_x = x * Math.cos(angle) - y * Math.sin(angle);
      let new_y = y * Math.cos(angle) + x * Math.sin(angle);
      // Translate back from origin point to our center
      coordinates.x = new_x + axis.x
      coordinates.y = new_y + axis.y
    }
    return coordinates;
  }
  /**
   * Update the tile dimensions given a requested destination point
   * @param {Object} dest
   * @param {Boolean} snap
   * @param {Boolean} constrain
   * @private
   */
  _updateDimensions(dest, { snap = true } = {}) {

    // this.rotation is the PIXI object's rotation which is already in radians
    dest = this._rotatePosition(dest, this.center, -this.rotation)

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

  /**
   * Formula from : https://onlinemschool.com/math/library/vector/angl/
   * cos(α) = (a·b) / (|a|·|b|)
   * If we take our base (rotation 0) vector as (0, -1), then it simplifies
   * the equation into : 
   * cos(α) = -b.y / |b|
   */
  _updateRotation(coordinates) {
    let center = this.center
    let x = coordinates.x - center.x;
    let y = coordinates.y - center.y;
    let sign = Math.sign(this.data.height);

    /**
     * The equation always gives us the shortest angle (< 180), but if our X
     * is positive then we're to the right of the angle 0, and if it's negative,
     *  then we're to the left.
     */
    let angle = Math.acos(sign * -y / Math.hypot(x, y)) * Math.sign(x) * sign;
    this.data.rotation = Math.round(toDegrees(angle))
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Default handling for Placeable mouse-over hover event
   * @private
   * 
   * _onMouseOver could be called if pressing Alt. Don't highlight Drawings we don't own
   * 
   */
  _onMouseOver(event) {
    if (this.owner)
      super._onMouseOver(event);
  }

  /**
   * Handle click event on a hovered tile
   * @private
   */
  _onMouseDown(event) {
    // Remove the active Drawing HUD
    canvas.hud.drawing.clear();
    // Control the Tile
    this.control();
  }

  /**
   * Event-handling logic for a right-mouse click event on the Drawing container
   * @param {PIXI.interaction.InteractionEvent} event
   * @private
   */
  _onRightDown(event) {
    const hud = canvas.hud.drawing,
      state = hud._displayState;
    if (hud.object === this && state !== hud.constructor.DISPLAY_STATES.NONE) hud.clear();
    else hud.bind(this);
  }

  _drawRotateHandle(scale=1) {
    this.rotateHandle.position.set(this.data.width / 2, 0);
    let rotateHandleOffset = Math.sign(this.data.height) * 25;
    let fromAngle = Math.PI / 4;
    let toAngle = 3 * Math.PI / 4;
    let fromPosition = this._rotatePosition({ x: rotateHandleOffset, y: 0 }, { x: 0, y: 0 }, -fromAngle)
    let toPosition = this._rotatePosition({x: rotateHandleOffset, y: 0}, { x: 0, y: 0 }, -toAngle)
    this.rotateHandle.clear()
      // FIXME: PIXI 4.x doesn't finish star lines, so we make it not draw the outline
      // and only use the fill instead.
      .lineStyle(0.0, 0x000000)
      .beginFill(0x000000, 1.0)
      .moveTo(fromPosition.x, fromPosition.y)
      .drawStar(fromPosition.x, fromPosition.y, 3, 6.0 * scale)
      .moveTo(toPosition.x, toPosition.y)
      .drawStar(toPosition.x, toPosition.y, 3, 6.0 * scale)
      .endFill()
      .lineStyle(4.0, 0x000000)
      .moveTo(fromPosition.x, fromPosition.y)
      .arc(0, 0, rotateHandleOffset, -fromAngle, -toAngle, true)
      .lineStyle(2.0, 0x000000)
      .moveTo(0, 0)
      .lineTo(0, -rotateHandleOffset)
      .beginFill(0xFF9829, 1.0)
      .drawCircle(0, -rotateHandleOffset, 6.0 * scale)
      .endFill()
  }
  /**
   * Handle mouse-over event on a control handle
   * @private
   */
  _onRotateMouseOver(event) {
    let {handle} = event.data;
    this._drawRotateHandle(1.5)
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse-out event on a control handle
   * @private
   */
  _onRotateMouseOut(event) {
    let {handle} = event.data;
    this._drawRotateHandle()
  }
  _onRotateMouseMove(event) {
    this._updateRotation(event.data.destination);
    this.refresh();
    this._drawRotateHandle(1.5)
  }

  /* -------------------------------------------- */

  _onRotateMouseUp(event) {
    let { original, destination } = event.data;
    this._updateRotation(destination);

    // Update the tile
    const data = { rotation: this.data.rotation };
    this.data = original;
    this.update(canvas.scene._id, data);
  }

}
