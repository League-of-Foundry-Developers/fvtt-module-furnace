/**
 * Drawing Config Sheet
 * @type {FormApplication}
 *
 * @params drawing {Drawing}                The Drawing object being configured
 * @params options {Object}           Additional application rendering options
 * @params options.preview {Boolean}  Configure a preview version of a drawing which is not yet saved
 */
class DrawingConfig extends FormApplication {
  constructor(object, options, layer = false) {
    super(object, options);

    this.layer = layer;
    if (layer) {
      this._defaults = {}
      this.type = "rectangle"
      for (let type of ["rectangle", "ellipse", "text", "polygon", "freehand"]) {
        this._defaults[type] = this.object.getStartingData(type);
      }
    }
  }
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
    let data = null;
    let enableTypeSelection = false;
    let submitText = this.options.preview ? "Create" : "Update";

    if (this.layer) {
      data = this._defaults[this.type];
      enableTypeSelection = true;
      submitText = "Set New Drawing Defaults"
    } else {
      data = this.object.data;
    }
    return {
      object: duplicate(data),
      enableTypeSelection: enableTypeSelection,
      options: this.options,
      drawingTypes: CONFIG.drawingTypes,
      fillTypes: CONFIG.drawingFillTypes,
      submitText: submitText
    }
  }

  /* Make it interactive a little */
  activateListeners(html) {
    super.activateListeners(html);
    this.updateFields(html)
    html.find("select[name=type]").change((ev) => this.changeType(html))
    html.find("select[name=fill]").change((ev) => this.updateFields(html))
    html.find("button[name=reset]").click((ev) => this.reset(ev, html))
  }

  updateFields(html) {
    console.log("Updating Fields in ", html)
    let fillType = Number(html.find("select[name=fill]").val())
    let enableFillOptions = (fillType != DRAWING_FILL_TYPE.NONE &&
      fillType != DRAWING_FILL_TYPE.CONTOUR)
    let enableTextureOptions = (fillType == DRAWING_FILL_TYPE.PATTERN ||
      fillType == DRAWING_FILL_TYPE.STRETCH ||
      fillType == DRAWING_FILL_TYPE.CONTOUR)
    let enableTextureSizeOptions = (fillType == DRAWING_FILL_TYPE.PATTERN)
    let enable = { "pointer-events": "unset", "opacity": 1.0 };
    let disable = { "pointer-events": "none", "opacity": 0.5 };
    html.find("input[name=fillColor],input[name=fillAlpha]")
      .closest(".form-group").css(enableFillOptions ? enable : disable)
    html.find(".fill-section .notes,.texture-section").css(enableTextureOptions ? enable : disable)
    html.find("input[name=textureWidth],input[name=textureHeight]")
      .closest(".form-group").css(enableTextureSizeOptions ? enable : disable)
  }

  changeType(html) {
    let newType = html.find("select[name=type]").val();
    let data = validateForm(html[0]);
    data.type = this.type
    this._defaults[this.type] = data
    this.type = newType
    this.render(true);
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

  }

  /* -------------------------------------------- */

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  _updateObject(event, formData) {
    if (this.layer) {
      // Get the data from the current page, and data saved from the other pages
      this._defaults[formData.type] = formData
      for (let type in this._defaults) {
        this.object.updateStartingData({ data: this._defaults[type] })
      }
    } else {
      if (!this.object.canEdit()) throw "You do not have the ability to configure a Drawing object.";
      if (this.object.id) {
        formData["id"] = this.object.id;
        this.object.update(canvas.scene._id, formData)
          .then(() => this.object.layer.updateStartingData(this.object))
      }
      else this.object.constructor.create(canvas.scene._id, formData);
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
  }
}
