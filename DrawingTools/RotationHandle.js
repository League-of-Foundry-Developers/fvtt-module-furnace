class RotationHandle extends PIXI.Graphics {
    constructor(placeableObject, offset = 25) {
        super()
        this.object = placeableObject;
        this._hover = false;
        this._offset = offset;
    }

    addEventListeners(layer, permissions) {
        new HandleManager(this, layer, {
            mouseover: event => this._onMouseOver(event),
            mouseout: event => this._onMouseOut(event),
            mousedown: event => this._onMouseDown(event),
            mousemove: event => this._onMouseMove(event),
            mouseup: event => this._onMouseUp(event)
        }, permissions);
    }

    draw() {
        let scale = this._hover ? 1.5 : 1.0;
        let fromAngle = Math.PI / 4;
        let toAngle = 3 * Math.PI / 4;
        let fromPosition = this.rotatePosition({ x: this._offset, y: 0 }, { x: 0, y: 0 }, -fromAngle)
        let toPosition = this.rotatePosition({ x: this._offset, y: 0 }, { x: 0, y: 0 }, -toAngle)

        this.clear()
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
            .arc(0, 0, this._offset, -fromAngle, -toAngle, true)
            .lineStyle(2.0, 0x000000)
            .moveTo(0, 0)
            .lineTo(0, -this._offset)
            .beginFill(0xFF9829, 1.0)
            .drawCircle(0, -this._offset, 6.0 * scale)
            .endFill()
    }

    /**
     * FIXME: Duplicate in Drawing, this should really go into a sort of util class.
     * Get coordinates of a point after a rotation around another point
     * @param {Object} dest
     */
    rotatePosition(coordinates, axis, angle) {
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
     * Handle mouse-over event on a control handle
     * @private
     */
    _onMouseOver(event) {
        this._hover = true;
        this.draw();
    }

    /**
     * Handle mouse-out event on a control handle
     * @private
     */
    _onMouseOut(event) {
        this._hover = false;
        this.draw();
    }
    _onMouseDown(event) {
        event.data.original = duplicate(this.object.data);
    }
    _onMouseMove(event) {
        this.object._updateRotation(event.data.destination);
        this.object.refresh();
    }

    /* -------------------------------------------- */

    _onMouseUp(event) {
        let { original, destination } = event.data;
        this.object._updateRotation(destination);

        // Update the tile
        const data = { rotation: this.object.data.rotation };
        this.object.data = original;
        this.object.update(canvas.scene._id, data);
    }
}
