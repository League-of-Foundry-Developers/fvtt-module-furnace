/**
 * Drawing Config Sheet
 * @type {FormApplication}
 *
 * @params drawing {Drawing}                The Drawing object being configured
 * @params options {Object}           Additional application rendering options
 * @params options.preview {Boolean}  Configure a preview version of a drawing which is not yet saved
 */
class FurnaceDrawingConfig extends DrawingConfig {
  constructor() {
    super(...arguments)
    this._tabs[0].active = "settings";
  }
  // Override the constructor's name
  /*static get name() {
    return "DrawingConfig"
  }*/
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.classes = ["sheet", "drawing-sheet"];
    options.title = game.i18n.localize("FURNACE.DRAWINGS.ConfigTitle");
    options.template = "modules/furnace/templates/drawing-config.html";
    options.height = 'auto';
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    let data = duplicate(this.object.data)
    data.fillType = this.object.fillType
    data.textureWidth = this.object.textureWidth
    data.textureHeight = this.object.textureHeight
    data.textureAlpha = this.object.textureAlpha
    return {
      object: data,
      enableTypeSelection: false,
      options: this.options,
      drawingTypes: CONFIG.furnaceDrawingTypes,
      fillTypes: CONFIG.furnaceDrawingFillTypes,
      availableFonts: this.getAvailableFonts(),
      submitText: game.i18n.localize(`FURNACE.DRAWINGS.${this.preview ? "createDrawing" : "updateDrawing"}`)
    }
  }

  getAvailableFonts() {
    let availableFonts = {}
    for (let font of CONFIG.fontFamilies)
      availableFonts[font] = font;
    for (let [font, family] of Object.entries(CONFIG.WebSafeFonts))
      availableFonts[font] = family;
    return availableFonts;
  }
  /* Make it interactive a little */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("select[name=fillType]").change((ev) => this.updateFields(html))
    html.find("button[name=reset]").click((ev) => this.reset(ev, html))
    html.find("input,select").change((ev) => this.refresh(html))
    html.find("textarea").on('input', (ev) => this.refresh(html))
    this.updateFields(html)
    html.find("textarea").focus()
  }

  updateFields(html) {
    // Get fill/drawing type. Use html because of the DrawingDefaultsConfig subclass.
    let fillType = Number(html.find("select[name=fillType]").val())
    let drawingType = html.find("select[name=type]").val()
    // Determine what options are to be available and which aren't
    let enableFillOptions = (fillType != FURNACE_DRAWING_FILL_TYPE.NONE &&
      fillType != FURNACE_DRAWING_FILL_TYPE.CONTOUR &&
      fillType != FURNACE_DRAWING_FILL_TYPE.FRAME)
    let enableTextureOptions = (fillType == FURNACE_DRAWING_FILL_TYPE.PATTERN ||
      fillType == FURNACE_DRAWING_FILL_TYPE.STRETCH ||
      fillType == FURNACE_DRAWING_FILL_TYPE.CONTOUR ||
      fillType == FURNACE_DRAWING_FILL_TYPE.FRAME)
    let enableTextureSizeOptions = (fillType == FURNACE_DRAWING_FILL_TYPE.PATTERN)
    let showBezierOptions = (drawingType == CONST.DRAWING_TYPES.POLYGON || drawingType == CONST.DRAWING_TYPES.FREEHAND);
    let showTextOptions = drawingType == CONST.DRAWING_TYPES.TEXT;

    // Enable/Disable various options by setting their opacity and pointer-events.
    let enable = { "pointer-events": "unset", "opacity": 1.0 };
    let disable = { "pointer-events": "none", "opacity": 0.5 };
    html.find("input[name=fillColor],input[name=fillAlpha]")
      .closest(".form-group").css(enableFillOptions ? enable : disable)
    html.find(".fill-section .notes,.texture-section").css(enableTextureOptions ? enable : disable)
    html.find("input[name=textureWidth],input[name=textureHeight]")
      .closest(".form-group").css(enableTextureSizeOptions ? enable : disable)
    // Show/hide text options and fillAlpha
    //html.find(".text-section")[showTextOptions ? "show" : "hide"]()
    html.find("input[name=fillAlpha]").closest(".form-group")[!showTextOptions ? "show" : "hide"]()
    html.find("input[name=fillColor]").closest(".form-group")[!showTextOptions ? "show" : "hide"]()
    html.find("input[name=strokeAlpha]").closest(".form-group")[!showTextOptions ? "show" : "hide"]()
    html.find("input[name=bezierFactor]").closest(".form-group")[showBezierOptions ? "show" : "hide"]()
    // FIXME: module-to-core sanity check server side, contour fill isn't valid for text.
    html.find(`option[value=${FURNACE_DRAWING_FILL_TYPE.CONTOUR}],option[value=${FURNACE_DRAWING_FILL_TYPE.FRAME}]`).attr("disabled", showTextOptions)
  }


  reset(ev, html) {
    ev.preventDefault();
    let type = html.find("select[name=type]").val()
    let defaults = canvas.drawings.getDefaultData(type)
    for (let input of html.find("input")) {
      let name = input.getAttribute("name")
      // FIXME: flags
      if (!["id", "x", "y", "z", "width", "height", "owner", "hidden", "locked", "flags"].includes(name))
        input.value = defaults[name]
    }
    html.find("select[name=fillType]").val(defaults["fillType"])
    this.updateFields(html)
    this.refresh(html)
  }

  fixData(data) {
    data["flags.furnace"] = {
      textureWidth: data.textureWidth,
      textureHeight: data.textureHeight,
      textureAlpha: data.textureAlpha,
      fillType: null
    }
    if (!Object.values(CONST.DRAWING_FILL_TYPES).includes(data.fillType)) {
      data["flags.furnace"]["fillType"] = data.fillType;
      data.fillType = CONST.DRAWING_FILL_TYPES.PATTERN;
    }
    delete data.textureWidth
    delete data.textureHeight
    delete data.textureAlpha
    return data
  }

  async refresh(html) {

    let realData = this.object.data;

    if (html) {
      // Temporarily change the object's data in order to preview changes
      let newData = this.fixData(validateForm(html[0]));
      // Add missing items like 'type' from disabled field.
      this.object.data = mergeObject(realData, newData, { inplace: false });
    }
    // We actually call draw here and not refresh in case we changed the texture but also
    // because if we get a full redraw due to another user creating their own drawings,
    // then the refresh will fail because the object's PIXI elements will have been destroyed.
    // FIXME: not sure what happens to the sheet in that case? would the object itself become
    // invalid or would it still work anyway?
    await this.object.draw();
    this.object.data = realData;
  }

  /* -------------------------------------------- */

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  _updateObject(event, formData) {
    formData = this.fixData(formData)
    if (this.object.id) {
      if (!this.object.owner) throw  game.i18n.localize("FURNACE.DRAWINGS.NotAuthorizedToConfigure");
      formData["id"] = this.object.id;
      this.object.update(formData)
        .then(() => this.object.layer.updateStartingData(this.object))
    } else {
      // Creating a new object will need to have things that aren't in the form
      //such as 'type' which is disabled and therefore automatically skipped from the data.
      mergeObject(this.object.data, formData);
      // Refreshing will cause sizes to be recalculated first
      this.object.refresh();
      this.object.constructor.create(this.object.data);
    }
  }

  _onRangeChange(event) {
	  event.preventDefault();
    let span = $(event.target).siblings(".range-value");
    let percent = Math.floor(event.target.value * 100)
	  span.text(percent + "%");
  }
  /* -------------------------------------------- */

  /**
   * Extend the application close method to clear any preview if one exists
   */
  close() {
    super.close();
    // Refresh in case we changed anything
    this.refresh();
  }
}

