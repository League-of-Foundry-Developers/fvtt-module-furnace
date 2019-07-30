/**
 * Drawing Config Sheet
 * @type {FormApplication}
 *
 * @params drawing {Drawing}                The Drawing object being configured
 * @params options {Object}           Additional application rendering options
 * @params options.preview {Boolean}  Configure a preview version of a drawing which is not yet saved
 */
class DrawingConfig extends FormApplication {

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = "drawing-config";
    options.classes = ["sheet", "drawing-sheet"];
    options.title = "Drawing Configuration";
    // FIXME: module-to-core change path
    options.template = "public/modules/furnace/templates/drawing-config.html";
    options.width = 400;
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    let availableFonts = {}
    for (let font of FONTS._loaded)
      availableFonts[font] = font;
    for (let font in CONFIG.WebSafeFonts)
      availableFonts[CONFIG.WebSafeFonts[font]] = font;
    return {
      object: duplicate(this.object.data),
      enableTypeSelection: false,
      options: this.options,
      drawingTypes: CONFIG.drawingTypes,
      fillTypes: CONFIG.drawingFillTypes,
      availableFonts: availableFonts,
      submitText: this.preview ? "Create" : "Update"
    }
  }

  /* Make it interactive a little */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("select[name=fill]").change((ev) => this.updateFields(html))
    html.find("button[name=reset]").click((ev) => this.reset(ev, html))
    html.find("input,textarea,select").change((ev) => this.refresh(html))
    this.updateFields(html)
  }

  updateFields(html) {
    // Get fill/drawing type. Use html because of the DrawingDefaultsConfig subclass.
    let fillType = Number(html.find("select[name=fill]").val())
    let drawingType = html.find("select[name=type]").val()
    // Determine what options are to be available and which aren't
    let enableFillOptions = (fillType != DRAWING_FILL_TYPE.NONE &&
      fillType != DRAWING_FILL_TYPE.CONTOUR &&
      fillType != DRAWING_FILL_TYPE.FRAME)
    let enableTextureOptions = (fillType == DRAWING_FILL_TYPE.PATTERN ||
      fillType == DRAWING_FILL_TYPE.STRETCH ||
      fillType == DRAWING_FILL_TYPE.CONTOUR ||
      fillType == DRAWING_FILL_TYPE.FRAME)
    let enableTextureSizeOptions = (fillType == DRAWING_FILL_TYPE.PATTERN)
    let showTextOptions = drawingType == "text";

    // Enable/Disable various options by setting their opacity and pointer-events.
    let enable = { "pointer-events": "unset", "opacity": 1.0 };
    let disable = { "pointer-events": "none", "opacity": 0.5 };
    html.find("input[name=fillColor],input[name=fillAlpha]")
      .closest(".form-group").css(enableFillOptions ? enable : disable)
    html.find(".fill-section .notes,.texture-section").css(enableTextureOptions ? enable : disable)
    html.find("input[name=textureWidth],input[name=textureHeight]")
      .closest(".form-group").css(enableTextureSizeOptions ? enable : disable)
    // Show/hide text options and fillAlpha
    html.find(".text-section")[showTextOptions ? "show" : "hide"]()
    html.find("input[name=fillAlpha]").closest(".form-group")[!showTextOptions ? "show" : "hide"]()
    // FIXME: module-to-core sanity check server side, contour fill isn't valid for text.
    html.find(`option[value=${DRAWING_FILL_TYPE.CONTOUR}],option[value=${DRAWING_FILL_TYPE.FRAME}]`).attr("disabled", showTextOptions)
    this.resizeFormWindow(html)
  }

  resizeFormWindow(html) {
    let div_height = html.filter(".empty-space").outerHeight(true);
    let app_height = html.closest(".app").height();
    html.closest(".app").height(app_height - div_height);
  }

  reset(ev, html) {
    let type = html.find("select[name=type]").val()
    ev.preventDefault();
    let defaults = canvas.drawings.getDefaultData(type)
    for (let input of html.find("input")) {
      let name = input.getAttribute("name")
      if (!["id", "x", "y", "width", "height", "owner", "hidden", "locked", "flags"].includes(name))
        input.value = defaults[name]
    }
    html.find("select[name=fill]").val(defaults["fill"])
    this.updateFields(html)
    this.refresh(html)
  }

  async refresh(html) {

    let realData = this.object.data;

    if (html) {
      // Temporarily change the object's data in order to preview changes
      let newData = validateForm(html[0]);
      // Add missing items like 'type' from disabled field.
      this.object.data = mergeObject(newData, realData, { overwrite: false });
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
    if (!this.object.owner) throw "You do not have the ability to configure a Drawing object.";
    if (this.object.id) {
      formData["id"] = this.object.id;
      this.object.update(canvas.scene._id, formData)
        .then(() => this.object.layer.updateStartingData(this.object))
    } else {
      // Creating a new object will need to have things that aren't in the form
      //such as 'type' which is disabled and therefore automatically skipped from the data.
      mergeObject(this.object.data, formData);
      // Refreshing will cause sizes to be recalculated first
      this.object.refresh();
      this.object.constructor.create(canvas.scene._id, this.object.data);
    }
  }

  /* -------------------------------------------- */

  /**
   * Extend the application close method to clear any preview if one exists
   */
  close() {
    super.close();
    if (this.preview) {
      this.preview.removeChildren();
      this.preview = null;
    }
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
class DrawingDefaultsConfig extends DrawingConfig {
  constructor(object, options) {
    super(object, options);

    // this.object here is actually the Drawingslayer
    this._defaults = {}
    this.type = "rectangle"
    for (let type of ["rectangle", "ellipse", "text", "polygon", "freehand"]) {
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
      drawingTypes: CONFIG.drawingTypes,
      fillTypes: CONFIG.drawingFillTypes,
      submitText: "Set New Drawing Defaults"
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
    let tool = formData.type;
    if (tool == "rectangle")
      tool = "shape";
    else if (tool == "ellipse")
      tool = "shape";
    ui.controls.controls[ui.controls.activeControl].activeTool = tool;
    ui.controls.render();
  }

}