class FurnaceTokenQoL {
    static init() {
        game.settings.register("furnace", "tokenIgnoreVision", {
            name: "Ignore Token Vision for the GM",
            scope: "world",
            config: false,
            default: false,
            type: Boolean,
            onChange: value => {
                canvas.sight.updateLights();
                canvas.sight.updateSight({ updateFog: true });
                canvas.sight.restrictVisibility();
            }
        });
    }
    static getSceneControlButtons(buttons) {
        let tokenButton = buttons.find(b => b.name == "token")

        if (tokenButton) {
            tokenButton.tools.push({
                name: "vision",
                title: "Ignore Token Vision",
                icon: "far fa-eye-slash",
                toggle: true,
                active: game.settings.get("furnace", "tokenIgnoreVision"),
                visible: game.user.isGM,
                onClick: (value) => game.settings.set("furnace", "tokenIgnoreVision", value)
            });
        }
    }
    static ready() {
        FurnacePatching.replaceMethod(Token, "_onMouseUp", async function (event) {
            let { handleState, clones, origin, destination, originalEvent } = event.data;
            const controlled = canvas.tokens.controlled;
            if (controlled.length <= 1 || handleState === 0)
                return FurnacePatching.callOriginalFunction(this, "_onMouseUp", event);

            // Get Token movement data
            let offsetX = destination.x - origin.x,
                offsetY = destination.y - origin.y;


            // Determine updated token data for controlled tokens and update the Scene with all tokens
            let collision = false;
            let updateData = []
            for (let c of controlled) {
                let target = {
                    x: (c.x + offsetX),
                    y: (c.y + offsetY)
                };

                // Snap to grid unless shift is pressed
                if (!originalEvent.shiftKey) target = canvas.grid.getSnappedPosition(target.x, target.y, 1);

                // Check collision center-to-center
                let targetCenter = this.getCenter(target.x, target.y);
                let collide = this.checkCollision(targetCenter, { drag: true });
                collision |= collide;
                if (!collide) {
                    // Update token movement
                    updateData.push({id: c.id, x: target.x, y: target.y})
                }
            }
            if (updateData.length > 0)
                await canvas.tokens.updateMany(updateData, {updateKeys: ["x", "y"]})
            if (collision)
                ui.notifications.warn("One or more tokens have hit a wall!");

            for (let clone of clones) {
                let c = controlled.find(t => t.id == clone.original_id)
                c.data.locked = false;
                c.alpha = 1.0;
            }
            this._onDragCancel(event);
        });
        FurnacePatching.replaceMethod(Token, "_onMouseMove", async function (event) {
            const controlled = canvas.tokens.controlled;
            if (controlled.length <= 1)
                return FurnacePatching.callOriginalFunction(this, "_onMouseMove", event);

            let { handleState, origin, clones } = event.data,
                dest = event.data.getLocalPosition(this.layer),
                dx = dest.x - origin.x,
                dy = dest.y - origin.y;

            // Create the clone container
            if (handleState === 0 && (Math.hypot(dx, dy) >= canvas.dimensions.size / (this.layer.gridPrecision * 2))) {
                event.data.handleState = handleState = 1;
                let clones = []
                for (let c of controlled) {
                    let clone = await c.clone().draw();
                    this.layer.preview.addChild(clone);
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

        FurnacePatching.replaceMethod(SightLayer, "updateSight", function (options) {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision")) {
                this.map.visible = false;
                this.fog.visible = false;
                this.restrictVisibility();
                return;
            }
            return FurnacePatching.callOriginalFunction(this, "updateSight", options);
        });
        FurnacePatching.replaceMethod(SightLayer, "updateLights", function (options) {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision")) {
                this.map.visible = false;
                this.fog.visible = false;
                return;
            }
            return FurnacePatching.callOriginalFunction(this, "updateLights", options);
        });
        FurnacePatching.replaceGetter(Token, "isVisible", function () {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision"))
                return true;
            return  FurnacePatching.callOriginalGetter(this, "isVisible");
        });
        FurnacePatching.replaceGetter(DoorControl, "isVisible", function () {
            if (game.user.isGM && game.settings.get("furnace", "tokenIgnoreVision"))
                return true;
            return  FurnacePatching.callOriginalGetter(this, "isVisible");
        });
    }
}

Hooks.on('init', FurnaceTokenQoL.init)
Hooks.on('getSceneControlButtons', FurnaceTokenQoL.getSceneControlButtons)
Hooks.on('ready', FurnaceTokenQoL.ready)