/**
 * Drawing Config Sheet for Default values
 * @type {FormApplication}
 *
 * @params drawing {Drawing}                The Drawing object being configured
 * @params options {Object}           Additional application rendering options
 * @params options.preview {Boolean}  Configure a preview version of a drawing which is not yet saved
 */
class DrawingDefaultsConfig extends FurnaceDrawingConfig {
  constructor(object, type, options) {
    super(object, options);

    // this.object here is actually the Drawingslayer
    this._defaults = {}
    this.type = type || CONST.DRAWING_TYPES.RECTANGLE
    for (let type of Object.values(CONST.DRAWING_TYPES)) {
      this._defaults[type] = this.object.getStartingData(type);
    }
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    return {
      object: duplicate(this._defaults[this.type]),
      enableTypeSelection: true,
      options: this.options,
      drawingTypes: CONFIG.furnaceDrawingTypes,
      fillTypes: CONFIG.furnaceDrawingFillTypes,
      availableFonts: this.getAvailableFonts(),
      submitText: game.i18n.localize("FURNACE.DRAWINGS.setDefaults")
    }
  }

  /* List to changing the type of of Drawing to set */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("select[name=type]").change((ev) => this.changeType(html))
  }

  /* When the user switches types, save their data for that type and re-render */
  changeType(html) {
    // Get the current saved settings. Override data.type since it has the new type.
    let data = validateForm(html[0]);
    let newType = data.type;
    data.type = this.type;
    this._defaults[this.type] = data;
    this.type = newType;

    // Re-render the sheet with the new type data
    this.render(true);
  }

  refresh() {
    // We don't need to refresh anything in this case.
  }
  /* -------------------------------------------- */

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  _updateObject(event, formData) {
    // Get the data from the current page, and data saved from the other pages
    this._defaults[formData.type] = formData
    for (let type in this._defaults) {
      this.object.updateStartingData({ data: this._defaults[type] })
    }
    // Set the tool to the last configured type.
    let tool = "select";
    let tools = ui.controls.control.tools.map(t => t.name)
    for (let t of tools) {
      if (t[0] === formData.type) {
        tool = t;
        break;
      }
    }
    ui.controls.control.activeTool = tool;
    ui.controls.render();
  }

}