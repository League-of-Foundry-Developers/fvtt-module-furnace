
/**
 * An implementation of the PlaceableHUD base class which renders a heads-up-display interface for Drawing objects.
 * @type {BasePlaceableHUD}
 */
class DrawingHUD extends BasePlaceableHUD {
    /**
     * Assign the default options which are supported by the entity edit sheet
     * @type {Object}
     */
    static get defaultOptions() {
	return mergeObject(super.defaultOptions, {
	    // FIXME: module-to-core need to replace tile-hud because I can't add
	    // a different id to the template.
	    id: "tile-hud",
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
	mergeObject(data, CONFIG.Drawing, {inplace: true});
	return mergeObject(data, {
	    lockedClass: data.locked ? "active" : "",
	    visibilityClass: data.hidden ? "active" : "",
	    canEdit: this.object.canEdit()
	});
    }

    /* -------------------------------------------- */

    setPosition() {
	let width = this.object.data.width
	let height = this.object.data.height
	let x = this.object.data.x + (width > 0 ? 0 : width)
	let y = this.object.data.y + (height > 0 ? 0 : height)
	const position = {
	    width: Math.abs(width) + 140,
	    height: Math.abs(height) + 10,
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
	html.find(".visibility").click(this._onToggleVisibility.bind(this));
	html.find(".locked").click(this._onToggleLocked.bind(this));
	html.find(".config").click(this._onDrawingConfig.bind(this));
	// Color change inputs
	html.find('input[type="color"]').change(this._onColorPickerChange.bind(this));
    }

    _onColorPickerChange(event) {
	event.preventDefault();
	let data = {}
	data[event.target.name] = event.target.value
	// If user sets a fill color but fill is NONE then change it
	if (event.target.name == "fillColor" && this.object.data.fill == DRAWING_FILL_TYPE.NONE)
	    data.fill = DRAWING_FILL_TYPE.SOLID;
	this.object.update(canvas.scene._id, data).then(() => {
	    console.log("color : ", this.object.data.fillColor)
	    this.render()
	    this.object.layer.constructor.updateDefaultData(this.object)
	})
    }

    /* -------------------------------------------- */

    /**
     * Toggle Drawing visibility state
     * @private
     */
    async _onToggleVisibility(event) {
	event.preventDefault();
	await this.object.update(canvas.scene._id, {hidden: !this.object.data.hidden});
	$(event.currentTarget).toggleClass("active");
    }

    /* -------------------------------------------- */

    /**
     * Toggle Drawing locked state
     * @private
     */
    async _onToggleLocked(event) {
	event.preventDefault();
	await this.object.update(canvas.scene._id, {locked: !this.object.data.locked});
	$(event.currentTarget).toggleClass("active");
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

