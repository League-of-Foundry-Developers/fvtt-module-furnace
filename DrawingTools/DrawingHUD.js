
/**
 * An implementation of the PlaceableHUD base class which renders a heads-up-display interface for Drawing objects.
 * @type {BasePlaceableHUD}
 */
class FurnaceDrawingHUD extends DrawingHUD {
  // Override the constructor's name
  /*static get name() {
    return "DrawingHUD"
  }*/
  /**
   * Assign the default options which are supported by the entity edit sheet
   * @type {Object}
   */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "modules/furnace/templates/drawing-hud.html"
    });
  }
  
  getData() {
    const data = super.getData();
    return mergeObject(data, {
      isText: this.object.type == CONST.DRAWING_TYPES.TEXT,
      mirrorVertClass: this.object.getFlag("furnace", "mirrorVert") ? "active" : "",
      mirrorHorizClass: this.object.getFlag("furnace", "mirrorHoriz") ? "active" : "",
    });
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  setPosition() {
    let width = this.object.data.width
    let height = this.object.data.height
    let x = this.object.data.x + (width > 0 ? 0 : width)
    let y = this.object.data.y + (height > 0 ? 0 : height)
    const position = {
      width: Math.abs(width) + 150,
      height: Math.abs(height) + 20,
      left: x - 70,
      top: y - 5
    };
    this.element.css(position);
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners which provide interactivity for the Token HUD application
   * @param html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".config").click(this._onDrawingConfig.bind(this));
    html.find(".mirror-vert").click(this._onMirror.bind(this, true));
    html.find(".text-autofit").click(this._onTextAutofit.bind(this));
    html.find(".mirror-horiz").click(this._onMirror.bind(this, false));
    // Color change inputs
    html.find('input[type="color"]').change(this._onColorPickerChange.bind(this));
  }

  /* -------------------------------------------- */
  async _onColorPickerChange(event) {
    event.preventDefault();
    const drawings = this.object._controlled ? canvas.drawings.controlled : [this.object];
    await canvas.scene.updateEmbeddedEntity('Drawing', drawings.map(d => {
      let data = { _id: d.id, [event.target.name]: event.target.value }
      // If user sets a fill color but fill is NONE then change it
      if (event.target.name == "fillColor" && d.fillType == FURNACE_DRAWING_FILL_TYPE.NONE)
        data.fillType = FURNACE_DRAWING_FILL_TYPE.SOLID;
      return data
    }), { updateKeys: ["fillType", event.target.name] })
    this.render()
    this.object.layer.updateStartingData(this.object)
  }

  _onToggleVisibility(event) {
    this._onToggleField(event, "hidden")
  }
  _onToggleLocked(event) {
    this._onToggleField(event, "locked")
  }
  _onMirror(vertical, event) {
    this._onToggleField(event, "flags.furnace.mirror" + (vertical ? "Vert" : "Horiz"))
  }

  _onToggleField(event, field) {
    event.preventDefault();
    let isEnabled = getProperty(this.object.data, field);
    $(event.currentTarget).toggleClass("active");
    const drawings = this.object._controlled ? canvas.drawings.controlled : [this.object];
    canvas.scene.updateEmbeddedEntity('Drawing', drawings.map(d => {
      return { _id: d.id, [field]: !isEnabled  }
    }), { updateKeys: [field] })
  }
  _onTextAutofit(event) {
    event.preventDefault();
    const drawings = this.object._controlled ? canvas.drawings.controlled : [this.object];
    canvas.scene.updateEmbeddedEntity('Drawing', drawings.map(d => {
      const bounds = d.img.getLocalBounds();
      return { _id: d.id, width: bounds.width, height: bounds.height }
    }), { updateKeys: ["width", "height"] })
  }

  /**
   * Handle Drawing configuration button click
   * @private
   */
  _onDrawingConfig(event) {
    event.preventDefault();
    this.object.sheet.render(true);
  }
}

