class FurnacePlaceablesQoL {
  static ready() {
    FurnacePatching.replaceMethod(PlaceableObject, "_onMouseUp", async function (event) {
        const controlled = this.layer.controlled;
        if (controlled.length <= 1)
            return FurnacePatching.callOriginalFunction(this, "_onMouseUp", event);

        let { clones, origin, destination, handleState, originalEvent } = event.data;
        if ( handleState === 0 ) return;
        // Get Placeable movement data
        let offsetX = destination.x - origin.x,
            offsetY = destination.y - origin.y;

        // Snap to grid unless shift is pressed
        if (!originalEvent.shiftKey) {
          // We can't snap each individual placeable as it might cause them to lose their alignment, so we
          // snap the offset instead 
          const snapped = canvas.grid.getSnappedPosition(offsetX, offsetY, this.layer.gridPrecision);
          offsetX = snapped.x;
          offsetY = snapped.y;
        }

        let updateData = []
        for (let c of controlled) {
            let target = {
                x: (c.data.x + offsetX),
                y: (c.data.y + offsetY)
            };

            updateData.push({_id: c.id, x: target.x, y: target.y})
        }
        if (updateData.length > 0)
            await this.layer.updateMany(updateData, {updateKeys: ["x", "y"]})

        for (let clone of clones) {
            let c = controlled.find(t => t.id == clone.original_id)
            c.data.locked = false;
            c.alpha = 1.0;
        }
        this._onDragCancel(event);
    });

    FurnacePatching.replaceMethod(PlaceableObject, "_onMouseMove", async function (event) {
        const controlled = this.layer.controlled;
        if (controlled.length <= 1)
            return FurnacePatching.callOriginalFunction(this, "_onMouseMove", event);

        const layer = this.layer;
        const dims = canvas.dimensions;
        let { handleState, origin, clones } = event.data,
            dest = event.data.getLocalPosition(this.layer),
            dx = dest.x - origin.x,
            dy = dest.y - origin.y;

        // Create the clone container
        if (handleState === 0 && (Math.hypot(dx, dy) >= dims.size / (layer.gridPrecision * 2))) {
            event.data.handleState = handleState = 1;
            clones = []
            for (let c of controlled) {
                let clone = await c.clone().draw();
                layer.preview.addChild(clone);
                clone.alpha = 0.8;
                clone.original_id = c.id
                c.alpha = 0.4;
                c.data.locked = true;
                clones.push(clone)
            }
            event.data.clones = clones;
        }

        // Update the clone position
        if (handleState > 0) {
            if (!clones) return;
            for (let clone of clones) {
                let c = controlled.find(t => t.id == clone.original_id)
                clone.data.x = c.data.x + dx;
                clone.data.y = c.data.y + dy;
                clone.refresh();
            }
        }
    });
  }
}

Hooks.on('ready', FurnacePlaceablesQoL.ready)