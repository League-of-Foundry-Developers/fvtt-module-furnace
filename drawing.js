
const DRAWING_FILL_TYPE = {
    "NONE": 0,
    "SOLID": 1,
    "PATTERN": 2,
    "STRETCH": 3,
    "CONTOUR": 4
}

// FIXME: module-to-core
CONFIG.Drawing = duplicate(CONFIG.Tile)
CONFIG.drawingTypes = {
    square: "Rectangle",
    circle: "Ellipsoid",
    text: "Text",
    polygon: "Polygon",
    freehand: "Freehand"
}

CONFIG.drawingFillTypes = {
    0: "None",
    1: "Solid Color",
    2: "Tiled Pattern",
    3: "Stretched Texture",
    4: "Contour Texture"
}

/**
 * The DrawingsLayer subclass of :class:`PlaceablesLayer`
 *
 * This layer implements a container for drawings which are rendered immediately above the :class:`TilesLayer`
 * and immediately below the :class:`GridLayer`
 *
 * @type {PlaceablesLayer}
 */
class DrawingsLayer extends PlaceablesLayer {

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
	// FIXME: module-to-core
	canvas.scene.data.drawings = FakeServer.getData(canvas.scene)
	super.draw();
	return this;
    }

    // FIXME: module-to-core : use of FakeServer.setData instead of canvas.scene.update()
    // Can be removed entirely in core
    deleteAll() {
	const cls = this.constructor.placeableClass;
	if ( !game.user.isGM ) {
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
		    callback: () => {FakeServer.setData(canvas.scene, []).then(() => layer.draw())}
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
	if ( this.objects ) this.objects.visible = true;
    }

    /* -------------------------------------------- */

    _getNewDataFromEvent(event) {
	if ( !event.data.originalEvent.shiftKey ) {
	    event.data.origin = canvas.grid.getSnappedPosition(event.data.origin.x,
							       event.data.origin.y);
	}
	// TODO: Populate with default settings from a singleton sheet/last settings used
	let data = mergeObject(FakeServer.DrawingDefaultData["all"], event.data.origin, {inplace: false})
	data.type = game.activeTool;
	if (data.type == "shape") {
	    if (event.data.originalEvent.ctrlKey)
		data.type = "circle"; // ellipse really
	    else
		data.type = "square"; // rectangle really
	}
	mergeObject(data, FakeServer.DrawingDefaultData[data.type], {overwrite: false})
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
	if ( event.data.createState == 2 ) {
	    let drawing = event.data.object;

	    drawing.updateMovePosition(event.data.destination)
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
	if ( !game.user.isTrusted ) throw new Error("You may not delete drawings!");
	this.placeables.filter(d => d._controlled && d.canEdit())
	    .forEach(t => t.delete(canvas.scene._id));
    }
}

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
	if ( !this._sheet ) this._sheet = new DrawingConfig(this);
	return this._sheet;
    }

    canChain() {
	return ["polygon", "freehand"].includes(this.data.type)
    }

    canEdit() {
	return game.user.isGM || this.owner == game.user.id
    }
    get fillColor() {
	return this.data.fillColor ? this.data.fillColor.replace("#", "0x") : 0x000000;
    }
    get strokeColor() {
	return this.data.strokeColor ? this.data.strokeColor.replace("#", "0x") : 0x000000;
    }

    // FIXME: Server side code - unmodified create/update/delete functions other than for
    // using FakeServer instead of SocketInterface.
    static async create(sceneId, data, options={}) {
	const name = this.name,
           preHook = 'preCreate'+name,
        eventData = {parentId: sceneId, data: data};
	return FakeServer.trigger('create'+name, eventData, options, preHook, this).then(response => {
	    const object = this.layer._createPlaceableObject(response);
	    if ( options.displaySheet ) object.sheet.render(true);
	    return object;
	});
    }
    async update(sceneId, data, options={}) {
	const name = this.constructor.name,
          preHook = 'preUpdate'+name;

	// Diff the update data
	delete data.id;
	let changed = {};
	for (let [k, v] of Object.entries(data)) {
	    let c = getProperty(this.data, k);
	    if ( c !== v ) changed[k] = v;
	}
	if ( !Object.keys(changed).length ) return Promise.resolve(this);
	changed.id = this.id;
	
	// Trigger the socket event and handle response
	const eventData = {parentId: sceneId, data: changed};
	await FakeServer.trigger('update'+name, eventData, options, preHook, this).then(response => {
	    return this.constructor.layer._updatePlaceableObject(response);
	});
    }
    async delete(sceneId, options={}) {
	const name = this.constructor.name,
          preHook = 'preDelete'+name,
          eventData = {parentId: sceneId, childId: this.id};
	return FakeServer.trigger('delete'+name, eventData, options, preHook, this).then(response => {
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
	this.bg = this.addChild(new PIXI.Container());
	this.img = this.addChild(new PIXI.Graphics());
	if (this.data.texture)
	    this.texture = await loadTexture(this.data.texture)
	this.frame = this.addChild(new PIXI.Graphics());
	this.scaleHandle = this.addChild(new PIXI.Graphics());

	// Render the Tile appearance
	this.refresh();

	// Enable interaction - only if the Tile has an ID
	if ( this.id ) {
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
		canright: event => this._controlled
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

	if (type == "square" || type == "circle") {
	    this._updateDimensions(position, {snap: false})
	}
    }
    /* -------------------------------------------- */
    refresh() {
	this.bg.removeChildren().forEach(c => c.destroy({children: true}));
	this.bg.alpha = this.data.textureAlpha
	this.img.clear().lineStyle(this.data.strokeWidth, this.strokeColor, this.data.strokeAlpha)
	let fillTypeList = [DRAWING_FILL_TYPE.SOLID, DRAWING_FILL_TYPE.PATTERN, DRAWING_FILL_TYPE.STRETCH];
	if (fillTypeList.includes(Number(this.data.fill)))
	    this.img.beginFill(this.fillColor, this.data.fillAlpha);
	if (this.data.type == "square") {
	    let half_stroke = this.data.strokeWidth / 2;
	    this.img.drawRect(half_stroke, half_stroke, this.data.width-2*half_stroke, this.data.height-2*half_stroke);
	} else if (this.data.type == "circle") {
	    let half_width = this.data.width /2;
	    let half_height = this.data.height / 2;
	    let half_stroke = this.data.strokeWidth / 2;
	    this.img.drawEllipse(half_width, half_height, Math.abs(half_width) - half_stroke, Math.abs(half_height) - half_stroke);
	}

	// Handle Filling data
	if (fillTypeList.includes(Number(this.data.fill)))
	    this.img.endFill()

	if (this.texture && this.data.fill == DRAWING_FILL_TYPE.PATTERN) {
	    this.bg.tile = this.bg.addChild(new PIXI.extras.TilingSprite(this.texture, this.data.width, this.data.height))
	    if (this.data.textureWidth > 0 && this.data.textureHeight > 0) {
		let scale_x = this.data.textureWidth / this.texture.width;
		let scale_y = this.data.textureHeight / this.texture.height;
		this.bg.tile.tileScale.set(scale_x, scale_y)
	    }
	    this.bg.tile.mask = this.addChild(this.img.clone())
	} else if (this.texture && (this.data.fill == DRAWING_FILL_TYPE.STRETCH || this.data.fill == DRAWING_FILL_TYPE.CONTOUR)) {
	    console.log("doing it")
            this.bg.tile = this.bg.addChild(new PIXI.Sprite(this.texture));
	    // Set dimensions
	    this.bg.tile.width = this.data.width;
	    this.bg.tile.height = this.data.height;
	    this.bg.tile.mask = this.addChild(this.img.clone())
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
	this.frame.visible = this._controlled && this.id !== undefined;
	this.scaleHandle.visible = this.frame.visible && !this.data.locked;

	// Reset hit area. img doesn't set a hit area automatically if we don't use 'fill',
	// so we need to manually define it. Also take into account negative width/height.
	let hit_x = this.data.width > 0 ? 0 : this.data.width;
	let hit_y = this.data.height > 0 ? 0 : this.data.height;
	this.img.hitArea = new PIXI.Rectangle(hit_x, hit_y, Math.abs(this.data.width), Math.abs(this.data.height));
	
    }

    /* -------------------------------------------- */

    /**
     * Update the tile dimensions given a requested destination point
     * @param {Object} dest
     * @param {Boolean} snap
     * @param {Boolean} constrain
     * @private
     */
    _updateDimensions(dest, {snap=true}={}) {

	// Determine destination position
	if ( snap ) dest = canvas.grid.getSnappedPosition(dest.x, dest.y);

	// Determine change
	let dx = dest.x - this.data.x,
        dy = dest.y - this.data.y;
	if ( dx === 0 ) dest.x = this.data.x + canvas.dimensions.size * Math.sign(this.data.width);
	if ( dy === 0 ) dest.y = this.data.y + canvas.dimensions.size * Math.sign(this.data.height);

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
	if ( hud.object === this && state !== hud.constructor.DISPLAY_STATES.NONE ) hud.clear();
	else hud.bind(this);
    }

}

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
	const position = {
	    width: this.object.data.width + 140,
	    height: this.object.data.height + 10,
	    left: this.object.data.x - 70,
	    top: this.object.data.y - 5
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
	this.object.update(canvas.scene._id, data).then(() => this.render())
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
    return {
      object: duplicate(this.object.data),
      options: this.options,
      drawingTypes: CONFIG.drawingTypes,
      fillTypes: CONFIG.drawingFillTypes,
	supportsTexture: this.object.data.type != "text",
      submitText: this.options.preview ? "Create" : "Update"
    }
  }

  /* -------------------------------------------- */

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  _updateObject(event, formData) {
    if ( !this.object.canEdit() ) throw "You do not have the ability to configure a Drawing object.";
    if ( this.object.id ) {
      formData["id"] = this.object.id;
      this.object.update(canvas.scene._id, formData);
    }
    else this.object.constructor.create(canvas.scene._id, formData);
  }

  /* -------------------------------------------- */

  /**
   * Extend the application close method to clear any preview if one exists
   */
  close() {
    super.close();
    if ( this.preview ) {
      this.preview.removeChildren();
      this.preview = null;
    }
  }
}


class FakeServer {
    static get DrawingDefaultData() {
	return {
	    all: {
		id: 1,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		owner: null,
		hidden: false,
		locked: false,
		fill: DRAWING_FILL_TYPE.NONE,
		fillColor: "#ffffff",
		fillAlpha: 1.0,
		strokeColor: "#000000",
		strokeAlpha: 1.0,
		strokeWidth: 5,
		rotation: 0,
	    },
	    square: {
		texture: null,
		textureWidth: 0,
		textureHeight: 0,
		textureAlpha: 1
	    },
	    circle: {
		texture: null,
		textureWidth: 0,
		textureHeight: 0,
		textureAlpha: 1
	    },
	    text: {
		content: null,
		font: "fa",
		fontSize: 12,
	    },
	    polygon: {
		texture: null,
		textureWidth: 0,
		textureHeight: 0,
		textureAlpha: 1,
		points: []
	    },
	    freehand: {
		texture: null,
		textureWidth: 0,
		textureHeight: 0,
		textureAlpha: 1,
		points: []
	    }
	}
    }

    static getData(scene) {
	let drawings = scene.getFlag("furnace", "drawings") || []
	/* Sanitize content to have default values. Should do more, like ensure id exists and
	 * is unique, type is known, values are not out bounds, etc..
	 */
	for (let drawing of drawings) {
	    mergeObject(drawing, this.DrawingDefaultData["all"], {overwrite: false})
	    mergeObject(drawing, this.DrawingDefaultData[drawing.type], {overwrite: false})
	}
	console.log("Get drawings for scene ", scene.id, " : ", drawings)
	return duplicate(drawings)
    }
    static async setData(scene, drawings) {
	console.log("Updating drawings database for scene ", scene.id, " : ", drawings)
	// HACK: for deleteAll.. it's just working weirdly...
	if (drawings.length == 0) {
	    let original = this.getData(scene)
	    for (let d of original) {
		Hooks.call("deleteDrawing", {parentId: scene.id, deleted: d.id});
	    }
	}
	return scene.setFlag("furnace", "drawings", drawings)
    }

    static async trigger(hook, eventData, options={}, preHook, context) {
	// Dispatch the pre-hook
	if ( preHook ) {
	    let hookArgs = context ? Array(context, ...Object.values(eventData)) : Object.values(eventData);
	    let allowed = Hooks.call(preHook, ...hookArgs);
	    if ( allowed === false ) {
		console.log(`${vtt} | ${eventName} submission prevented by ${preHook} hook`);
		return new Promise(resolve => null);   // Deliberately return an unresolved Promise
	    }
	}
	if (hook == "createDrawing") {
	    let {parentId, data} = eventData
	    const scene = game.scenes.get(parentId);
	    if (!scene) throw new Error(`Parent Scene ${parentId} not found`);
	    let id = 1;

	    // Get the current drawings and assign a new id
	    let drawings = FakeServer.getData(scene)
	    for (let drawing of drawings) {
		if (drawing.id >= id)
		    id = drawing.id + 1
	    }
	    data.id = id
	    if (!data.owner)
		data.owner = game.user.id

	    // Set the default values
	    mergeObject(data, this.DrawingDefaultData["all"], {overwrite: false})
	    mergeObject(data, this.DrawingDefaultData[data.type], {overwrite: false})

	    // Add to database
	    drawings.push(data)
	    await FakeServer.setData(scene, drawings)

	    return {parentId: parentId, created: data}
	} else if (hook == "updateDrawing") {
	    let {parentId, data} = eventData
	    const scene = game.scenes.get(parentId);
	    if (!scene) throw new Error(`Parent Scene ${parentId} not found`);

	    // Update database
	    let drawings = FakeServer.getData(scene)
	    let original = drawings.find(o => o.id === Number(data.id));
	    mergeObject(original, data, {inplace: true});
	    await FakeServer.setData(scene, drawings)

	    return {parentId: parentId, updated: data}
	} else if (hook == "deleteDrawing") {
	    let {parentId, childId} = eventData
	    const scene = game.scenes.get(parentId);
	    if (!scene) throw new Error(`Parent Scene ${parentId} not found`);

	    // Update database
	    let drawings = FakeServer.getData(scene)
            let idx = drawings.findIndex(o => o.id === Number(childId));
	    if (idx !== -1) {
		drawings.splice(idx, 1);
		await FakeServer.setData(scene, drawings)
	    }

	    return {parentId: parentId, deleted: childId}
	} else{
	    throw new Error("Idontknow")
	}
    }
}

class FurnaceDrawing {
    static canvasInit() {
	canvas.hud.drawing = new DrawingHUD()
	let gridIdx = canvas.stage.children.indexOf(canvas.grid)
	canvas.drawings = canvas.stage.addChildAt(new DrawingsLayer(), gridIdx)
	// Should probably 'await' this, but the hook isn't async
	canvas.drawings.draw()
    }
    static renderSceneControls(obj, html, data) {
	if (obj.controls.drawings == undefined) {
	    let isTrusted = game.user.isTrusted;
	    let controls = obj.controls

	    // Rebuild the object so I can place the Drawings layer right after the Tiles layer
	    obj.controls = {}
	    for (let control in controls) {
		obj.controls[control] = controls[control]
		if (control == "tiles") {
		    obj.controls["drawings"] = {
			name: "Drawing Tools",
			layer: "DrawingsLayer",
			icon: "fas fa-pencil-alt",
			tools: {
			    select: {
				name: "Select Drawings",
				icon: "fas fa-expand",
				visible: isTrusted
			    },
			    shape: {
				name: "Draw Shapes",
				icon: "fas fa-shapes",
				visible: isTrusted
			    },
			    polygon: {
				name: "Draw Polygons",
				icon: "fas fa-draw-polygon",
				visible: isTrusted
			    },
			    freehand: {
				name: "Draw Freehand",
				icon: "fas fa-signature",
				visible: isTrusted
			    },
			    text: {
				name: "Draw Text",
				icon: "fas fa-font",
				visible: isTrusted
			    },
			    clear: {
				name: "Clear all Drawings",
				icon: "fas fa-trash",
				onClick: () => canvas.drawings.deleteAll(),
				visible: isTrusted
			    }
			},
			activeTool: "select"
		    }
		}
	    }
	    
	    obj.render();
	}
    }
}

Hooks.on('canvasInit', FurnaceDrawing.canvasInit);
Hooks.on('renderSceneControls', FurnaceDrawing.renderSceneControls);
