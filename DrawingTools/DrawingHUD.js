
/**
 * An implementation of the PlaceableHUD base class which renders a heads-up-display interface for Drawing objects.
 * @type {BasePlaceableHUD}
 */
class FurnaceDrawingHUD extends BasePlaceableHUD {
  /**
   * Assign the default options which are supported by the entity edit sheet
   * @type {Object}
   */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "drawing-hud",
      template: "public/modules/furnace/templates/drawing-hud.html"
    });
  }

  /* -------------------------------------------- */

  /**
   * Extend the data object provided to render HTML for the Drawing HUD
   * @return {Object}
   */
  getData() {
    const data = super.getData();
    return mergeObject(data, {
      lockedClass: data.locked ? "active" : "",
      visibilityClass: data.hidden ? "active" : ""
    });
  }

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
    // Color change inputs
    html.find('input[type="color"]').change(this._onColorPickerChange.bind(this));
  }

  /* -------------------------------------------- */
  _onColorPickerChange(event) {
    event.preventDefault();
    let data = {}
    data[event.target.name] = event.target.value
    // If user sets a fill color but fill is NONE then change it
    if (event.target.name == "fillColor" && this.object.fillType == FURNACE_DRAWING_FILL_TYPE.NONE)
      data.fillType = FURNACE_DRAWING_FILL_TYPE.SOLID;
    this.object.update(canvas.scene._id, data).then(() => {
      this.render()
      this.object.layer.updateStartingData(this.object)
    })
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

